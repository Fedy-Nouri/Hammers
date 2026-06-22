import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExternalLink, FileText, X, Copy, Check } from 'lucide-react'
import { jobsApi, type JobApplication, type JobStatus } from '../lib/api/jobs'

const COLUMNS = [
  { key: 'saved', label: 'Saved', color: '#f59e0b' },
  { key: 'applied', label: 'Applied', color: '#3b82f6' },
  { key: 'interview', label: 'Interview', color: '#8b5cf6' },
  { key: 'offer', label: 'Offer', color: '#10b981' },
  { key: 'rejected', label: 'Rejected', color: '#f87171' },
] as const

type BoardStatus = (typeof COLUMNS)[number]['key']

const BOARD_KEYS = COLUMNS.map((c) => c.key) as BoardStatus[]

export default function JobsBoardPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<JobApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [viewing, setViewing] = useState<JobApplication | null>(null)

  const load = () =>
    jobsApi
      .listApplications()
      .then((all) => setItems(all.filter((j) => BOARD_KEYS.includes(j.status as BoardStatus))))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))

  useEffect(() => {
    void load()
  }, [])

  const changeStatus = async (id: string, status: JobStatus) => {
    setItems((prev) =>
      status === 'dismissed'
        ? prev.filter((i) => i.id !== id)
        : prev.map((i) => (i.id === id ? { ...i, status } : i)),
    )
    try {
      await jobsApi.updateApplication(id, { status })
    } catch {
      void load() // reconcile on failure
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Board</h1>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Track your applications. Move a card as you progress; apply on the source site.
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
          <p className="text-sm font-medium text-white/60">No saved applications yet</p>
          <button
            onClick={() => void navigate('/jobs/matches')}
            className="text-xs underline mt-1"
            style={{ color: '#f59e0b' }}
          >
            Save jobs from Matches
          </button>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {COLUMNS.map((col) => {
            const cards = items.filter((i) => i.status === col.key)
            return (
              <div key={col.key} className="flex-1 min-w-[220px]">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                  <span className="text-sm font-semibold text-white">{col.label}</span>
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    {cards.length}
                  </span>
                </div>
                <div
                  className="flex flex-col gap-2 rounded-xl p-2 min-h-[120px]"
                  style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}
                >
                  {cards.length === 0 ? (
                    <p className="text-xs text-center py-6" style={{ color: 'rgba(255,255,255,0.2)' }}>
                      Empty
                    </p>
                  ) : (
                    cards.map((job) => (
                      <Card
                        key={job.id}
                        job={job}
                        onStatus={(s) => void changeStatus(job.id, s)}
                        onView={() => setViewing(job)}
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {viewing && <CoverLetterModal job={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}

function Card({
  job,
  onStatus,
  onView,
}: {
  job: JobApplication
  onStatus: (status: JobStatus) => void
  onView: () => void
}) {
  const scoreColor =
    job.matchScore == null
      ? '#9ca3af'
      : job.matchScore >= 75
        ? '#10b981'
        : job.matchScore >= 50
          ? '#f59e0b'
          : '#f87171'

  return (
    <div
      className="rounded-lg p-3"
      style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-white leading-snug">{job.title}</p>
        {job.matchScore != null && (
          <span className="text-xs font-bold shrink-0" style={{ color: scoreColor }}>
            {job.matchScore}
          </span>
        )}
      </div>
      <p className="text-[11px] mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.45)' }}>
        {job.company}
      </p>

      <div className="flex items-center gap-2 mt-2.5">
        {job.url && (
          <a
            href={job.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-[11px]"
            style={{ color: 'rgba(255,255,255,0.5)' }}
          >
            Open <ExternalLink size={11} />
          </a>
        )}
        {job.coverLetter && (
          <button
            onClick={onView}
            className="flex items-center gap-1 text-[11px]"
            style={{ color: 'rgba(255,255,255,0.5)' }}
          >
            <FileText size={11} /> Letter
          </button>
        )}
      </div>

      <select
        value={job.status}
        onChange={(e) => onStatus(e.target.value as JobStatus)}
        className="w-full mt-2.5 rounded-md px-2 py-1 text-[11px] text-white outline-none"
        style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)' }}
      >
        {COLUMNS.map((c) => (
          <option key={c.key} value={c.key} style={{ background: 'var(--color-surface-3)' }}>
            {c.label}
          </option>
        ))}
        <option value="dismissed" style={{ background: 'var(--color-surface-3)' }}>
          Remove
        </option>
      </select>
    </div>
  )
}

function CoverLetterModal({ job, onClose }: { job: JobApplication; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(job.coverLetter ?? '')
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl p-6 max-h-[80vh] overflow-y-auto"
        style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-white text-sm truncate">{job.title}</h3>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {job.company}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => void copy()}
              className="flex items-center gap-1 text-xs"
              style={{ color: 'rgba(255,255,255,0.5)' }}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button onClick={onClose} style={{ color: 'rgba(255,255,255,0.5)' }}>
              <X size={16} />
            </button>
          </div>
        </div>
        <p className="text-xs whitespace-pre-wrap leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>
          {job.coverLetter}
        </p>
      </div>
    </div>
  )
}
