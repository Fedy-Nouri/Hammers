import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  Save,
} from 'lucide-react'
import { reportApi } from '../lib/api/report'
import type { MeetingReportData } from '../lib/api/report'

function fmtMs(ms: number): string {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2
        className="text-xs font-semibold uppercase tracking-widest mb-3"
        style={{ color: 'rgba(255,255,255,0.35)' }}
      >
        {title}
      </h2>
      {children}
    </section>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-5"
      style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}
    >
      {children}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'open')
    return (
      <span
        className="text-xs px-1.5 py-0.5 rounded"
        style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc' }}
      >
        open
      </span>
    )
  if (status === 'done')
    return (
      <span
        className="text-xs px-1.5 py-0.5 rounded"
        style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}
      >
        done
      </span>
    )
  return (
    <span
      className="text-xs px-1.5 py-0.5 rounded"
      style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' }}
    >
      {status}
    </span>
  )
}

function RiskBadge({ category }: { category: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    blocker: { bg: 'rgba(239,68,68,0.15)', color: '#fca5a5' },
    dependency: { bg: 'rgba(59,130,246,0.15)', color: '#93c5fd' },
    risk: { bg: 'rgba(245,158,11,0.15)', color: '#fcd34d' },
  }
  const s = styles[category] ?? styles.risk
  return (
    <span
      className="text-xs px-1.5 py-0.5 rounded"
      style={{ background: s.bg, color: s.color }}
    >
      {category}
    </span>
  )
}

function GeneratingState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <Loader2 size={32} className="animate-spin" style={{ color: 'var(--color-brand-500)' }} />
      <div className="text-center">
        <p className="text-sm font-medium text-white">Generating report…</p>
        <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
          This usually takes 15–30 seconds
        </p>
      </div>
    </div>
  )
}

function FailedState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <AlertCircle size={32} style={{ color: '#f87171' }} />
      <div className="text-center">
        <p className="text-sm font-medium text-white">Report generation failed</p>
        <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
          The AI could not generate a report for this meeting.
        </p>
      </div>
      <button
        onClick={onRetry}
        className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
        style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'rgba(255,255,255,0.7)' }}
      >
        Reload
      </button>
    </div>
  )
}

