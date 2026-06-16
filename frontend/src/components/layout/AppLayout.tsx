import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Zap } from 'lucide-react'

export default function AppLayout() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-surface)' }}>
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b" style={{ borderColor: 'var(--color-border)', background: 'rgba(13,13,20,0.8)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <button
            onClick={() => void navigate('/')}
            className="flex items-center gap-2 group"
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--color-brand-500), #3b82f6)' }}>
              <Zap size={16} className="text-white" />
            </div>
            <span className="font-bold text-lg text-white tracking-tight">Hammers</span>
          </button>

          <nav className="flex items-center gap-1">
            {[
              { label: t('nav.home'), path: '/' },
              { label: t('nav.dashboard'), path: '/dashboard' },
            ].map(({ label, path }) => (
              <button
                key={path}
                onClick={() => void navigate(path)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  color: location.pathname === path ? 'white' : 'rgba(255,255,255,0.5)',
                  background: location.pathname === path ? 'var(--color-surface-3)' : 'transparent',
                }}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={() => void navigate('/login')}
              className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
              style={{ color: 'rgba(255,255,255,0.6)' }}
            >
              {t('auth.login')}
            </button>
            <button
              onClick={() => void navigate('/register')}
              className="px-4 py-2 text-sm font-semibold rounded-lg text-white transition-all hover:opacity-90 active:scale-95"
              style={{ background: 'linear-gradient(135deg, var(--color-brand-600), #3b82f6)' }}
            >
              {t('auth.register')}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
