import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { PLANS, resolvePlanKey, type PlanKey } from './plans';

export interface EffectivePlan {
  plan: PlanKey;
  cap: number;
  status: string | null;
  currentPeriodEnd: Date | null;
}

/**
 * Resolves a user's effective plan + monthly cap. A paid plan whose Stripe subscription is
 * canceled/past_due falls back to the free cap (the webhook also resets the plan, this is a
 * belt-and-suspenders for the window in between).
 */
@Injectable()
export class PlanService {
  constructor(private readonly prisma: PrismaService) {}

  async getPlan(userId: string): Promise<EffectivePlan> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionPlan: true, subscriptionStatus: true, currentPeriodEnd: true },
    });

    const stored = resolvePlanKey(user?.subscriptionPlan);
    const status = user?.subscriptionStatus ?? null;
    const lapsed = status === 'canceled' || status === 'past_due';
    const plan: PlanKey = stored !== 'free' && lapsed ? 'free' : stored;

    return {
      plan,
      cap: PLANS[plan].monthlyUsdCap,
      status,
      currentPeriodEnd: user?.currentPeriodEnd ?? null,
    };
  }
}
