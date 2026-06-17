import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, RefreshCw, ExternalLink, Video, Users } from 'lucide-react'
import { meetingsApi } from '../lib/api/meetings'
import type { Meeting, SyncStatus } from '../lib/api/meetings'

type View = 'upcoming' | 'past' | 'all'

function formatDateRange(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const dateStr = s.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
  const startTime = s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const endTime = e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return `${dateStr} · ${startTime} – ${endTime}`
}

function formatRelative(iso: string | null): string {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
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
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
          +{overflow}
        </span>
      )}
    </div>
  )
}

function MeetingCard({ meeting }: { meeting: Meeting }) {
  const isOngoing = new Date(meeting.startTime) <= new Date() && new Date(meeting.endTime) >= new Date()

  return (
    <div
      className="rounded-xl p-4 flex gap-4"
      style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}
    >
      <div
        className="w-1 rounded-full shrink-0"
        style={{ background: isOngoing ? '#10b981' : 'var(--color-brand-500)' }}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{meeting.title}</p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {formatDateRange(meeting.startTime, meeting.endTime)}
              {isOngoing && (
                <span className="ml-2 px-1.5 py-0.5 rounded-full text-xs" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>
                  Live
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
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
            {meeting.htmlLink && (
              <a
                href={meeting.htmlLink}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg transition-all hover:opacity-70"
                style={{ color: 'rgba(255,255,255,0.3)' }}
              >
                <ExternalLink size={13} />
              </a>
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

export default function MeetingsPage() {
  const navigate = useNavigate()
  const [view, setView] = useState<View>('upcoming')
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<'no-google' | 'generic' | null>(null)

  const loadMeetings = useCallback(async (v: View) => {
    setLoading(true)
    setError(null)
    try {
      const [data, status] = await Promise.all([
        meetingsApi.list(v),
        meetingsApi.getSyncStatus(),
      ])
      setMeetings(data)
      setSyncStatus(status)
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      setError(status === 404 ? 'no-google' : 'generic')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadMeetings(view)
  }, [view, loadMeetings])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const status = await meetingsApi.triggerSync()
      setSyncStatus(status)
      await loadMeetings(view)
    } catch {
      // sync error is non-critical — refresh list anyway
      await loadMeetings(view)
    } finally {
      setSyncing(false)
    }
  }

  const TABS: { key: View; label: string }[] = [
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'past', label: 'Past' },
    { key: 'all', label: 'All' },
  ]

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Meetings</h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Synced from Google Calendar
          </p>
        </div>

        <div className="flex items-center gap-3">
          {syncStatus && (
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Last synced: {formatRelative(syncStatus.lastSyncedAt)}
            </span>
          )}
          <button
            onClick={() => void handleSync()}
            disabled={syncing || loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, var(--color-brand-600), #3b82f6)' }}
          >
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>
        </div>
      </div>

      {/* View tabs */}
      <div
        className="flex gap-1 p-1 rounded-xl mb-5 w-fit"
        style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}
      >
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
            style={
              view === key
                ? { background: 'var(--color-surface-3)', color: 'white' }
                : { color: 'rgba(255,255,255,0.4)' }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div
            className="w-6 h-6 rounded-full border-2 animate-spin"
            style={{ borderColor: 'var(--color-brand-500)', borderTopColor: 'transparent' }}
          />
        </div>
      ) : error === 'no-google' ? (
        <div
          className="flex flex-col items-center py-16 gap-3 rounded-2xl"
          style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}
        >
          <Calendar size={36} style={{ color: 'rgba(255,255,255,0.1)' }} />
          <p className="text-sm font-medium text-white">Google account not connected</p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Connect your Google account to start syncing meetings.
          </p>
          <button
            onClick={() => void navigate('/profile')}
            className="mt-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, var(--color-brand-600), #3b82f6)' }}
          >
            Go to Profile
          </button>
        </div>
      ) : meetings.length === 0 ? (
        <div
          className="flex flex-col items-center py-16 gap-3 rounded-2xl"
          style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}
        >
          <Calendar size={36} style={{ color: 'rgba(255,255,255,0.1)' }} />
          <p className="text-sm font-medium text-white">
            {view === 'upcoming' ? 'No upcoming meetings' : view === 'past' ? 'No past meetings' : 'No meetings found'}
          </p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {view === 'upcoming' ? 'Your next meetings will appear here after a sync.' : 'Try syncing to fetch the latest data.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {meetings.map((meeting) => (
            <MeetingCard key={meeting.id} meeting={meeting} />
          ))}
        </div>
      )}
    </div>
  )
}
