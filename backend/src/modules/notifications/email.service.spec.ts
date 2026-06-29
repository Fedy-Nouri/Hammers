import type { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { EmailService } from './email.service';

interface CreatedLog {
  status: string;
  type: string;
  to: string;
  error: string | null;
}

function makeEmail(opts: { key?: string; createThrows?: boolean }) {
  const created: CreatedLog[] = [];
  const prisma = {
    emailLog: {
      create: jest.fn(async ({ data }: { data: CreatedLog }) => {
        if (opts.createThrows) throw new Error('db down');
        created.push(data);
        return data;
      }),
    },
  } as unknown as PrismaService;
  const config = {
    get: (k: string, d?: string) => (k === 'RESEND_API_KEY' ? opts.key : d),
  } as unknown as ConfigService;
  return { svc: new EmailService(config, prisma), created };
}

const base = { to: 'jo@example.com', subject: 'Hi', html: '<p>x</p>', type: 'welcome' };

describe('EmailService (tolerant)', () => {
  it('logs + records "logged" and never throws when no provider is configured', async () => {
    const { svc, created } = makeEmail({});
    expect(svc.configured).toBe(false);
    await expect(svc.send(base)).resolves.toBeUndefined();
    expect(created[0]).toMatchObject({ status: 'logged', type: 'welcome', to: 'jo@example.com', error: null });
  });

  it('records "failed" and never throws when the provider errors', async () => {
    const { svc, created } = makeEmail({ key: 're_fake_key' });
    const internal = svc as unknown as { resend: { emails: { send: unknown } } };
    internal.resend.emails.send = jest.fn().mockRejectedValue(new Error('boom'));
    await expect(svc.send(base)).resolves.toBeUndefined();
    expect(created[0].status).toBe('failed');
    expect(created[0].error).toContain('boom');
  });

  it('does not throw if writing the EmailLog fails', async () => {
    const { svc } = makeEmail({ createThrows: true });
    await expect(svc.send(base)).resolves.toBeUndefined();
  });
});
