import { useState, useEffect, useCallback, useRef } from 'react'
import type { ReactNode } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Video,
  Radio,
  FileText,
  Sparkles,
  ListTodo,
  Gavel,
  AlertTriangle,
  Pencil,
  Check,
  X,
} from 'lucide-react'
import { meetingsApi } from '../lib/api/meetings'
import type { Meeting, AssistantStatus } from '../lib/api/meetings'
import { transcriptApi, streamTranscript } from '../lib/api/transcript'
import type { TranscriptSegment } from '../lib/api/transcript'
import { analysisApi } from '../lib/api/analysis'
import type { ActionItem, MeetingAnalysis, RiskCategory } from '../lib/api/analysis'

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

const RISK_STYLES: Record<RiskCategory, { color: string; bg: string; label: string }> = {
  risk: { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', label: 'Risk' },
  blocker: { color: '#f87171', bg: 'rgba(248,113,113,0.12)', label: 'Blocker' },
  dependency: { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)', label: 'Dependency' },
}

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
  const [analysis, setAnalysis] = useState<MeetingAnalysis | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const autoScroll = useRef(true)
  const blockRefs = useRef<Map<number, HTMLDivElement>>(new Map())

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

  const loadAnalysis = useCallback(async () => {
    if (!id) return
    try {
      setAnalysis(await analysisApi.get(id))
    } catch {
      // analysis is best-effort; transcript still renders
    }
  }, [id])

  useEffect(() => {
    void loadMeeting()
    void loadStored()
    void loadAnalysis()
  }, [loadMeeting, loadStored, loadAnalysis])

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

  // Poll the rolling analysis. Faster while live, slower once the meeting ends.
  useEffect(() => {
    if (!id) return
    const period = live ? 30_000 : 60_000
    const timer = setInterval(() => void loadAnalysis(), period)
    return () => clearInterval(timer)
  }, [id, live, loadAnalysis])

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

  // Scroll the transcript to the block nearest a given timestamp (risk refs).
  const scrollToMs = useCallback((ms: number) => {
    let bestKey: number | null = null
    for (const key of blockRefs.current.keys()) {
      if (key <= ms && (bestKey === null || key > bestKey)) bestKey = key
    }
    const el = bestKey !== null ? blockRefs.current.get(bestKey) : undefined
    if (el) {
      autoScroll.current = false
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [])

  const handleActionItemUpdate = useCallback(
    async (itemId: string, patch: Parameters<typeof analysisApi.updateActionItem>[2]) => {
      if (!id) return
      const updated = await analysisApi.updateActionItem(id, itemId, patch)
      setAnalysis((prev) =>
        prev
          ? { ...prev, actionItems: prev.actionItems.map((a) => (a.id === itemId ? updated : a)) }
          : prev,
      )
    },
    [id],
  )

  const blocks = groupBySpeaker(segments)

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col" style={{ height: 'calc(100vh - 4rem)' }}>
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

      <div className="flex-1 min-h-0 grid gap-4 lg:grid-cols-[1fr_380px]">
        {/* Transcript panel */}
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="overflow-y-auto rounded-2xl p-5 min-h-0"
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
                  <div
                    key={i}
                    ref={(el) => {
                      if (el) blockRefs.current.set(block.startMs, el)
                    }}
                    className="flex gap-3"
                  >
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

        {/* Insights panel */}
        <div
          className="overflow-y-auto rounded-2xl p-5 min-h-0 flex flex-col gap-6"
          style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}
        >
          <InsightsPanel
            analysis={analysis}
            onScrollToMs={scrollToMs}
            onUpdateActionItem={handleActionItemUpdate}
          />
        </div>
      </div>
    </div>
  )
}

interface InsightsPanelProps {
  analysis: MeetingAnalysis | null
  onScrollToMs: (ms: number) => void
  onUpdateActionItem: (
    itemId: string,
    patch: Parameters<typeof analysisApi.updateActionItem>[2],
  ) => Promise<void>
}

