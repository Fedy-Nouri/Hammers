import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Mic, PenLine, Map, Briefcase, Zap, ArrowRight } from 'lucide-react'
import { agentsApi } from '../lib/api/conversations'
import type { Agent } from '../lib/api/conversations'

const AGENT_ICONS: Record<string, React.ElementType> = {
  'meeting-notes': Mic,
  'content-generator': PenLine,
  'travel-agent': Map,
  'job-agent': Briefcase,
}

const AGENT_COLORS: Record<string, string> = {
  'meeting-notes': '#8b5cf6',
  'content-generator': '#3b82f6',
  'travel-agent': '#10b981',
  'job-agent': '#f59e0b',
}

type FilterMode = 'all' | 'active'

export default function MarketplacePage() {
  const navigate = useNavigate()
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterMode>('all')

  useEffect(() => {
    agentsApi.list()
      .then(setAgents)
      .catch(() => setAgents([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return agents.filter((a) => {
      const matchesSearch =
        !q ||
        a.name.toLowerCase().includes(q) ||
        (a.description?.toLowerCase().includes(q) ?? false)
      const matchesFilter = filter === 'all' || (filter === 'active' && a.enabled)
      return matchesSearch && matchesFilter
    })
  }, [agents, search, filter])

  function launch(agentId: string) {
    // The Job Hunter has its own workspace rather than a chat thread.
    if (agentId === 'job-agent') {
      void navigate('/jobs')
      return
    }
    void navigate(`/chat?agent=${agentId}`)
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-1">Agent Marketplace</h1>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Browse and launch AI agents built for your workflows.
        </p>
      </div>

      {/* Search + filter bar */}
      <div className="flex items-center gap-3 mb-8">
        <div
          className="flex items-center gap-2 flex-1 rounded-xl px-4 py-2.5"
          style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}
        >
          <Search size={14} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search agents…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/30"
          />
        </div>

        <div
          className="flex rounded-xl overflow-hidden"
          style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface-1)' }}
        >
          {(['all', 'active'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilter(mode)}
              className="px-4 py-2.5 text-sm font-medium capitalize transition-all"
              style={{
                background: filter === mode ? 'var(--color-surface-2)' : 'transparent',
                color: filter === mode ? 'white' : 'rgba(255,255,255,0.4)',
              }}
            >
              {mode === 'all' ? 'All' : 'Active'}
            </button>
          ))}
        </div>
      </div>

      {/* Agent grid */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div
            className="w-6 h-6 rounded-full border-2 animate-spin"
            style={{ borderColor: 'var(--color-brand-500)', borderTopColor: 'transparent' }}
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-2">
          <Search size={28} style={{ color: 'rgba(255,255,255,0.15)' }} />
          <p className="text-sm font-medium text-white/60">No agents found</p>
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-xs underline mt-1"
              style={{ color: 'var(--color-brand-400)' }}
            >
              Clear search
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((agent) => {
            const Icon = AGENT_ICONS[agent.id] ?? Zap
            const color = AGENT_COLORS[agent.id] ?? 'var(--color-brand-500)'
            return (
              <div
                key={agent.id}
                className="group relative rounded-2xl p-6 flex flex-col transition-all duration-200"
                style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-border-hover)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)' }}
              >
                {/* Status badge */}
                <span
                  className="absolute top-4 right-4 text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{
                    background: agent.enabled ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.06)',
                    color: agent.enabled ? '#10b981' : 'rgba(255,255,255,0.3)',
                  }}
                >
                  {agent.enabled ? 'Active' : 'Disabled'}
                </span>

                {/* Icon */}
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: `${color}18`, color }}
                >
                  <Icon size={22} />
                </div>

                {/* Info */}
                <h3 className="font-semibold text-white text-sm mb-2">{agent.name}</h3>
                {agent.description && (
                  <p
                    className="text-xs leading-relaxed flex-1 mb-5"
                    style={{ color: 'rgba(255,255,255,0.4)' }}
                  >
                    {agent.description}
                  </p>
                )}

                {/* Launch button */}
                <button
                  onClick={() => launch(agent.id)}
                  disabled={!agent.enabled}
                  className="mt-auto flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-30 hover:opacity-90 active:scale-95"
                  style={{ background: `${color}20`, color, border: `1px solid ${color}30` }}
                >
                  Launch agent <ArrowRight size={13} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
