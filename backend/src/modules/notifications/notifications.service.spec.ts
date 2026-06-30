import type { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { EmailService, type SendParams } from './email.service';
import { NotificationsService } from './notifications.service';
import {
  meetingFollowUpEmail,
  passwordResetEmail,
  quotaBlockedEmail,
  quotaWarnEmail,
  welcomeEmail,
} from './templates';

function makeNotif(opts: { existingLog?: boolean; user?: { email: string } | null } = {}) {
  const sends: SendParams[] = [];
  const email = {
    send: jest.fn(async (p: SendParams) => {
      sends.push(p);
    }),
  } as unknown as EmailService;
  const prisma = {
    emailLog: { findFirst: jest.fn().mockResolvedValue(opts.existingLog ? { id: 'x' } : null) },
    user: { findUnique: jest.fn().mockResolvedValue('user' in opts ? opts.user : { email: 'u@e.com' }) },
  } as unknown as PrismaService;
  const config = { get: (_k: string, d?: string) => d } as unknown as ConfigService;
  return { notif: new NotificationsService(email, prisma, config), sends, email };
}

describe('NotificationsService', () => {
  it('sends a reset email with a tokenized link', async () => {
    const { notif, sends } = makeNotif();
    await notif.sendPasswordReset('u@e.com', 'tok123', 'uid');
    expect(sends[0].type).toBe('password_reset');
    expect(sends[0].html).toContain('reset-password?token=tok123');
  });

  it('skips the quota email if one was already sent this period', async () => {
    const { notif, email } = makeNotif({ existingLog: true });
    await notif.maybeSendQuotaEmail('uid', { cap: 1, usedUsd: 0.9, percent: 90, exceeded: false });
    expect(email.send).not.toHaveBeenCalled();
  });

  it('sends quota_warn under cap and quota_blocked over cap', async () => {
    const warn = makeNotif();
    await warn.notif.maybeSendQuotaEmail('uid', { cap: 1, usedUsd: 0.9, percent: 90, exceeded: false });
    expect(warn.sends[0].type).toBe('quota_warn');

    const blocked = makeNotif();
    await blocked.notif.maybeSendQuotaEmail('uid', { cap: 1, usedUsd: 1.2, percent: 100, exceeded: true });
    expect(blocked.sends[0].type).toBe('quota_blocked');
  });

  it('does nothing if the user is not found', async () => {
    const { notif, email } = makeNotif({ user: null });
    await notif.maybeSendQuotaEmail('uid', { cap: 1, usedUsd: 0.9, percent: 90, exceeded: false });
    expect(email.send).not.toHaveBeenCalled();
  });
});

describe('email templates', () => {
  it('render a non-empty subject + html', () => {
    const all = [
      passwordResetEmail('http://x/reset'),
      welcomeEmail('Fedi'),
      quotaWarnEmail(0.9, 1, 90),
      quotaBlockedEmail(1),
      meetingFollowUpEmail('Subject', 'Body'),
    ];
    for (const t of all) {
      expect(t.subject).toBeTruthy();
      expect(t.html).toContain('<');
    }
  });

  it('escapes HTML in the follow-up body (no script injection)', () => {
    const t = meetingFollowUpEmail('S', '<script>alert(1)</script>');
    expect(t.html).not.toContain('<script>');
    expect(t.html).toContain('&lt;script&gt;');
  });
});