export default function MeetingReportPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<MeetingReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [transcriptOpen, setTranscriptOpen] = useState(false)
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    try {
      const d = await reportApi.get(id)
      setData(d)
      if (d.email && !emailSubject && !emailBody) {
        setEmailSubject(d.email.subject)
        setEmailBody(d.email.body)
      }
      return d
    } catch {
      // keep existing data on error
    }
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void (async () => {
      setLoading(true)
      const d = await load()
      setLoading(false)

      const status = d?.report?.status
      if (status === 'pending' || status === 'generating') {
        pollRef.current = setInterval(() => {
          void load().then((fresh) => {
            if (fresh?.report?.status === 'ready' || fresh?.report?.status === 'failed') {
              if (pollRef.current) clearInterval(pollRef.current)
              if (fresh.email) {
                setEmailSubject(fresh.email.subject)
                setEmailBody(fresh.email.body)
              }
            }
          })
        }, 10_000)
      }
    })()
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveEmail = async () => {
    if (!id) return
    setSaving(true)
    try {
      await reportApi.updateEmail(id, { subject: emailSubject, body: emailBody })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const copyEmail = async () => {
    const text = `Subject: ${emailSubject}\n\n${emailBody}`
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const reportStatus = data?.report?.status

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-10 flex items-center gap-3 px-6 py-4 border-b"
        style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
      >
        <button
          onClick={() => navigate(`/meetings/${id ?? ''}`)}
          className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70"
          style={{ color: 'rgba(255,255,255,0.5)' }}
        >
          <ArrowLeft size={15} />
          Transcript
        </button>
        <span style={{ color: 'rgba(255,255,255,0.2)' }}>/</span>
        <span className="text-sm font-medium text-white">Meeting Report</span>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col gap-8">
        {loading ? (
          <GeneratingState />
        ) : !reportStatus || reportStatus === 'pending' || reportStatus === 'generating' ? (
          <GeneratingState />
        ) : reportStatus === 'failed' ? (
          <FailedState onRetry={() => void load()} />
        ) : (
          <>
            {/* Executive Summary */}
            <Section title="Executive Summary">
              <Card>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  {data?.report?.executive || 'No summary available.'}
                </p>
              </Card>
            </Section>

            {/* Action Items + Decisions + Risks */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Section title="Action Items">
                <Card>
                  {data?.actionItems && data.actionItems.length > 0 ? (
                    <ul className="flex flex-col gap-3">
                      {data.actionItems.map((item) => (
                        <li key={item.id} className="flex flex-col gap-1">
                          <span className="text-sm text-white leading-snug">{item.task}</span>
                          <div className="flex items-center gap-2">
                            {item.assignee && (
                              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                                {item.assignee}
                              </span>
                            )}
                            <StatusBadge status={item.status} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      None detected
                    </p>
                  )}
                </Card>
              </Section>

              <Section title="Decisions">
                <Card>
                  {data?.decisions && data.decisions.length > 0 ? (
                    <ul className="flex flex-col gap-2">
                      {data.decisions.map((d) => (
                        <li
                          key={d.id}
                          className="text-sm leading-snug"
                          style={{ color: 'rgba(255,255,255,0.8)' }}
                        >
                          {d.text}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      None detected
                    </p>
                  )}
                </Card>
              </Section>

              <Section title="Risks">
                <Card>
                  {data?.risks && data.risks.length > 0 ? (
                    <ul className="flex flex-col gap-3">
                      {data.risks.map((r) => (
                        <li key={r.id} className="flex flex-col gap-1">
                          <span
                            className="text-sm leading-snug"
                            style={{ color: 'rgba(255,255,255,0.8)' }}
                          >
                            {r.text}
                          </span>
                          <RiskBadge category={r.category} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      None detected
                    </p>
                  )}
                </Card>
              </Section>
            </div>

            {/* Follow-Ups */}
            {data?.report?.followUps && data.report.followUps.length > 0 && (
              <Section title="Follow-Ups">
                <Card>
                  <ul className="flex flex-col gap-2">
                    {data.report.followUps.map((fu, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span
                          className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: 'var(--color-brand-500)' }}
                        />
                        <span className="text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>
                          {fu}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </Section>
            )}

            {/* Follow-Up Email */}
            <Section title="Follow-Up Email">
              <Card>
                <div className="flex flex-col gap-4">
                  {/* Subject */}
                  <div className="flex flex-col gap-1.5">
                    <label
                      className="text-xs font-medium"
                      style={{ color: 'rgba(255,255,255,0.4)' }}
                    >
                      Subject
                    </label>
                    <input
                      type="text"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none transition-colors"
                      style={{
                        background: 'var(--color-surface-2)',
                        border: '1px solid var(--color-border)',
                      }}
                      placeholder="Email subject…"
                    />
                  </div>

                  {/* Body */}
                  <div className="flex flex-col gap-1.5">
                    <label
                      className="text-xs font-medium"
                      style={{ color: 'rgba(255,255,255,0.4)' }}
                    >
                      Body
                    </label>
                    <textarea
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      rows={12}
                      className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none resize-y transition-colors font-mono"
                      style={{
                        background: 'var(--color-surface-2)',
                        border: '1px solid var(--color-border)',
                        lineHeight: '1.6',
                      }}
                      placeholder="Email body…"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 justify-end">
                    <button
                      onClick={() => void saveEmail()}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
                      style={{
                        background: 'var(--color-surface-2)',
                        border: '1px solid var(--color-border)',
                        color: 'rgba(255,255,255,0.7)',
                      }}
                    >
                      {saved ? <Check size={12} /> : <Save size={12} />}
                      {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
                    </button>
                    <button
                      onClick={() => void copyEmail()}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all hover:opacity-90 active:scale-95"
                      style={{ background: 'var(--color-brand-500)' }}
                    >
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                      {copied ? 'Copied!' : 'Copy email'}
                    </button>
                  </div>
                </div>
              </Card>
            </Section>

            {/* Full Transcript (collapsible) */}
            <Section title="Full Transcript">
              <div
                className="rounded-xl overflow-hidden"
                style={{ border: '1px solid var(--color-border)' }}
              >
                <button
                  onClick={() => setTranscriptOpen((o) => !o)}
                  className="w-full flex items-center justify-between px-5 py-3 text-sm transition-opacity hover:opacity-80"
                  style={{ background: 'var(--color-surface-1)', color: 'rgba(255,255,255,0.6)' }}
                >
                  <span>
                    {data?.transcript?.length ?? 0} segment
                    {(data?.transcript?.length ?? 0) !== 1 ? 's' : ''}
                  </span>
                  {transcriptOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {transcriptOpen && (
                  <div
                    className="px-5 py-4 flex flex-col gap-3 max-h-[60vh] overflow-y-auto"
                    style={{ background: 'var(--color-surface-1)', borderTop: '1px solid var(--color-border)' }}
                  >
                    {data?.transcript?.map((seg) => (
                      <div key={seg.id} className="flex gap-3 text-sm">
                        <span
                          className="shrink-0 font-mono text-xs pt-0.5"
                          style={{ color: 'rgba(255,255,255,0.25)', minWidth: '3.5rem' }}
                        >
                          {fmtMs(seg.startMs)}
                        </span>
                        <div className="flex flex-col gap-0.5">
                          {seg.speaker != null && (
                            <span
                              className="text-xs font-medium"
                              style={{ color: 'var(--color-brand-400, var(--color-brand-500))' }}
                            >
                              Speaker {seg.speaker}
                            </span>
                          )}
                          <span style={{ color: 'rgba(255,255,255,0.75)' }}>{seg.text}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Section>
          </>
        )}
      </div>
    </div>
  )
}
