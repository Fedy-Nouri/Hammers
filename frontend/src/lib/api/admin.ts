import { api } from './client'

export interface AdminMetrics {
  totalUsers: number
  usersByPlan: { plan: string; count: number }[]
  activeSubscriptions: number
  estimatedMrrUsd: number
  monthToDate: { calls: number; costUsd: number }
  topAgents: { agentId: string; name: string; installs: number }[]
  emails: { total: number; sent: number }
}

export interface AdminUser {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  role: string
  subscriptionPlan: string
  subscriptionStatus: string | null
  monthToDateCostUsd: number
  createdAt: string
}

export interface EmailLogRow {
  id: string
  to: string
  type: string
  status: string
  createdAt: string
}

export interface Paginated<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

export const adminApi = {
  metrics: () => api.get<AdminMetrics>('/admin/metrics').then((r) => r.data),

  users: (page = 1, limit = 20) =>
    api.get<Paginated<AdminUser>>('/admin/users', { params: { page, limit } }).then((r) => r.data),

  setRole: (id: string, role: 'user' | 'admin') =>
    api.patch<AdminUser>(`/admin/users/${id}`, { role }).then((r) => r.data),

  emails: (page = 1, limit = 20) =>
    api.get<Paginated<EmailLogRow>>('/admin/emails', { params: { page, limit } }).then((r) => r.data),

  // Agent management reuses the (now admin-gated) agents CRUD.
  updateAgent: (id: string, body: { enabled?: boolean; minPlan?: 'free' | 'pro' | 'enterprise' }) =>
    api.patch(`/agents/${id}`, body).then((r) => r.data),
}
