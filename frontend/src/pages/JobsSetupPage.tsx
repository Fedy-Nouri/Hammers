import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Upload, Sparkles, ArrowRight, Check } from 'lucide-react'
import { jobsApi, type JobProfile, type RemotePref, type JobApplication } from '../lib/api/jobs'

const REMOTE_OPTIONS: RemotePref[] = ['any', 'remote', 'hybrid', 'onsite']

function toList(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

const inputStyle = {
  background: 'var(--color-surface-2)',
  border: '1px solid var(--color-border)',
} as const

const cardStyle = {
  background: 'var(--color-surface-1)',
  border: '1px solid var(--color-border)',
} as const

export default function JobsSetupPage() {
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)

  const [profile, setProfile] = useState<JobProfile | null>(null)
  const [resumeLoading, setResumeLoading] = useState(false)

  // Preferences (kept as raw strings; split into arrays on save).
  const [titles, setTitles] = useState('')
  const [locations, setLocations] = useState('')
  const [remotePref, setRemotePref] = useState<RemotePref>('any')
  const [salaryMin, setSalaryMin] = useState('')
  const [keywords, setKeywords] = useState('')
  const [savingPrefs, setSavingPrefs] = useState(false)
  const [prefsSaved, setPrefsSaved] = useState(false)

  // Evaluate-a-job box.
  const [jobTitle, setJobTitle] = useState('')
  const [jobCompany, setJobCompany] = useState('')
  const [jobLocation, setJobLocation] = useState('')
  const [jobUrl, setJobUrl] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [evaluating, setEvaluating] = useState(false)
  const [lastResult, setLastResult] = useState<JobApplication | null>(null)
  const [evalError, setEvalError] = useState<string | null>(null)

  useEffect(() => {
    jobsApi
      .getProfile()
      .then((p) => {
        if (!p) return
        setProfile(p)
        setTitles(p.desiredTitles.join(', '))
        setLocations(p.locations.join(', '))
        setRemotePref(p.remotePref)
        setSalaryMin(p.salaryMin != null ? String(p.salaryMin) : '')
        setKeywords(p.keywords.join(', '))
      })
      .catch(() => undefined)
  }, [])

  const handleResume = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setResumeLoading(true)
    try {
      const updated = await jobsApi.uploadResume(file)
      setProfile(updated)
    } catch {
      // surfaced by the disabled/empty state
    } finally {
      setResumeLoading(false)
      e.target.value = ''
    }
  }

  const savePrefs = async () => {
    setSavingPrefs(true)
    setPrefsSaved(false)
    try {
      const updated = await jobsApi.setPreferences({
        desiredTitles: toList(titles),
        locations: toList(locations),
        remotePref,
        salaryMin: salaryMin ? Number(salaryMin) : undefined,
        keywords: toList(keywords),
      })
      setProfile(updated)
      setPrefsSaved(true)
      setTimeout(() => setPrefsSaved(false), 2000)
    } finally {
      setSavingPrefs(false)
    }
  }

  const evaluate = async () => {
    setEvalError(null)
    setLastResult(null)
    setEvaluating(true)
    try {
      const result = await jobsApi.ingest({
        url: jobUrl || undefined,
        title: jobTitle,
        company: jobCompany,
        location: jobLocation || undefined,
        description: jobDescription,
      })
      setLastResult(result)
      setJobTitle('')
      setJobCompany('')
      setJobLocation('')
      setJobUrl('')
      setJobDescription('')
    } catch {
      setEvalError('Could not evaluate this job. Make sure you have uploaded a resume.')
    } finally {
      setEvaluating(false)
    }
  }

  const hasResume = Boolean(profile?.resumeUrl)
  const canEvaluate =
    hasResume && jobTitle.trim() && jobCompany.trim() && jobDescription.trim().length >= 20

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Job Hunter setup</h1>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Upload your resume, set your preferences, then evaluate a job to see how well it fits.
        </p>
      </div>

      {/* Resume */}
      <section className="rounded-2xl p-6 mb-5" style={cardStyle}>
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}
          >
            <FileText size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-white text-sm">Resume</h2>
            <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {hasResume ? 'Resume uploaded — used for AI scoring & cover letters.' : 'No resume yet (PDF, max 10MB).'}
            </p>
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={resumeLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
            style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)' }}
          >
            {resumeLoading ? (
              <span
                className="w-4 h-4 rounded-full border-2 animate-spin"
                style={{ borderColor: 'white', borderTopColor: 'transparent' }}
              />
            ) : (
              <Upload size={14} />
            )}
            {hasResume ? 'Replace' : 'Upload'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={handleResume}
          />
        </div>
      </section>

      {/* Preferences */}
      <section className="rounded-2xl p-6 mb-5" style={cardStyle}>
        <h2 className="font-semibold text-white text-sm mb-4">Preferences</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Desired titles (comma-separated)">
            <input
              value={titles}
              onChange={(e) => setTitles(e.target.value)}
              placeholder="Senior Backend Engineer, Platform Engineer"
              className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none placeholder:text-white/25"
              style={inputStyle}
            />
          </Field>
          <Field label="Locations (comma-separated)">
            <input
              value={locations}
              onChange={(e) => setLocations(e.target.value)}
              placeholder="Berlin, Remote (EU)"
              className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none placeholder:text-white/25"
              style={inputStyle}
            />
          </Field>
          <Field label="Remote preference">
            <select
              value={remotePref}
              onChange={(e) => setRemotePref(e.target.value as RemotePref)}
              className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none capitalize"
              style={inputStyle}
            >
              {REMOTE_OPTIONS.map((o) => (
                <option key={o} value={o} style={{ background: 'var(--color-surface-2)' }}>
                  {o}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Minimum salary">
            <input
              value={salaryMin}
              onChange={(e) => setSalaryMin(e.target.value.replace(/[^0-9]/g, ''))}
              inputMode="numeric"
              placeholder="80000"
              className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none placeholder:text-white/25"
              style={inputStyle}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Keywords (comma-separated)">
              <input
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="NestJS, TypeScript, Kubernetes"
                className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none placeholder:text-white/25"
                style={inputStyle}
              />
            </Field>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={() => void savePrefs()}
            disabled={savingPrefs}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, var(--color-brand-600), #3b82f6)' }}
          >
            {savingPrefs ? 'Saving…' : 'Save preferences'}
          </button>
          {prefsSaved && (
            <span className="flex items-center gap-1 text-xs" style={{ color: '#10b981' }}>
              <Check size={13} /> Saved
            </span>
          )}
        </div>
      </section>

      {/* Evaluate a job */}
      <section className="rounded-2xl p-6" style={cardStyle}>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={16} style={{ color: '#f59e0b' }} />
          <h2 className="font-semibold text-white text-sm">Evaluate a job</h2>
        </div>
        <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Paste a job (e.g. from LinkedIn) to score it against your resume.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Title">
            <input
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
              style={inputStyle}
            />
          </Field>
          <Field label="Company">
            <input
              value={jobCompany}
              onChange={(e) => setJobCompany(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
              style={inputStyle}
            />
          </Field>
          <Field label="Location (optional)">
            <input
              value={jobLocation}
              onChange={(e) => setJobLocation(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
              style={inputStyle}
            />
          </Field>
          <Field label="URL (optional)">
            <input
              value={jobUrl}
              onChange={(e) => setJobUrl(e.target.value)}
              placeholder="https://www.linkedin.com/jobs/view/…"
              className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none placeholder:text-white/25"
              style={inputStyle}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description">
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                rows={6}
                placeholder="Paste the job description here…"
                className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none resize-y placeholder:text-white/25"
                style={inputStyle}
              />
            </Field>
          </div>
        </div>

        {!hasResume && (
          <p className="text-xs mt-3" style={{ color: '#f59e0b' }}>
            Upload a resume first to evaluate jobs.
          </p>
        )}
        {evalError && (
          <p className="text-xs mt-3" style={{ color: '#f87171' }}>
            {evalError}
          </p>
        )}

        <button
          onClick={() => void evaluate()}
          disabled={!canEvaluate || evaluating}
          className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-30"
          style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)' }}
        >
          {evaluating ? 'Evaluating…' : 'Evaluate job'}
          {!evaluating && <Sparkles size={14} />}
        </button>

        {lastResult && (
          <div
            className="mt-5 rounded-xl p-4 flex items-center gap-4"
            style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
          >
            <ScoreBadge score={lastResult.matchScore} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {lastResult.title} · {lastResult.company}
              </p>
              <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {lastResult.matchSummary ?? 'Scored and added to your matches.'}
              </p>
            </div>
            <button
              onClick={() => void navigate('/jobs/matches')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold shrink-0 transition-all hover:opacity-90 active:scale-95"
              style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}
            >
              View matches <ArrowRight size={12} />
            </button>
          </div>
        )}
      </section>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>
        {label}
      </span>
      {children}
    </label>
  )
}

export function ScoreBadge({ score }: { score: number | null }) {
  const value = score ?? null
  const color = value == null ? '#9ca3af' : value >= 75 ? '#10b981' : value >= 50 ? '#f59e0b' : '#f87171'
  return (
    <div
      className="w-14 h-14 rounded-xl flex flex-col items-center justify-center shrink-0"
      style={{ background: `${color}1a`, color, border: `1px solid ${color}33` }}
    >
      <span className="text-lg font-bold leading-none">{value ?? '—'}</span>
      <span className="text-[10px] uppercase tracking-wide opacity-70">score</span>
    </div>
  )
}
