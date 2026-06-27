import { HttpException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { PlanService } from './plan.service';
import { QuotaService } from './quota.service';

interface UserRow {
  subscriptionPlan: string;
  subscriptionStatus: string | null;
  currentPeriodEnd: Date | null;
}

function makeQuota(user: UserRow | null, sumCost: number | null) {
  const aggregate = jest.fn().mockResolvedValue({ _sum: { costUsd: sumCost } });
  const findUnique = jest.fn().mockResolvedValue(user);
  const prisma = {
    user: { findUnique },
    aiUsageLog: { aggregate },
  } as unknown as PrismaService;
  const quota = new QuotaService(prisma, new PlanService(prisma));
  return { quota, aggregate };
}

const freeUser: UserRow = { subscriptionPlan: 'free', subscriptionStatus: null, currentPeriodEnd: null };

describe('QuotaService', () => {
  it('reports free plan + cap with month-to-date usage', async () => {
    const { quota } = makeQuota(freeUser, 0.5);
    const usage = await quota.getUsage('u1');
    expect(usage).toMatchObject({ plan: 'free', cap: 1, usedUsd: 0.5, remainingUsd: 0.5, percent: 50, exceeded: false });
  });

  it('treats a missing user / null sum as the free plan with zero usage', async () => {
    const { quota } = makeQuota(null, null);
    const usage = await quota.getUsage('u1');
    expect(usage).toMatchObject({ plan: 'free', cap: 1, usedUsd: 0, exceeded: false });
  });

  it('is exceeded exactly at the cap (>=)', async () => {
    const { quota } = makeQuota(freeUser, 1);
    const usage = await quota.getUsage('u1');
    expect(usage.exceeded).toBe(true);
    expect(usage.percent).toBe(100);
    expect(usage.remainingUsd).toBe(0);
  });

  it('uses the pro cap for an active pro subscription', async () => {
    const { quota } = makeQuota({ subscriptionPlan: 'pro', subscriptionStatus: 'active', currentPeriodEnd: null }, 10);
    const usage = await quota.getUsage('u1');
    expect(usage).toMatchObject({ plan: 'pro', cap: 25, exceeded: false });
  });

  it('falls back to the free cap when a paid sub is past_due', async () => {
    const { quota } = makeQuota({ subscriptionPlan: 'pro', subscriptionStatus: 'past_due', currentPeriodEnd: null }, 5);
    const usage = await quota.getUsage('u1');
    expect(usage.plan).toBe('free');
    expect(usage.cap).toBe(1);
    expect(usage.exceeded).toBe(true); // $5 > $1 free cap
  });

  it('assertWithinQuota throws 402 over cap and is silent under cap', async () => {
    const over = makeQuota(freeUser, 2);
    await expect(over.quota.assertWithinQuota('u1')).rejects.toBeInstanceOf(HttpException);
    await over.quota.assertWithinQuota('u1').catch((e: HttpException) => expect(e.getStatus()).toBe(402));

    const under = makeQuota(freeUser, 0.1);
    await expect(under.quota.assertWithinQuota('u1')).resolves.toBeUndefined();
  });

  it('aggregates from the start of the current UTC month', async () => {
    const { quota, aggregate } = makeQuota(freeUser, 0);
    await quota.getUsage('u1');
    const now = new Date();
    const expected = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
    const arg = aggregate.mock.calls[0][0] as { where: { userId: string; createdAt: { gte: Date } } };
    expect(arg.where.userId).toBe('u1');
    expect(arg.where.createdAt.gte.getTime()).toBe(expected);
  });
});
