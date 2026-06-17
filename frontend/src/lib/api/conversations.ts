import { api } from './client'

export interface Conversation {
  id: string
  userId: string
  agentId: string
  title: string | null
  createdAt: string
  updatedAt: string
}

export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: string
}

export interface Paginated<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

export const conversationsApi = {
  create: (agentId: string, title?: string) =>
    api.post<Conversation>('/conversations', { agentId, title }).then((r) => r.data),

  list: (page = 1, limit = 30) =>
    api.get<Paginated<Conversation>>('/conversations', { params: { page, limit } }).then((r) => r.data),

  get: (id: string) =>
    api.get<Conversation>(`/conversations/${id}`).then((r) => r.data),

  remove: (id: string) =>
    api.delete(`/conversations/${id}`),

  getMessages: (id: string, page = 1, limit = 50) =>
    api
      .get<Paginated<Message>>(`/conversations/${id}/messages`, { params: { page, limit } })
      .then((r) => r.data),

  addMessage: (id: string, role: 'user' | 'assistant' | 'system', content: string) =>
    api.post<Message>(`/conversations/${id}/messages`, { role, content }).then((r) => r.data),
}

export interface Agent {
  id: string
  name: string
  description: string | null
  enabled: boolean
}

export const agentsApi = {
  list: () => api.get<Agent[]>('/agents').then((r) => r.data),
}
