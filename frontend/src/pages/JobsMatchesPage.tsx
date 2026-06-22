import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, ExternalLink, Bookmark, X, Copy, Check } from 'lucide-react'
import { jobsApi, type JobApplication } from '../lib/api/jobs'
import { ScoreBadge } from './JobsSetupPage'

export default function JobsMatchesPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<JobApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    jobsApi
      .listApplications('new')
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  const patch = (updated: JobApplication) =>
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))

  const remove = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id))

  const generateLetter = async (id: string) => {
    setBusyId(id)
    try {
      const updated = await jobsApi.generateCoverLetter(id)
      patch(updated)
      setExpandedId(id)
    } finally {
      setBusyId(null)
    }
  }

  const move = async (id: string, status: 'saved' | 'dismissed') => {
    setBusyId(id)
    try {
      await jobsApi.updateApplication(id, { status })
      remove(id)
    } finally {
      setBusyId(null)
    }
  }

  const copyLetter = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Matches</h1>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
          AI-scored jobs to review. Save the good ones to your board or dismiss the rest.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div
            className="w-6 h-6 rounded-full border-2 animate-spin"
            style={{ borderColor: 'var(--color-brand-500)', borderTopColor: 'transparent' }}
          />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-2 text-center">
          <Sparkles size={28} style={{ color: 'rgba(255,255,255,0.15)' }} />
          <p className="text-sm font-medium text-white/60">No new matches yet</p>
          <button
            onClick={() => void navigate('/jobs/setup')}
            className="text-xs underline mt-1"
            style={{ color: '#f59e0b' }}
          >
            Evaluate a job in Setup
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((job) => {
            const busy = busyId === job.id
            const expanded = expandedId === job.id
            return (
              <div key={job.id} className="rounded-2xl p-5" style={cardStyle}>
                <div className="flex gap-4">
                  <ScoreBadge score={job.matchScore} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-white text-sm truncate">
                          {job.title}
                        </h3>
                        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                          {job.company}
                          {job.location ? ` · ${job.location}` : ''}
                        </p>
                      </div>
                      {job.url && (
                        <a
                          href={job.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-xs shrink-0"
                          style={{ color: 'rgba(255,255,255,0.5)' }}
                        >
                          Open <ExternalLink size={12} />
                        </a>
                      )}
                    </div>

                    {job.matchSummary && (
                      <p className="text-xs mt-2 leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
                        {job.matchSummary}
                      </p>
                    )}

                    {(job.strengths.length > 0 || job.gaps.length > 0) && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {job.strengths.map((s, i) => (
                          <Chip key={`s${i}`} text={s} color="#10b981" />
                        ))}
                        {job.gaps.map((g, i) => (
                          <Chip key={`g${i}`} text={g} color="#f59e0b" />
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {expanded && job.coverLetter && (
                  <div
                    className="mt-4 rounded-xl p-4 relative"
                    style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
                  >
                    <button
                      onClick={() => void copyLetter(job.coverLetter ?? '')}
                      className="absolute top-3 right-3 flex items-center gap-1 text-xs"
                      style={{ color: 'rgba(255,255,255,0.5)' }}
                    >
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                    <p className="text-xs whitespace-pre-wrap leading-relaxed pr-16" style={{ color: 'rgba(255,255,255,0.75)' }}>
                      {job.coverLetter}
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-2 mt-4">
                  <button
                    onClick={() =>
                      job.coverLetter && expanded
                        ? setExpandedId(null)
                        : job.coverLetter
                          ? setExpandedId(job.id)
                          : void generateLetter(job.id)
                    }
                    disabled={busy}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
                    style={{ background: 'var(--color-surface-3)', color: 'white', border: '1px solid var(--color-border)' }}
                  >
                    <Sparkles size={13} />
                    {busy ? 'Working…' : job.coverLetter ? (expanded ? 'Hide cover letter' : 'View cover letter') : 'Generate cover letter'}
                  </button>
                  <button
                    onClick={() => void move(job.id, 'saved')}
                    disabled={busy}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
                    style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}
                  >
                    <Bookmark size={13} /> Save to board
                  </button>
                  <button
                    onClick={() => void move(job.id, 'dismissed')}
                    disabled={busy}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium ml-auto transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
                    style={{ color: 'rgba(255,255,255,0.45)' }}
                  >
                    <X size={13} /> Dismiss
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const cardStyle = {
  background: 'var(--color-surface-1)',
  border: '1px solid var(--color-border)',
} as const

function Chip({ text, color }: { text: string; color: string }) {
  return (
    <span
      className="text-[11px] px-2 py-0.5 rounded-full"
      style={{ background: `${color}1a`, color, border: `1px solid ${color}33` }}
    >
      {text}
    </span>
  )
}