function InsightsPanel({ analysis, onScrollToMs, onUpdateActionItem }: InsightsPanelProps) {
  if (!analysis) {
    return (
      <div className="flex flex-col items-center py-16 gap-3">
        <Sparkles size={28} style={{ color: 'rgba(255,255,255,0.1)' }} />
        <p className="text-sm font-medium text-white">Insights</p>
        <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.35)' }}>
          Summary, action items, decisions, and risks appear here as the meeting progresses.
        </p>
      </div>
    )
  }

  const { summary, updatedAt, actionItems, decisions, risks } = analysis
  const visibleActions = actionItems.filter((a) => a.status !== 'dismissed')

  return (
    <>
      {/* Summary */}
      <Section icon={<Sparkles size={13} />} title="Summary">
        {summary ? (
          <>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.85)' }}>
              {summary}
            </p>
            {updatedAt && (
              <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Updated {new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </>
        ) : (
          <Empty text="No summary yet." />
        )}
      </Section>

      {/* Action items */}
      <Section icon={<ListTodo size={13} />} title="Action Items" count={visibleActions.length}>
        {visibleActions.length === 0 ? (
          <Empty text="No action items detected." />
        ) : (
          <div className="flex flex-col gap-2">
            {visibleActions.map((item) => (
              <ActionItemRow key={item.id} item={item} onUpdate={onUpdateActionItem} />
            ))}
          </div>
        )}
      </Section>

      {/* Decisions */}
      <Section icon={<Gavel size={13} />} title="Decisions" count={decisions.length}>
        {decisions.length === 0 ? (
          <Empty text="No decisions captured." />
        ) : (
          <div className="flex flex-col gap-2">
            {decisions.map((d) => (
              <div key={d.id} className="flex gap-2">
                <div className="w-1 rounded-full shrink-0" style={{ background: '#34d399' }} />
                <p className="text-sm leading-snug" style={{ color: 'rgba(255,255,255,0.85)' }}>
                  {d.text}
                </p>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Risks & blockers */}
      <Section icon={<AlertTriangle size={13} />} title="Risks & Blockers" count={risks.length}>
        {risks.length === 0 ? (
          <Empty text="No risks or blockers raised." />
        ) : (
          <div className="flex flex-col gap-2">
            {risks.map((r) => {
              const style = RISK_STYLES[r.category]
              return (
                <div
                  key={r.id}
                  className="rounded-lg p-2.5"
                  style={{ background: style.bg, border: `1px solid ${style.color}33` }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
                      style={{ color: style.color, background: `${style.color}1f` }}
                    >
                      {style.label}
                    </span>
                    {r.transcriptRefMs !== null && (
                      <button
                        onClick={() => onScrollToMs(r.transcriptRefMs!)}
                        className="text-xs transition-colors hover:text-white"
                        style={{ color: 'rgba(255,255,255,0.4)' }}
                        title="Jump to transcript"
                      >
                        {formatMs(r.transcriptRefMs)}
                      </button>
                    )}
                  </div>
                  <p className="text-sm leading-snug" style={{ color: 'rgba(255,255,255,0.85)' }}>
                    {r.text}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </Section>
    </>
  )
}

function Section({
  icon,
  title,
  count,
  children,
}: {
  icon: ReactNode
  title: string
  count?: number
  children: ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2.5">
        <span style={{ color: 'var(--color-brand-500)' }}>{icon}</span>
        <h2 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.5)' }}>
          {title}
        </h2>
        {count !== undefined && count > 0 && (
          <span
            className="text-[10px] font-semibold px-1.5 rounded-full"
            style={{ color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.08)' }}
          >
            {count}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
      {text}
    </p>
  )
}

function ActionItemRow({
  item,
  onUpdate,
}: {
  item: ActionItem
  onUpdate: (itemId: string, patch: Parameters<typeof analysisApi.updateActionItem>[2]) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [task, setTask] = useState(item.task)
  const [assignee, setAssignee] = useState(item.assignee ?? '')
  const [busy, setBusy] = useState(false)

  const done = item.status === 'done'

  const toggleDone = async () => {
    setBusy(true)
    try {
      await onUpdate(item.id, { status: done ? 'open' : 'done' })
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    if (!task.trim()) return
    setBusy(true)
    try {
      await onUpdate(item.id, { task: task.trim(), assignee: assignee.trim() || null })
      setEditing(false)
    } finally {
      setBusy(false)
    }
  }

  const cancel = () => {
    setTask(item.task)
    setAssignee(item.assignee ?? '')
    setEditing(false)
  }

  if (editing) {
    return (
      <div
        className="rounded-lg p-2.5 flex flex-col gap-2"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)' }}
      >
        <input
          value={task}
          onChange={(e) => setTask(e.target.value)}
          className="w-full text-sm rounded-md px-2 py-1.5 text-white outline-none"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--color-border)' }}
          placeholder="Task"
        />
        <input
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          className="w-full text-sm rounded-md px-2 py-1.5 text-white outline-none"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--color-border)' }}
          placeholder="Assignee (optional)"
        />
        <div className="flex items-center gap-1.5 justify-end">
          <button
            onClick={cancel}
            disabled={busy}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors hover:text-white"
            style={{ color: 'rgba(255,255,255,0.5)' }}
          >
            <X size={12} />
            Cancel
          </button>
          <button
            onClick={() => void save()}
            disabled={busy || !task.trim()}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-md text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ background: 'var(--color-brand-500)' }}
          >
            <Check size={12} />
            Save
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="group rounded-lg p-2.5 flex items-start gap-2.5"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)' }}
    >
      <button
        onClick={() => void toggleDone()}
        disabled={busy}
        className="mt-0.5 shrink-0 w-4 h-4 rounded flex items-center justify-center transition-colors"
        style={{
          border: `1.5px solid ${done ? '#34d399' : 'rgba(255,255,255,0.3)'}`,
          background: done ? '#34d399' : 'transparent',
        }}
        title={done ? 'Mark as open' : 'Mark as done'}
      >
        {done && <Check size={11} color="#0b0b0f" strokeWidth={3} />}
      </button>

      <div className="min-w-0 flex-1">
        <p
          className="text-sm leading-snug"
          style={{
            color: done ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.85)',
            textDecoration: done ? 'line-through' : 'none',
          }}
        >
          {item.task}
        </p>
        <div className="flex items-center gap-2 mt-1">
          {item.assignee && (
            <span
              className="text-[11px] px-1.5 py-0.5 rounded"
              style={{ color: '#a78bfa', background: 'rgba(167,139,250,0.12)' }}
            >
              {item.assignee}
            </span>
          )}
          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {Math.round(item.confidence * 100)}% confidence
          </span>
        </div>
      </div>

      <button
        onClick={() => setEditing(true)}
        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/10"
        style={{ color: 'rgba(255,255,255,0.5)' }}
        title="Edit"
      >
        <Pencil size={12} />
      </button>
    </div>
  )
}
