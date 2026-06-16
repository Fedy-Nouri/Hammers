import { Outlet, useNavigate } from 'react-router-dom'
import { Zap } from 'lucide-react'

export default function AuthLayout() {
  const navigate = useNavigate()

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden"
      style={{ background: 'var(--color-surface)' }}
    >
      {/* Background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(139,92,246,0.15), transparent)',
        }}
      />
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse, rgba(59,130,246,0.08), transparent 70%)',
        }}
      />

      {/* Logo */}
      <button onClick={() => void navigate('/')} className="flex items-center gap-2 mb-8 group">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, var(--color-brand-500), #3b82f6)' }}
        >
          <Zap size={18} className="text-white" />
        </div>
        <span className="font-bold text-xl text-white tracking-tight">Hammers</span>
      </button>

      {/* Card */}
      <div
        className="w-full max-w-sm rounded-2xl p-8 relative"
        style={{
          background: 'var(--color-surface-1)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        }}
      >
        <Outlet />
      </div>
    </div>
  )
}
