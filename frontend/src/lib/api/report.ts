import { api } from './client'

export type ReportStatus = 'pending' | 'generating' | 'ready' | 'failed'

export interface TranscriptSegmentItem {
  id: string
  meetingId: string
  speaker: number | null
  text: string
  startMs: number
  endMs: number
  confidence: number | null
  createdAt: string
}

export interface ReportSection {
  id: string
  executive: string
  followUps: string[]
  status: ReportStatus
  updatedAt: string
}

export interface EmailSection {
  id: string
  subject: string
  body: string
  status: ReportStatus
  updatedAt: string
}

export interface ReportActionItem {
  id: string
  task: string
  assignee: string | null
  confidence: number
  status: string
}

export interface ReportDecision {
  id: string
  text: string
}

export interface ReportRisk {
  id: string
  text: string
  category: string
}

export interface MeetingReportData {
  report: ReportSection | null
  email: EmailSection | null
  transcript: TranscriptSegmentItem[]
  actionItems: ReportActionItem[]
  decisions: ReportDecision[]
  risks: ReportRisk[]
}

export interface EmailPatch {
  subject?: string
  body?: string
}

export const reportApi = {
  get: (meetingId: string) =>
    api.get<MeetingReportData>(`/meetings/${meetingId}/report`).then((r) => r.data),

  updateEmail: (meetingId: string, patch: EmailPatch) =>
    api.patch<EmailSection>(`/meetings/${meetingId}/email`, patch).then((r) => r.data),
}
