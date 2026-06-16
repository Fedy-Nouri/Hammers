import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, ArrowRight } from 'lucide-react'

export default function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)

  return (
    <>
      <h1 className="text-2xl font-bold text-white mb-1">{t('auth.login')}</h1>
      <p className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.4)' }}>
        Welcome back — pick up where you left off.
      </p>

      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
            {t('auth.email')}
          </label>
          <input
            type="email"
            placeholder="you@example.com"
            className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-white/20 focus:ring-2"
            style={{
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              '--tw-ring-color': 'rgba(139,92,246,0.4)',
            } as React.CSSProperties}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
            {t('auth.password')}
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              className="w-full rounded-xl px-4 py-3 pr-11 text-sm text-white outline-none transition-all placeholder:text-white/20 focus:ring-2"
              style={{
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                '--tw-ring-color': 'rgba(139,92,246,0.4)',
              } as React.CSSProperties}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
              style={{ color: 'rgba(255,255,255,0.3)' }}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          className="group w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95 mt-2"
          style={{ background: 'linear-gradient(135deg, var(--color-brand-600), #3b82f6)' }}
        >
          {t('auth.login')}
          <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
        </button>
      </form>

      <p className="text-center text-sm mt-6" style={{ color: 'rgba(255,255,255,0.35)' }}>
        {t('auth.noAccount')}{' '}
        <button
          onClick={() => void navigate('/register')}
          className="font-medium transition-colors hover:text-white"
          style={{ color: 'var(--color-brand-400)' }}
        >
          {t('auth.register')}
        </button>
      </p>
    </>
  )
}
