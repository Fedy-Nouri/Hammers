import { useRef, useState, useEffect } from 'react'
import { Send, Paperclip, X, FileText, Image } from 'lucide-react'

export interface AttachedFile {
  file: File
  preview: string | null
}

interface Props {
  onSend: (text: string, files: AttachedFile[]) => void
  disabled?: boolean
}

function fileIcon(file: File) {
  if (file.type.startsWith('image/')) return <Image size={12} />
  return <FileText size={12} />
}

function formatBytes(n: number) {
  if (n < 1024) return `${n}B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)}KB`
  return `${(n / (1024 * 1024)).toFixed(1)}MB`
}

export default function ChatInput({ onSend, disabled }: Props) {
  const [text, setText] = useState('')
  const [files, setFiles] = useState<AttachedFile[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 180)}px`
  }, [text])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  function submit() {
    const trimmed = text.trim()
    if (!trimmed && files.length === 0) return
    if (disabled) return
    onSend(trimmed, files)
    setText('')
    setFiles([])
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  function handleFiles(selected: FileList | null) {
    if (!selected) return
    const MAX = 5 * 1024 * 1024
    Array.from(selected).forEach((f) => {
      if (f.size > MAX) return
      if (f.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (e) => {
          setFiles((prev) => [...prev, { file: f, preview: e.target?.result as string }])
        }
        reader.readAsDataURL(f)
      } else {
        setFiles((prev) => [...prev, { file: f, preview: null }])
      }
    })
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  const canSend = (text.trim().length > 0 || files.length > 0) && !disabled

  return (
    <div
      className="border-t px-4 py-3 flex-shrink-0"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-1)' }}
    >
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {files.map((af, idx) => (
            <div
              key={idx}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs"
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
            >
              {af.preview ? (
                <img src={af.preview} alt="" className="w-5 h-5 rounded object-cover" />
              ) : (
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>{fileIcon(af.file)}</span>
              )}
              <span className="max-w-28 truncate" style={{ color: 'rgba(255,255,255,0.7)' }}>
                {af.file.name}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.3)' }}>{formatBytes(af.file.size)}</span>
              <button
                onClick={() => removeFile(idx)}
                className="ml-0.5 transition-colors hover:text-white"
                style={{ color: 'rgba(255,255,255,0.3)' }}
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div
        className="flex items-end gap-2 rounded-2xl px-3 py-2"
        style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
      >
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex-shrink-0 p-1.5 rounded-lg transition-all mb-0.5"
          style={{ color: 'rgba(255,255,255,0.35)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.35)' }}
          title="Attach file"
          disabled={disabled}
        >
          <Paperclip size={16} />
        </button>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,text/*,.pdf,.doc,.docx,.csv,.json,.md"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? 'Waiting for response…' : 'Message… (Shift+Enter for new line)'}
          rows={1}
          disabled={disabled}
          className="flex-1 resize-none bg-transparent text-sm outline-none leading-relaxed"
          style={{
            color: 'rgba(255,255,255,0.85)',
            caretColor: 'var(--color-brand-400)',
            minHeight: '24px',
          }}
        />

        <button
          onClick={submit}
          disabled={!canSend}
          className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center mb-0.5 transition-all"
          style={{
            background: canSend
              ? 'linear-gradient(135deg, var(--color-brand-600), #3b82f6)'
              : 'var(--color-surface-3)',
            color: canSend ? 'white' : 'rgba(255,255,255,0.2)',
          }}
        >
          <Send size={14} />
        </button>
      </div>

      <p className="text-center mt-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.15)' }}>
        AI responses may be inaccurate. Verify important information.
      </p>
    </div>
  )
}
