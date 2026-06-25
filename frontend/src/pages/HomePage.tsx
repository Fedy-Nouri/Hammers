import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Mic, Briefcase, Sparkles, Zap, ShieldCheck } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const agents = [
  {
    icon: Mic,
    title: 'Meeting Copilot',
    description: 'Joins your Google Meet calls, transcribes them live, and delivers summaries, action items, and follow-up emails.',
    color: '#8b5cf6',
    path: '/meetings',
  },
  {
    icon: Briefcase,
    title: 'Job Hunter',
    description: 'Finds jobs, scores them against your resume, drafts tailored cover letters, and tracks every application.',
    color: '#f59e0b',
    path: '/jobs',
  },
]

const features = [
  {
    icon: Zap,
    title: 'Live in minutes',
    description: 'Connect your accounts and your agents start working right away — no setup marathon.',
  },
  {
    icon: Sparkles,
    title: 'Frontier AI',
    description: 'Built on the latest Claude and GPT models for genuinely useful output.',
  },
  {
    icon: ShieldCheck,
    title: 'You stay in control',
    description: 'Review everything before it goes out. Your data and credentials stay yours.',
  },
]

export default function HomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { accessToken } = useAuth()

  // Logged-in users jump straight to the agent; everyone else is sent to sign in.
  const openAgent = (path: string) => void navigate(accessToken ? path : '/login')

  return (
    <div className="relative overflow-hidden">
      {/* Hero background */}
      <div className="absolute inset-0 pointer-events-none">
        <div style={{ background: 'radial-gradient(ellipse 70% 60% at 50% -5%, rgba(139,92,246,0.22), transparent)' }} className="absolute inset-0" />
        <div style={{ background: 'radial-gradient(ellipse 40% 40% at 80% 55%, rgba(59,130,246,0.10), transparent)' }} className="absolute inset-0" />
        <div
          className="absolute -top-32 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full blur-3xl opacity-30 animate-pulse"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.45), transparent 65%)' }}
        />
        {/* Grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
            maskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black, transparent 75%)',
          }}
        />
      </div>

      {/* Hero */}
      <section className="relative max-w-7xl mx-auto px-6 pt-28 pb-16 text-center">
        <div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-8"
          style={{ background: 'rgba(139,92,246,0.15)', color: 'var(--color-brand-400)', border: '1px solid rgba(139,92,246,0.25)' }}
        >
          <Sparkles size={14} />
          AI agents built for professionals
        </div>

        <h1 className="text-5xl sm:text-7xl font-bold tracking-tight text-white mb-6 leading-[1.05]">
          Work smarter with
          <br />
          <span style={{ background: 'linear-gradient(135deg, var(--color-brand-400) 0%, #60a5fa 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            AI agents
          </span>
        </h1>

        <p className="text-lg sm:text-xl max-w-2xl mx-auto mb-10" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Specialized assistants that sit in your meetings and run your job search — so you can focus on what matters.
        </p>

        {accessToken ? (
          <button
            onClick={() => void navigate('/dashboard')}
            className="group inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
            style={{ background: 'linear-gradient(135deg, var(--color-brand-600), #3b82f6)', boxShadow: '0 0 40px rgba(139,92,246,0.25)' }}
          >
            Go to dashboard
            <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => void navigate('/register')}
                className="group flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
                style={{ background: 'linear-gradient(135deg, var(--color-brand-600), #3b82f6)', boxShadow: '0 0 40px rgba(139,92,246,0.25)' }}
              >
                {t('auth.register')}
                <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
              <button
                onClick={() => void navigate('/login')}
                className="px-7 py-3.5 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
                style={{ color: 'rgba(255,255,255,0.7)', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
              >
                {t('auth.login')}
              </button>
            </div>

            <p className="mt-5 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Free to start · No credit card required
            </p>
          </>
        )}
      </section>

      {/* Agent cards */}
      <section className="relative max-w-4xl mx-auto px-6 pb-24">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Your agents
          </span>
          <span className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {agents.map(({ icon: Icon, title, description, color, path }) => (
            <div
              key={title}
              role="button"
              tabIndex={0}
              onClick={() => openAgent(path)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openAgent(path) } }}
              className="group relative overflow-hidden rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:-translate-y-1"
              style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border-hover)'
                e.currentTarget.style.boxShadow = `0 18px 50px -20px ${color}66`
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              {/* Hover glow */}
              <div
                className="absolute -top-16 -right-16 w-40 h-40 rounded-full blur-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none"
                style={{ background: `radial-gradient(circle, ${color}40, transparent 70%)` }}
              />

              <div className="relative">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: `linear-gradient(135deg, ${color}33, ${color}0d)`, color, border: `1px solid ${color}33` }}
                >
                  <Icon size={22} />
                </div>
                <h3 className="font-semibold text-white text-lg mb-2">{title}</h3>
                <p className="text-sm leading-relaxed mb-5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  {description}
                </p>
                <div className="flex items-center gap-1.5 text-sm font-semibold" style={{ color }}>
                  Open agent
                  <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Value props */}
      <section className="relative max-w-5xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {features.map(({ icon: Icon, title, description }) => (
            <div key={title} className="flex flex-col gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-brand-400)' }}
              >
                <Icon size={18} />
              </div>
              <h4 className="font-semibold text-white text-sm">{title}</h4>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="relative max-w-5xl mx-auto px-6 pb-28">
        <div
          className="relative overflow-hidden rounded-3xl px-8 py-14 text-center"
          style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 60% 80% at 50% 0%, rgba(139,92,246,0.18), transparent 70%)' }}
          />
          <div className="relative">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
              Ready to put your agents to work?
            </h2>
            <p className="text-sm sm:text-base max-w-xl mx-auto mb-8" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Spin up your first agent in minutes and let it handle the busywork.
            </p>
            <button
              onClick={() => void navigate(accessToken ? '/dashboard' : '/register')}
              className="group inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
              style={{ background: 'linear-gradient(135deg, var(--color-brand-600), #3b82f6)', boxShadow: '0 0 40px rgba(139,92,246,0.25)' }}
            >
              {accessToken ? 'Go to dashboard' : t('auth.register')}
              <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
