import { api } from './client'

export interface AgentUsage {
  agentId: string | null
  calls: number
  totalTokens: number
  costUsd: number
}

export interface ProviderUsage {
  provider: string
  calls: number
  totalTokens: number
  costUsd: number
}

export interface DailyStat {
  date: string
  calls: number
  totalTokens: number
  costUsd: number
}

export interface UsageSummary {
  totalCalls: number
  totalPromptTokens: number
  totalCompletionTokens: number
  totalTokens: number
  totalCostUsd: number
  byAgent: AgentUsage[]
  byProvider: ProviderUsage[]
  dailyStats: DailyStat[]
  period: string
}

export interface UsageLog {
  id: string
  agentId: string | null
  conversationId: string | null
  provider: string
  model: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  costUsd: number
  createdAt: string
}

export interface PaginatedLogs {
  data: UsageLog[]
  total: number
  page: number
  limit: number
}

export const usageApi = {
  getSummary: (days = 30) =>
    api.get<UsageSummary>('/usage/summary', { params: { days } }).then((r) => r.data),

  getLogs: (page = 1, limit = 10) =>
    api.get<PaginatedLogs>('/usage/logs', { params: { page, limit } }).then((r) => r.data),
}
