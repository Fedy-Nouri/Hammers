import { useState } from 'react'
import { Plus, MessageSquare, Trash2, ChevronRight } from 'lucide-react'
import type { Conversation } from '../../lib/api/conversations'

interface Props {
  conversations: Conversation[]
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  agentNames: Record<string, string>
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 86_400_000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (diff < 7 * 86_400_000) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function ConversationSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  agentNames,
}: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (confirmDeleteId === id) {
      onDelete(id)
      setConfirmDeleteId(null)
    } else {
      setConfirmDeleteId(id)
    }
  }

  return (
    <aside
      className="flex flex-col w-64 flex-shrink-0 border-r"
      style={{ background: 'var(--color-surface-1)', borderColor: 'var(--color-border)' }}
    >
      <div className="p-3 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
        <button
          onClick={onNew}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
          style={{ background: 'linear-gradient(135deg, var(--color-brand-600), #3b82f6)' }}
        >
          <Plus size={15} />
          New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 gap-2 px-4 text-center">
            <MessageSquare size={20} style={{ color: 'rgba(255,255,255,0.15)' }} />
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
              No conversations yet
            </p>
          </div>
        )}

        {conversations.map((conv) => {
          const isActive = conv.id === activeId
          const isHovered = conv.id === hoveredId
          const agentName = agentNames[conv.agentId] ?? conv.agentId
          const label = conv.title ?? agentName

          return (
            <div
              key={conv.id}
              className="relative mx-2 mb-0.5"
              onMouseEnter={() => setHoveredId(conv.id)}
              onMouseLeave={() => { setHoveredId(null); setConfirmDeleteId(null) }}
            >
              <button
                onClick={() => onSelect(conv.id)}
                className="w-full text-left rounded-xl px-3 py-2.5 transition-all group"
                style={{
                  background: isActive
                    ? 'var(--color-surface-3)'
                    : isHovered
                      ? 'var(--color-surface-2)'
                      : 'transparent',
                  border: '1px solid',
                  borderColor: isActive ? 'var(--color-border-hover)' : 'transparent',
                }}
              >
                <div className="flex items-center gap-2 pr-6">
                  <MessageSquare
                    size={13}
                    className="flex-shrink-0"
                    style={{ color: isActive ? 'var(--color-brand-400)' : 'rgba(255,255,255,0.3)' }}
                  />
                  <span
                    className="text-xs font-medium truncate flex-1"
                    style={{ color: isActive ? 'white' : 'rgba(255,255,255,0.65)' }}
                  >
                    {label}
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-1 pl-5">
                  <span className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px' }}>
                    {agentName}
                  </span>
                  <span className="ml-auto text-xs flex-shrink-0" style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px' }}>
                    {formatDate(conv.updatedAt)}
                  </span>
                </div>
              </button>

              {(isHovered || isActive) && (
                <button
                  onClick={(e) => handleDelete(e, conv.id)}
                  className="absolute right-2 top-2.5 p-1 rounded-lg transition-all"
                  style={{
                    color: confirmDeleteId === conv.id ? '#f87171' : 'rgba(255,255,255,0.3)',
                    background: confirmDeleteId === conv.id ? 'rgba(248,113,113,0.1)' : 'transparent',
                  }}
                  title={confirmDeleteId === conv.id ? 'Click again to confirm' : 'Delete conversation'}
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          )
        })}
      </div>

      {conversations.length > 0 && (
        <div className="p-3 border-t flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
          <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.2)' }}>
            {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </aside>
  )
}

export function AgentPickerModal({
  agents,
  onSelect,
  onClose,
}: {
  agents: { id: string; name: string; description: string | null }[]
  onSelect: (agentId: string) => void
  onClose: () => void
}) {
  const agentColors: Record<string, string> = {
    'meeting-notes': '#8b5cf6',
    'content-generator': '#3b82f6',
    'travel-agent': '#10b981',
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
        style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border-hover)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">Choose an Agent</h2>
          <button
            onClick={onClose}
            className="text-sm px-2 py-1 rounded-lg transition-colors"
            style={{ color: 'rgba(255,255,255,0.4)' }}
          >
            ✕
          </button>
        </div>

        {agents.length === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: 'rgba(255,255,255,0.4)' }}>
            No agents available. Seed agents via the API first.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {agents.map((agent) => {
              const color = agentColors[agent.id] ?? 'var(--color-brand-500)'
              return (
                <button
                  key={agent.id}
                  onClick={() => onSelect(agent.id)}
                  className="flex items-center gap-3 p-4 rounded-xl text-left transition-all hover:-translate-y-0.5"
                  style={{
                    background: 'var(--color-surface-1)',
                    border: '1px solid var(--color-border)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-border-hover)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)' }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${color}20`, color }}
                  >
                    <MessageSquare size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{agent.name}</p>
                    {agent.description && (
                      <p className="text-xs mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        {agent.description}
                      </p>
                    )}
                  </div>
                  <ChevronRight size={14} style={{ color: 'rgba(255,255,255,0.25)' }} />
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
