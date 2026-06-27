import { api } from './client'

export type PlanKey = 'free' | 'pro' | 'enterprise'

export interface BillingUsage {
  plan: PlanKey
  cap: number
  usedUsd: number
  remainingUsd: number
  percent: number
  exceeded: boolean
}

export interface PlanInfo {
  key: string
  displayName: string
  monthlyUsdCap: number
  purchasable: boolean
}

export const billingApi = {
  getUsage: () => api.get<BillingUsage>('/billing/usage').then((r) => r.data),

  getPlans: () => api.get<PlanInfo[]>('/billing/plans').then((r) => r.data),

  createCheckout: (plan: Exclude<PlanKey, 'free'>) =>
    api.post<{ url: string }>('/billing/checkout', { plan }).then((r) => r.data),

  createPortal: () => api.post<{ url: string }>('/billing/portal').then((r) => r.data),
}
