import { api } from './client'

export interface Meeting {
  id: string
  googleEventId: string
  title: string
  description: string | null
  location: string | null
  startTime: string
  endTime: string
  meetLink: string | null
  attendees: string[]
  htmlLink: string | null
  status: string
  createdAt: string
  updatedAt: string
}

export interface SyncStatus {
  syncing: boolean
  lastSyncedAt: string | null
}

export const meetingsApi = {
  list: (view: 'upcoming' | 'past' | 'all' = 'upcoming') =>
    api.get<Meeting[]>('/meetings', { params: { view } }).then((r) => r.data),

  triggerSync: () =>
    api.post<SyncStatus>('/meetings/sync').then((r) => r.data),

  getSyncStatus: () =>
    api.get<SyncStatus>('/meetings/sync/status').then((r) => r.data),
}
