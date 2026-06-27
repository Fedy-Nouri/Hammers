import { useEffect, useRef } from 'react'
import { Bot, User, Loader } from 'lucide-react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Message } from '../../lib/api/conversations'

interface Props {
  messages: Message[]
  streamingContent: string
  isStreaming: boolean
}

// GFM-aware markdown for assistant messages (SQL code blocks + result tables). Tailwind
// here has no typography plugin, so each element is styled against the theme variables.
const MD_COMPONENTS: Components = {
  table: ({ children }) => (
    <div className="overflow-x-auto my-2">
      <table className="border-collapse text-xs" style={{ border: '1px solid var(--color-border)' }}>
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th
      className="px-2 py-1 text-left font-semibold"
      style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface-3)' }}
    >
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-2 py-1 align-top" style={{ border: '1px solid var(--color-border)' }}>
      {children}
    </td>
  ),
  pre: ({ children }) => (
    <pre
      className="my-2 p-3 rounded-lg overflow-x-auto text-xs"
      style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)' }}
    >
      {children}
    </pre>
  ),
  code: ({ className, children }) => {
    if (className && /language-/.test(className)) return <code className={className}>{children}</code>
    return (
      <code className="px-1 py-0.5 rounded text-xs" style={{ background: 'var(--color-surface-3)' }}>
        {children}
      </code>
    )
  },
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" style={{ color: 'var(--color-brand-400)', textDecoration: 'underline' }}>
      {children}
    </a>
  ),
  ul: ({ children }) => <ul className="list-disc ml-5 my-1 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal ml-5 my-1 space-y-0.5">{children}</ol>,
  p: ({ children }) => <p className="my-1">{children}</p>,
  h1: ({ children }) => <h1 className="text-base font-semibold my-1.5">{children}</h1>,
  h2: ({ children }) => <h2 className="text-sm font-semibold my-1.5">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-semibold my-1.5">{children}</h3>,
  hr: () => <hr className="my-2" style={{ borderColor: 'var(--color-border)' }} />,
}

function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
      {children}
    </ReactMarkdown>
  )
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{
          background: isUser
            ? 'linear-gradient(135deg, var(--color-brand-600), #3b82f6)'
            : 'var(--color-surface-3)',
          border: isUser ? 'none' : '1px solid var(--color-border)',
        }}
      >
        {isUser ? (
          <User size={13} className="text-white" />
        ) : (
          <Bot size={13} style={{ color: 'var(--color-brand-400)' }} />
        )}
      </div>

      <div className={`max-w-[72%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div
          className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words ${isUser ? 'whitespace-pre-wrap' : ''}`}
          style={
            isUser
              ? {
                  background: 'linear-gradient(135deg, var(--color-brand-600), #3b82f6)',
                  color: 'white',
                  borderBottomRightRadius: '6px',
                }
              : {
                  background: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  color: 'rgba(255,255,255,0.85)',
                  borderBottomLeftRadius: '6px',
                }
          }
        >
          {isUser ? message.content : <Markdown>{message.content}</Markdown>}
        </div>
        <span className="text-xs px-1" style={{ color: 'rgba(255,255,255,0.2)' }}>
          {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  )
}

function StreamingBubble({ content }: { content: string }) {
  return (
    <div className="flex gap-3">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)' }}
      >
        <Bot size={13} style={{ color: 'var(--color-brand-400)' }} />
      </div>

      <div className="max-w-[72%] flex flex-col gap-1">
        <div
          className="px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words"
          style={{
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            color: 'rgba(255,255,255,0.85)',
            borderBottomLeftRadius: '6px',
          }}
        >
          {content || (
            <span className="flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
              <Loader size={12} className="animate-spin" />
              Thinking…
            </span>
          )}
          {content && (
            <span
              className="inline-block w-0.5 h-4 ml-0.5 rounded-full animate-pulse align-middle"
              style={{ background: 'var(--color-brand-400)' }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default function MessageList({ messages, streamingContent, isStreaming }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, streamingContent])

  const visible = messages.filter((m) => m.role !== 'system')

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="max-w-3xl mx-auto flex flex-col gap-5">
        {visible.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center h-full min-h-48 gap-3">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
            >
              <Bot size={24} style={{ color: 'var(--color-brand-400)' }} />
            </div>
            <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Start the conversation
            </p>
          </div>
        )}

        {visible.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {isStreaming && <StreamingBubble content={streamingContent} />}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}
