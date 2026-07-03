import { ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('liveness returns ok without touching the DB', () => {
    const prisma = { $queryRaw: jest.fn() } as unknown as PrismaService;
    const res = new HealthController(prisma).liveness();
    expect(res.status).toBe('ok');
    expect(typeof res.uptime).toBe('number');
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('readiness returns ok when the DB responds', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    } as unknown as PrismaService;
    await expect(new HealthController(prisma).readiness()).resolves.toEqual({ status: 'ok', db: 'up' });
  });

  it('readiness throws 503 when the DB is unreachable', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockRejectedValue(new Error('P1001')),
    } as unknown as PrismaService;
    await expect(new HealthController(prisma).readiness()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
