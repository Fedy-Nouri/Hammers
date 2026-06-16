import { useTranslation } from 'react-i18next'
import { Mic, PenLine, Map, ArrowRight, Clock, Zap } from 'lucide-react'

const agents = [
  {
    icon: Mic,
    title: 'Meeting Notes Agent',
    description: 'Transform recordings into summaries, action items, and follow-ups.',
    color: '#8b5cf6',
    badge: 'Popular',
  },
  {
    icon: PenLine,
    title: 'Content Generator',
    description: 'Blogs, LinkedIn posts, emails, and marketing copy on demand.',
    color: '#3b82f6',
    badge: null,
  },
  {
    icon: Map,
    title: 'Travel Planner',
    description: 'Personalized itineraries, hotels, and day-by-day trip schedules.',
    color: '#10b981',
    badge: 'New',
  },
]

const stats = [
  { label: 'Conversations', value: '0', icon: Zap },
  { label: 'Tokens used', value: '0', icon: Zap },
  { label: 'Hours saved', value: '0h', icon: Clock },
]

export default function DashboardPage() {
  const { t } = useTranslation()

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-white mb-1">{t('nav.dashboard')}</h1>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Choose an agent and let it do the work.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        {stats.map(({ label, value }) => (
          <div
            key={label}
            className="rounded-xl p-5"
            style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}
          >
            <p className="text-2xl font-bold text-white mb-1">{value}</p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Agents */}
      <div className="mb-6">
        <h2 className="text-base font-semibold text-white mb-4">Available Agents</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {agents.map(({ icon: Icon, title, description, color, badge }) => (
            <button
              key={title}
              className="group text-left rounded-2xl p-6 transition-all duration-200 hover:-translate-y-0.5"
              style={{
                background: 'var(--color-surface-1)',
                border: '1px solid var(--color-border)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-border-hover)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)' }}
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ background: `${color}18`, color }}
                >
                  <Icon size={20} />
                </div>
                {badge && (
                  <span
                    className="text-xs font-medium px-2.5 py-1 rounded-full"
                    style={{
                      background: badge === 'New' ? 'rgba(16,185,129,0.15)' : 'rgba(139,92,246,0.15)',
                      color: badge === 'New' ? '#10b981' : 'var(--color-brand-400)',
                    }}
                  >
                    {badge}
                  </span>
                )}
              </div>
              <h3 className="font-semibold text-white mb-2 text-sm">{title}</h3>
              <p className="text-xs leading-relaxed mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {description}
              </p>
              <div
                className="flex items-center gap-1 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color }}
              >
                Launch agent <ArrowRight size={12} />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Recent conversations placeholder */}
      <div className="rounded-2xl p-6" style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}>
        <h2 className="text-sm font-semibold text-white mb-4">Recent Conversations</h2>
        <div className="flex flex-col items-center justify-center py-10 gap-2">
          <Clock size={24} style={{ color: 'rgba(255,255,255,0.15)' }} />
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.25)' }}>No conversations yet</p>
        </div>
      </div>
    </div>
  )
}
