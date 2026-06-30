import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PlanService } from './plan.service';
import type { PlanKey } from './plans';

export interface QuotaUsage {
  plan: PlanKey;
  cap: number;
  usedUsd: number;
  remainingUsd: number;
  percent: number;
  exceeded: boolean;
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/** Start of the current calendar month in UTC. */
function startOfMonthUtc(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Month-to-date AI-cost quota. `getUsage` reports where a user stands; `assertWithinQuota`
 * throws 402 when they are at/over their plan cap. Enforced via QuotaGuard on user-initiated
 * AI routes — background meeting analysis/reporting is intentionally NOT gated (its cost still
 * counts toward usage).
 */
@Injectable()
export class QuotaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: PlanService,
    private readonly notifications: NotificationsService,
  ) {}

  async getUsage(userId: string): Promise<QuotaUsage> {
    const { plan, cap } = await this.plans.getPlan(userId);
    const agg = await this.prisma.aiUsageLog.aggregate({
      _sum: { costUsd: true },
      where: { userId, createdAt: { gte: startOfMonthUtc() } },
    });
    const usedUsd = round6(agg._sum.costUsd ?? 0);
    const remainingUsd = Math.max(0, round6(cap - usedUsd));
    const percent = cap > 0 ? Math.min(100, Math.round((usedUsd / cap) * 100)) : 100;
    return { plan, cap, usedUsd, remainingUsd, percent, exceeded: usedUsd >= cap };
  }

  async assertWithinQuota(userId: string): Promise<void> {
    const usage = await this.getUsage(userId);

    // Notify (once per month per type) when approaching or over the cap. Fire-and-forget so
    // it never blocks or fails the AI request; only check when >=80% to avoid a per-request DB hit.
    if (usage.percent >= 80) {
      void this.notifications.maybeSendQuotaEmail(userId, usage).catch(() => undefined);
    }

    if (usage.exceeded) {
      throw new HttpException(
        `Monthly AI usage limit reached for the ${usage.plan} plan ($${usage.cap.toFixed(2)}). Upgrade your plan to continue.`,
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
  }
}
