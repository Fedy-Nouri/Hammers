import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { Bot } from 'lucide-react'
import { conversationsApi, agentsApi } from '../lib/api/conversations'
import type { Conversation, Message, Agent } from '../lib/api/conversations'
import ConversationSidebar, { AgentPickerModal } from '../components/chat/ConversationSidebar'
import MessageList from '../components/chat/MessageList'
import ChatInput from '../components/chat/ChatInput'
import type { AttachedFile } from '../components/chat/ChatInput'
import { useAuth } from '../contexts/AuthContext'

async function* readSSE(response: Response): AsyncGenerator<string> {
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const raw = line.slice(6).trim()
      if (raw === '[DONE]') return
      try {
        const parsed = JSON.parse(raw) as { content?: string; error?: string }
        if (parsed.content) yield parsed.content
      } catch {
        // ignore malformed chunks
      }
    }
  }
}

function buildMessageContent(text: string, files: AttachedFile[]): string {
  if (files.length === 0) return text

  const parts: string[] = []
  if (text) parts.push(text)

  for (const af of files) {
    if (af.preview) {
      parts.push(`\n[Image attached: ${af.file.name}]`)
    } else {
      parts.push(`\n[File attached: ${af.file.name}]`)
    }
  }

  return parts.join('')
}

export default function ChatPage() {
  const { conversationId } = useParams<{ conversationId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { accessToken } = useAuth()

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [showAgentPicker, setShowAgentPicker] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const agentNames: Record<string, string> = Object.fromEntries(
    agents.map((a) => [a.id, a.name]),
  )

  const activeConversation = conversations.find((c) => c.id === conversationId) ?? null

  const fetchConversations = useCallback(async () => {
    try {
      const data = await conversationsApi.list()
      setConversations(data.data)
    } catch {
      // ignore
    } finally {
      setLoadingConvs(false)
    }
  }, [])

  const fetchMessages = useCallback(async (id: string) => {
    setLoadingMsgs(true)
    try {
      const data = await conversationsApi.getMessages(id)
      setMessages(data.data)
    } catch {
      setMessages([])
    } finally {
      setLoadingMsgs(false)
    }
  }, [])

  useEffect(() => {
    void fetchConversations()
    agentsApi.list().then(setAgents).catch(() => setAgents([]))
  }, [fetchConversations])

  // Auto-create conversation when launched from marketplace via ?agent=<agentId>
  useEffect(() => {
    const agentParam = searchParams.get('agent')
    if (!agentParam || conversationId) return
    conversationsApi.create(agentParam)
      .then((conv) => {
        setConversations((prev) => [conv, ...prev])
        void navigate(`/chat/${conv.id}`, { replace: true })
      })
      .catch(() => null)
  }, [searchParams, conversationId, navigate])

  useEffect(() => {
    if (conversationId) {
      setMessages([])
      void fetchMessages(conversationId)
    } else {
      setMessages([])
    }
  }, [conversationId, fetchMessages])

  async function createConversation(agentId: string) {
    try {
      const conv = await conversationsApi.create(agentId)
      setConversations((prev) => [conv, ...prev])
      void navigate(`/chat/${conv.id}`)
    } catch {
      // ignore
    }
    setShowAgentPicker(false)
  }

  async function deleteConversation(id: string) {
    try {
      await conversationsApi.remove(id)
      setConversations((prev) => prev.filter((c) => c.id !== id))
      if (conversationId === id) {
        void navigate('/chat')
      }
    } catch {
      // ignore
    }
  }

  async function sendMessage(text: string, files: AttachedFile[]) {
    if (!conversationId || isStreaming) return

    const content = buildMessageContent(text, files)
    if (!content.trim()) return

    // Optimistically add user message
    const optimisticMsg: Message = {
      id: `opt-${Date.now()}`,
      conversationId,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimisticMsg])

    // Persist user message
    let storedMsg: Message
    try {
      storedMsg = await conversationsApi.addMessage(conversationId, 'user', content)
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticMsg.id ? storedMsg : m)),
      )
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id))
      return
    }

    // Build chat history for AI
    const history = [...messages.filter((m) => m.role !== 'system'), storedMsg].map((m) => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }))

    // Stream AI response
    setIsStreaming(true)
    setStreamingContent('')

    const abort = new AbortController()
    abortRef.current = abort

    let finalContent = ''

    try {
      const response = await fetch('/api/ai/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken ?? ''}`,
        },
        body: JSON.stringify({
          messages: history,
          agentId: activeConversation?.agentId,
          conversationId,
        }),
        signal: abort.signal,
      })

      if (!response.ok) throw new Error('Stream failed')

      for await (const chunk of readSSE(response)) {
        finalContent += chunk
        setStreamingContent(finalContent)
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        finalContent = finalContent || 'Sorry, something went wrong. Please try again.'
      }
    }

    setIsStreaming(false)
    setStreamingContent('')

    if (finalContent) {
      try {
        const assistantMsg = await conversationsApi.addMessage(
          conversationId,
          'assistant',
          finalContent,
        )
        setMessages((prev) => [...prev, assistantMsg])
        // Refresh conversation list to update updatedAt
        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversationId ? { ...c, updatedAt: new Date().toISOString() } : c,
          ),
        )
      } catch {
        // persist failure — show message anyway
        setMessages((prev) => [
          ...prev,
          {
            id: `local-${Date.now()}`,
            conversationId,
            role: 'assistant',
            content: finalContent,
            createdAt: new Date().toISOString(),
          },
        ])
      }
    }
  }

  if (loadingConvs) {
    return (
      <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 64px)' }}>
        <div
          className="w-6 h-6 rounded-full border-2 animate-spin"
          style={{ borderColor: 'var(--color-brand-500)', borderTopColor: 'transparent' }}
        />
      </div>
    )
  }

  return (
    <div className="flex overflow-hidden" style={{ height: 'calc(100vh - 64px)' }}>
      <ConversationSidebar
        conversations={conversations}
        activeId={conversationId ?? null}
        onSelect={(id) => void navigate(`/chat/${id}`)}
        onNew={() => setShowAgentPicker(true)}
        onDelete={(id) => void deleteConversation(id)}
        agentNames={agentNames}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {conversationId ? (
          <>
            {/* Chat header */}
            <div
              className="h-14 flex items-center gap-3 px-5 border-b flex-shrink-0"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-1)' }}
            >
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
              >
                <Bot size={16} style={{ color: 'var(--color-brand-400)' }} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {activeConversation?.title ?? agentNames[activeConversation?.agentId ?? ''] ?? 'Chat'}
                </p>
                {activeConversation && (
                  <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    {agentNames[activeConversation.agentId] ?? activeConversation.agentId}
                  </p>
                )}
              </div>
              {loadingMsgs && (
                <div
                  className="ml-auto w-4 h-4 rounded-full border-2 animate-spin flex-shrink-0"
                  style={{ borderColor: 'var(--color-brand-400)', borderTopColor: 'transparent' }}
                />
              )}
            </div>

            <MessageList
              messages={messages}
              streamingContent={streamingContent}
              isStreaming={isStreaming}
            />

            <ChatInput onSend={(t, f) => void sendMessage(t, f)} disabled={isStreaming} />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
            >
              <Bot size={28} style={{ color: 'var(--color-brand-400)' }} />
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-white mb-1">
                {conversations.length === 0 ? 'Welcome to Hammers' : 'Select a conversation'}
              </p>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {conversations.length === 0
                  ? 'Start your first AI conversation'
                  : 'Or start a new one'}
              </p>
            </div>
            <button
              onClick={() => setShowAgentPicker(true)}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
              style={{ background: 'linear-gradient(135deg, var(--color-brand-600), #3b82f6)' }}
            >
              New Conversation
            </button>
          </div>
        )}
      </div>

      {showAgentPicker && (
        <AgentPickerModal
          agents={agents}
          onSelect={(agentId) => void createConversation(agentId)}
          onClose={() => setShowAgentPicker(false)}
        />
      )}
    </div>
  )
}
