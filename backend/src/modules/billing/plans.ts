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
