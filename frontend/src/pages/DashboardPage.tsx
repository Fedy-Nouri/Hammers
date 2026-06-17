import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Mic, PenLine, Map, ArrowRight, Clock, Zap, MessageSquare } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { conversationsApi } from '../lib/api/conversations'
import { agentsApi } from '../lib/api/conversations'
import { usageApi } from '../lib/api/usage'
import type { Conversation, Agent } from '../lib/api/conversations'
import type { UsageSummary } from '../lib/api/usage'

const AGENT_ICONS: Record<string, React.ElementType> = {
  'meeting-notes': Mic,
  'content-generator': PenLine,
  'travel-agent': Map,
}

const AGENT_COLORS: Record<string, string> = {
  'meeting-notes': '#8b5cf6',
  'content-generator': '#3b82f6',
  'travel-agent': '#10b981',
}

const AGENT_BADGES: Record<string, string> = {
  'meeting-notes': 'Popular',
  'travel-agent': 'New',
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function DashboardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [agents, setAgents] = useState<Agent[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [summary, setSummary] = useState<UsageSummary | null>(null)

  const displayName = user?.firstName ?? user?.email?.split('@')[0] ?? 'there'

  useEffect(() => {
    agentsApi.list().then(setAgents).catch(() => setAgents([]))
    conversationsApi.list(1, 5).then((r) => setConversations(r.data)).catch(() => setConversations([]))
    usageApi.getSummary(30).then(setSummary).catch(() => null)
  }, [])

  const stats = [
    { label: 'Conversations', value: summary ? String(summary.totalCalls > 0 ? conversations.length : 0) : '—', icon: MessageSquare },
    { label: 'Tokens used', value: summary ? formatTokens(summary.totalTokens) : '—', icon: Zap },
    { label: 'Est. cost', value: summary ? (summary.totalCostUsd === 0 ? '$0.00' : `$${summary.totalCostUsd.toFixed(4)}`) : '—', icon: Zap },
  ]

  const displayAgents = agents.length > 0 ? agents : []

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-white mb-1">
          {t('nav.dashboard')}
        </h1>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Welcome back, {displayName}. Choose an agent and let it do the work.
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white">Available Agents</h2>
          <button
            onClick={() => void navigate('/marketplace')}
            className="text-xs font-medium flex items-center gap-1 transition-opacity hover:opacity-70"
            style={{ color: 'var(--color-brand-400)' }}
          >
            View all <ArrowRight size={12} />
          </button>
        </div>
        {displayAgents.length === 0 ? (
          <div className="flex flex-col items-center py-10 gap-2 rounded-2xl" style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.25)' }}>No agents available</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {displayAgents.slice(0, 3).map((agent) => {
              const Icon = AGENT_ICONS[agent.id] ?? Zap
              const color = AGENT_COLORS[agent.id] ?? 'var(--color-brand-500)'
              const badge = AGENT_BADGES[agent.id] ?? null
              return (
                <button
                  key={agent.id}
                  className="group text-left rounded-2xl p-6 transition-all duration-200 hover:-translate-y-0.5"
                  style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-border-hover)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)' }}
                  onClick={() => void navigate(`/marketplace`)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: `${color}18`, color }}>
                      <Icon size={20} />
                    </div>
                    {badge && (
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: badge === 'New' ? 'rgba(16,185,129,0.15)' : 'rgba(139,92,246,0.15)', color: badge === 'New' ? '#10b981' : 'var(--color-brand-400)' }}>
                        {badge}
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-white mb-2 text-sm">{agent.name}</h3>
                  {agent.description && (
                    <p className="text-xs leading-relaxed mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {agent.description}
                    </p>
                  )}
                  <div className="flex items-center gap-1 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity" style={{ color }}>
                    Launch agent <ArrowRight size={12} />
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Recent conversations */}
      <div className="rounded-2xl p-6" style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">Recent Conversations</h2>
          {conversations.length > 0 && (
            <button
              onClick={() => void navigate('/chat')}
              className="text-xs font-medium flex items-center gap-1 transition-opacity hover:opacity-70"
              style={{ color: 'var(--color-brand-400)' }}
            >
              View all <ArrowRight size={12} />
            </button>
          )}
        </div>

        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <Clock size={24} style={{ color: 'rgba(255,255,255,0.15)' }} />
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.25)' }}>No conversations yet</p>
            <button
              onClick={() => void navigate('/chat')}
              className="mt-2 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, var(--color-brand-600), #3b82f6)' }}
            >
              Start your first chat
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {conversations.map((conv) => {
              const color = AGENT_COLORS[conv.agentId] ?? 'var(--color-brand-500)'
              return (
                <button
                  key={conv.id}
                  onClick={() => void navigate(`/chat/${conv.id}`)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left"
                  style={{ background: 'transparent' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-2)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}18`, color }}>
                    <MessageSquare size={13} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{conv.title ?? conv.agentId}</p>
                    <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.3)' }}>{conv.agentId}</p>
                  </div>
                  <span className="text-xs flex-shrink-0" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    {formatRelative(conv.updatedAt)}
                  </span>
                  <ArrowRight size={12} style={{ color: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
