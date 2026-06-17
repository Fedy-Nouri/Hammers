import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, RefreshCw, Bot, Video, Users } from 'lucide-react'
import { meetingsApi } from '../lib/api/meetings'
import type { Meeting, AssistantStatus } from '../lib/api/meetings'

type FilterKey = AssistantStatus | 'all'

const STATUS_CONFIG: Record<AssistantStatus, { label: string; color: string; bg: string; border: string }> = {
  none:        { label: 'None',        color: 'rgba(255,255,255,0.3)',  bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.08)' },
  scheduled:   { label: 'Scheduled',   color: '#a78bfa',                bg: 'rgba(139,92,246,0.12)',  border: 'rgba(139,92,246,0.25)' },
  joining:     { label: 'Joining',     color: '#fbbf24',                bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.25)' },
  in_progress: { label: 'In Progress', color: '#34d399',                bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)' },
  processing:  { label: 'Processing',  color: '#60a5fa',                bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.25)' },
  completed:   { label: 'Completed',   color: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.1)' },
  failed:      { label: 'Failed',      color: '#f87171',                bg: 'rgba(248,113,113,0.12)',border: 'rgba(248,113,113,0.25)' },
}

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',        label: 'All' },
  { key: 'scheduled',  label: 'Scheduled' },
  { key: 'joining',    label: 'Joining' },
  { key: 'in_progress',label: 'In Progress' },
  { key: 'processing', label: 'Processing' },
  { key: 'completed',  label: 'Completed' },
  { key: 'failed',     label: 'Failed' },
]

function StatusBadge({ status }: { status: AssistantStatus }) {
  const c = STATUS_CONFIG[status]
  return (
    <span
      className="px-2.5 py-1 rounded-lg text-xs font-medium"
      style={{ color: c.color, background: c.bg, border: `1px solid ${c.border}` }}
    >
      {c.label}
    </span>
  )
}

function AttendeeAvatars({ attendees }: { attendees: string[] }) {
  const visible = attendees.slice(0, 4)
  const overflow = attendees.length - visible.length
  return (
    <div className="flex items-center gap-1">
      {visible.map((email) => (
        <div
          key={email}
          title={email}
          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold"
          style={{ background: 'var(--color-surface-3)', color: 'rgba(255,255,255,0.7)', border: '1px solid var(--color-border)' }}
        >
          {email[0].toUpperCase()}
        </div>
      ))}
      {overflow > 0 && (
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>+{overflow}</span>
      )}
    </div>
  )
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const dateStr = s.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
  const startTime = s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const endTime = e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return `${dateStr} · ${startTime} – ${endTime}`
}

function MonitorCard({ meeting }: { meeting: Meeting }) {
  const accentColor = STATUS_CONFIG[meeting.assistantStatus]?.color ?? 'var(--color-border)'

  return (
    <div
      className="rounded-xl p-4 flex gap-4"
      style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}
    >
      <div
        className="w-1 rounded-full shrink-0"
        style={{ background: accentColor }}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{meeting.title}</p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {formatDateRange(meeting.startTime, meeting.endTime)}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <StatusBadge status={meeting.assistantStatus} />
            {meeting.meetLink && (
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

        {meeting.attendees.length > 0 && (
          <div className="flex items-center gap-2 mt-2.5">
            <Users size={11} style={{ color: 'rgba(255,255,255,0.25)' }} />
            <AttendeeAvatars attendees={meeting.attendees} />
          </div>
        )}
      </div>
    </div>
  )
}

function formatSecondsAgo(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000)
  if (secs < 5) return 'Just now'
  if (secs < 60) return `${secs}s ago`
  return `${Math.floor(secs / 60)}m ago`
}

export default function MeetingMonitorPage() {
  const navigate = useNavigate()
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<FilterKey>('all')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [, setTick] = useState(0)

  const loadDashboard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      const data = await meetingsApi.getDashboard()
      setMeetings(data)
      setLastUpdated(new Date())
    } catch {
      setError('Failed to load dashboard. Please try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadDashboard(false)
    const refreshId = setInterval(() => void loadDashboard(true), 30_000)
    return () => clearInterval(refreshId)
  }, [loadDashboard])

  useEffect(() => {
    const tickId = setInterval(() => setTick((t) => t + 1), 1_000)
    return () => clearInterval(tickId)
  }, [])

  const filteredMeetings =
    filterStatus === 'all' ? meetings : meetings.filter((m) => m.assistantStatus === filterStatus)

  const countByStatus = (key: FilterKey) =>
    key === 'all' ? meetings.length : meetings.filter((m) => m.assistantStatus === key).length

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Activity size={18} style={{ color: 'var(--color-brand-400)' }} />
            <h1 className="text-2xl font-bold text-white">Meeting Monitor</h1>
          </div>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Live assistant status · auto-refreshes every 30s
          </p>
        </div>

        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Updated {formatSecondsAgo(lastUpdated)}
            </span>
          )}
          <button
            onClick={() => void loadDashboard(false)}
            disabled={loading || refreshing}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, var(--color-brand-600), #3b82f6)' }}
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap mb-5">
        {FILTERS.map(({ key, label }) => {
          const count = countByStatus(key)
          const active = filterStatus === key
          return (
            <button
              key={key}
              onClick={() => setFilterStatus(key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={
                active
                  ? { background: 'var(--color-surface-3)', color: 'white', border: '1px solid var(--color-border-hover)' }
                  : { background: 'var(--color-surface-1)', color: 'rgba(255,255,255,0.45)', border: '1px solid var(--color-border)' }
              }
            >
              {label}
              {count > 0 && (
                <span
                  className="px-1.5 py-0.5 rounded-full text-xs"
                  style={{ background: active ? 'rgba(255,255,255,0.15)' : 'var(--color-surface-2)', color: active ? 'white' : 'rgba(255,255,255,0.4)' }}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div
            className="w-6 h-6 rounded-full border-2 animate-spin"
            style={{ borderColor: 'var(--color-brand-500)', borderTopColor: 'transparent' }}
          />
        </div>
      ) : error ? (
        <div
          className="flex flex-col items-center py-16 gap-3 rounded-2xl"
          style={{ background: 'var(--color-surface-1)', border: '1px solid rgba(248,113,113,0.2)' }}
        >
          <p className="text-sm" style={{ color: '#f87171' }}>{error}</p>
          <button
            onClick={() => void loadDashboard(false)}
            className="text-xs underline"
            style={{ color: 'rgba(255,255,255,0.4)' }}
          >
            Try again
          </button>
        </div>
      ) : meetings.length === 0 ? (
        <div
          className="flex flex-col items-center py-16 gap-3 rounded-2xl"
          style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}
        >
          <Bot size={36} style={{ color: 'rgba(255,255,255,0.1)' }} />
          <p className="text-sm font-medium text-white">No meetings being monitored</p>
          <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Invite the assistant to a meeting first.
          </p>
          <button
            onClick={() => void navigate('/meetings')}
            className="mt-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, var(--color-brand-600), #3b82f6)' }}
          >
            Go to Meetings
          </button>
        </div>
      ) : filteredMeetings.length === 0 ? (
        <div
          className="flex flex-col items-center py-12 gap-2 rounded-2xl"
          style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}
        >
          <p className="text-sm text-white">No meetings with status "{filterStatus}"</p>
          <button
            onClick={() => setFilterStatus('all')}
            className="text-xs underline mt-1"
            style={{ color: 'rgba(255,255,255,0.4)' }}
          >
            Show all
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredMeetings.map((meeting) => (
            <MonitorCard key={meeting.id} meeting={meeting} />
          ))}
        </div>
      )}
    </div>
  )
}
