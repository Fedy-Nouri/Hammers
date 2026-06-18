import { api } from './client'

export type ActionItemStatus = 'open' | 'done' | 'dismissed'
export type RiskCategory = 'risk' | 'blocker' | 'dependency'

export interface ActionItem {
  id: string
  meetingId: string
  task: string
  assignee: string | null
  confidence: number
  status: ActionItemStatus
  createdAt: string
  updatedAt: string
}

export interface Decision {
  id: string
  text: string
  createdAt: string
}

export interface Risk {
  id: string
  text: string
  category: RiskCategory
  transcriptRefMs: number | null
  createdAt: string
}

export interface MeetingAnalysis {
  summary: string
  updatedAt: string | null
  actionItems: ActionItem[]
  decisions: Decision[]
  risks: Risk[]
}

export interface ActionItemPatch {
  task?: string
  assignee?: string | null
  status?: ActionItemStatus
}

export const analysisApi = {
  get: (meetingId: string) =>
    api.get<MeetingAnalysis>(`/meetings/${meetingId}/analysis`).then((r) => r.data),

  updateActionItem: (meetingId: string, itemId: string, patch: ActionItemPatch) =>
    api
      .patch<ActionItem>(`/meetings/${meetingId}/action-items/${itemId}`, patch)
      .then((r) => r.data),
}
