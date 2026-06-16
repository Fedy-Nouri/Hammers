import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Mic, PenLine, Map, Sparkles } from 'lucide-react'

const agents = [
  {
    icon: Mic,
    title: 'Meeting Notes',
    description: 'Transform recordings into actionable summaries, decisions, and follow-ups instantly.',
    color: '#8b5cf6',
  },
  {
    icon: PenLine,
    title: 'Content Generator',
    description: 'Create blogs, LinkedIn posts, emails, and marketing copy tailored to your voice.',
    color: '#3b82f6',
  },
  {
    icon: Map,
    title: 'Travel Planner',
    description: 'Get personalized itineraries, hotel picks, and day-by-day schedules in seconds.',
    color: '#10b981',
  },
]

export default function HomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="relative overflow-hidden">
      {/* Hero background */}
      <div className="absolute inset-0 pointer-events-none">
        <div style={{ background: 'radial-gradient(ellipse 70% 60% at 50% -5%, rgba(139,92,246,0.2), transparent)' }} className="absolute inset-0" />
        <div style={{ background: 'radial-gradient(ellipse 40% 40% at 80% 60%, rgba(59,130,246,0.08), transparent)' }} className="absolute inset-0" />
        {/* Grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* Hero */}
      <section className="relative max-w-7xl mx-auto px-6 pt-28 pb-20 text-center">
        <div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-8"
          style={{ background: 'rgba(139,92,246,0.15)', color: 'var(--color-brand-400)', border: '1px solid rgba(139,92,246,0.25)' }}
        >
          <Sparkles size={14} />
          AI agents built for professionals
        </div>

        <h1 className="text-5xl sm:text-7xl font-bold tracking-tight text-white mb-6 leading-none">
          Work smarter with
          <br />
          <span style={{ background: 'linear-gradient(135deg, var(--color-brand-400) 0%, #60a5fa 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            AI agents
          </span>
        </h1>

        <p className="text-lg sm:text-xl max-w-2xl mx-auto mb-10" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Specialized assistants that handle your meetings, content, and travel — so you can focus on what matters.
        </p>

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
      </section>

      {/* Agent cards */}
      <section className="relative max-w-7xl mx-auto px-6 pb-28">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {agents.map(({ icon: Icon, title, description, color }) => (
            <div
              key={title}
              className="group rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:-translate-y-1"
              style={{
                background: 'var(--color-surface-1)',
                border: '1px solid var(--color-border)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-border-hover)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)' }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                style={{ background: `${color}20`, color }}
              >
                <Icon size={20} />
              </div>
              <h3 className="font-semibold text-white mb-2">{title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
                {description}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
