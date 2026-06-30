export type PlanKey = 'free' | 'pro' | 'enterprise';

export interface PlanDef {
  key: PlanKey;
  displayName: string;
  /** Monthly AI-cost cap in USD (month-to-date SUM(AiUsageLog.costUsd)). */
  monthlyUsdCap: number;
  /** Env var holding the Stripe price id; absent on the free plan. */
  priceEnv?: string;
}

/** Single source of truth for plans + caps. Caps are cheap to tune here. */
export const PLANS: Record<PlanKey, PlanDef> = {
  free: { key: 'free', displayName: 'Free', monthlyUsdCap: 1 },
  pro: { key: 'pro', displayName: 'Pro', monthlyUsdCap: 25, priceEnv: 'STRIPE_PRICE_PRO' },
  enterprise: {
    key: 'enterprise',
    displayName: 'Enterprise',
    monthlyUsdCap: 150,
    priceEnv: 'STRIPE_PRICE_ENTERPRISE',
  },
};

export const DEFAULT_PLAN: PlanKey = 'free';

/** Coerce an arbitrary stored plan string to a known plan key (defaults to free). */
export function resolvePlanKey(plan: string | null | undefined): PlanKey {
  return plan === 'pro' || plan === 'enterprise' ? plan : 'free';
}

const PLAN_RANK: Record<PlanKey, number> = { free: 0, pro: 1, enterprise: 2 };

/** Ordinal rank of a plan (free 0 < pro 1 < enterprise 2). */
export function planRank(plan: string | null | undefined): number {
  return PLAN_RANK[resolvePlanKey(plan)];
}

/** True when a user's plan is at least the required minimum plan. */
export function meetsPlan(userPlan: string | null | undefined, minPlan: string | null | undefined): boolean {
  return planRank(userPlan) >= planRank(minPlan);
}
