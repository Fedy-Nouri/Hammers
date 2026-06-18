import { api } from './client'
import { readSSEData } from '../sse'

export interface TranscriptSegment {
  id?: string
  speaker: number | null
  text: string
  startMs: number
  endMs: number
  confidence: number | null
  isFinal?: boolean
}

export const transcriptApi = {
  getStored: (meetingId: string) =>
    api
      .get<TranscriptSegment[]>(`/meetings/${meetingId}/transcript`)
      .then((r) => r.data),
}

/**
 * Opens the live transcript SSE stream for a meeting and yields each segment as
 * it arrives. Uses fetch (not EventSource) so the JWT can be sent as a header.
 */
export async function* streamTranscript(
  meetingId: string,
  signal: AbortSignal,
): AsyncGenerator<TranscriptSegment> {
  const token = sessionStorage.getItem('accessToken')
  const response = await fetch(`/api/meetings/${meetingId}/transcript/stream`, {
    headers: { Authorization: `Bearer ${token ?? ''}` },
    signal,
  })
  if (!response.ok) throw new Error('Transcript stream failed')
  yield* readSSEData<TranscriptSegment>(response, signal)
}
