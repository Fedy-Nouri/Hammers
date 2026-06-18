import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Video, Radio, FileText } from 'lucide-react'
import { meetingsApi } from '../lib/api/meetings'
import type { Meeting, AssistantStatus } from '../lib/api/meetings'
import { transcriptApi, streamTranscript } from '../lib/api/transcript'
import type { TranscriptSegment } from '../lib/api/transcript'

const SPEAKER_COLORS = ['#a78bfa', '#34d399', '#60a5fa', '#fbbf24', '#f472b6', '#22d3ee', '#fb923c', '#a3e635']

function speakerLabel(speaker: number | null, confidence: number | null): string {
  if (speaker === null || (confidence !== null && confidence < 0.3)) return 'Unknown Speaker'
  return `Speaker ${speaker + 1}`
}

function speakerColor(speaker: number | null): string {
  if (speaker === null) return 'rgba(255,255,255,0.35)'
  return SPEAKER_COLORS[speaker % SPEAKER_COLORS.length]
}

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

const LIVE_STATUSES: AssistantStatus[] = ['joining', 'in_progress']

interface SpeakerBlock {
  speaker: number | null
  confidence: number | null
  startMs: number
  text: string
}

/** Groups consecutive segments that share the same speaker into one block. */
function groupBySpeaker(segments: TranscriptSegment[]): SpeakerBlock[] {
  const blocks: SpeakerBlock[] = []
  for (const seg of segments) {
    const last = blocks[blocks.length - 1]
    if (last && last.speaker === seg.speaker) {
      last.text += ` ${seg.text}`
      last.confidence = seg.confidence
    } else {
      blocks.push({
        speaker: seg.speaker,
        confidence: seg.confidence,
        startMs: seg.startMs,
        text: seg.text,
      })
    }
  }
  return blocks
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const dateStr = s.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
  const startTime = s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const endTime = e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return `${dateStr} · ${startTime} – ${endTime}`
}

export default function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [segments, setSegments] = useState<TranscriptSegment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [live, setLive] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const autoScroll = useRef(true)

  // Merge a freshly arrived segment: a final replaces an overlapping interim.
  const mergeSegment = useCallback((incoming: TranscriptSegment) => {
    setSegments((prev) => {
      const next = prev.filter(
        (s) => !(s.isFinal === false && s.startMs === incoming.startMs && s.endMs === incoming.endMs),
      )
      // Drop any prior interim that this final supersedes by time overlap.
      const filtered = incoming.isFinal
        ? next.filter((s) => !(s.isFinal === false && s.startMs >= incoming.startMs && s.endMs <= incoming.endMs))
        : next
      return [...filtered, incoming].sort((a, b) => a.startMs - b.startMs)
    })
  }, [])

  const loadMeeting = useCallback(async () => {
    try {
      const all = await meetingsApi.getDashboard()
      setMeeting(all.find((m) => m.id === id) ?? null)
    } catch {
      // header is best-effort; transcript still renders
    }
  }, [id])

  const loadStored = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const stored = await transcriptApi.getStored(id)
      setSegments(stored)
    } catch {
      setError('Failed to load transcript.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void loadMeeting()
    void loadStored()
  }, [loadMeeting, loadStored])

  // Live SSE stream.
  useEffect(() => {
    if (!id) return
    const abort = new AbortController()
    let cancelled = false

    ;(async () => {
      try {
        setLive(true)
        for await (const seg of streamTranscript(id, abort.signal)) {
          if (cancelled) break
          mergeSegment(seg)
        }
      } catch {
        // stream closed or failed; stored transcript remains visible
      } finally {
        if (!cancelled) setLive(false)
      }
    })()

    return () => {
      cancelled = true
      abort.abort()
    }
  }, [id, mergeSegment])

  // Auto-scroll to bottom on new content unless the user scrolled up.
  useEffect(() => {
    const el = scrollRef.current
    if (el && autoScroll.current) el.scrollTop = el.scrollHeight
  }, [segments])

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    autoScroll.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  const blocks = groupBySpeaker(segments)

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col" style={{ height: 'calc(100vh - 4rem)' }}>
      {/* Header */}
      <button
        onClick={() => void navigate('/meetings/monitor')}
        className="flex items-center gap-1.5 text-xs mb-4 transition-colors hover:text-white"
        style={{ color: 'rgba(255,255,255,0.4)' }}
      >
        <ArrowLeft size={13} />
        Back to Monitor
      </button>

      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-white truncate">
            {meeting?.title ?? 'Meeting'}
          </h1>
          {meeting && (
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {formatDateRange(meeting.startTime, meeting.endTime)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {live && (
            <span
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
              style={{ color: '#34d399', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}
            >
              <Radio size={11} className="animate-pulse" />
              Live
            </span>
          )}
          {meeting?.meetLink && (
            <button
              onClick={() => window.open(meeting.meetLink!, '_blank')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all hover:opacity-90 active:scale-95"
              style={{ background: 'linear-gradient(135deg, #1a73e8, #0f9d58)' }}
            >
              <Video size={12} />
              Join
            </button>
          )}
        </div>
      </div>

      {/* Transcript panel */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto rounded-2xl p-5"
        style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div
              className="w-6 h-6 rounded-full border-2 animate-spin"
              style={{ borderColor: 'var(--color-brand-500)', borderTopColor: 'transparent' }}
            />
          </div>
        ) : error ? (
          <p className="text-sm text-center py-16" style={{ color: '#f87171' }}>{error}</p>
        ) : blocks.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <FileText size={32} style={{ color: 'rgba(255,255,255,0.1)' }} />
            <p className="text-sm font-medium text-white">
              {meeting && LIVE_STATUSES.includes(meeting.assistantStatus)
                ? 'Waiting for speech…'
                : 'No transcript yet'}
            </p>
            <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.35)' }}>
              The transcript appears here once the assistant is in the meeting and people start talking.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {blocks.map((block, i) => {
              const color = speakerColor(block.speaker)
              return (
                <div key={i} className="flex gap-3">
                  <div className="w-1 rounded-full shrink-0" style={{ background: color }} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold" style={{ color }}>
                        {speakerLabel(block.speaker, block.confidence)}
                      </span>
                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
                        {formatMs(block.startMs)}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.85)' }}>
                      {block.text}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
