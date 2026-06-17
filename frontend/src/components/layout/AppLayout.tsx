import { useState, useRef, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Zap, LogOut, User, ChevronDown } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

export default function AppLayout() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, accessToken, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const displayName = user?.firstName
    ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}`
    : (user?.email ?? '')

  const initials = user?.firstName
    ? `${user.firstName[0]}${user.lastName ? user.lastName[0] : ''}`.toUpperCase()
    : (user?.email?.[0] ?? '?').toUpperCase()

  const handleLogout = async () => {
    setMenuOpen(false)
    await logout()
    void navigate('/')
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-surface)' }}>
      <header className="sticky top-0 z-50 border-b" style={{ borderColor: 'var(--color-border)', background: 'rgba(13,13,20,0.8)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={() => void navigate('/')} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--color-brand-500), #3b82f6)' }}>
              <Zap size={16} className="text-white" />
            </div>
            <span className="font-bold text-lg text-white tracking-tight">Hammers</span>
          </button>

          <nav className="flex items-center gap-1">
            {[
              { label: t('nav.home'), path: '/' },
              { label: t('nav.dashboard'), path: '/dashboard' },
              ...(accessToken ? [{ label: 'Chat', path: '/chat' }] : []),
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
            {accessToken ? (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen((o) => !o)}
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl transition-all"
                  style={{ background: menuOpen ? 'var(--color-surface-3)' : 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, var(--color-brand-500), #3b82f6)' }}
                  >
                    {initials}
                  </div>
                  <span className="text-sm font-medium text-white max-w-[120px] truncate">{displayName}</span>
                  <ChevronDown size={14} className={`transition-transform flex-shrink-0 ${menuOpen ? 'rotate-180' : ''}`} style={{ color: 'rgba(255,255,255,0.4)' }} />
                </button>

                {menuOpen && (
                  <div
                    className="absolute right-0 mt-2 w-52 rounded-xl py-1 shadow-xl"
                    style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
                  >
                    <div className="px-4 py-2.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                      <p className="text-xs font-semibold text-white truncate">{displayName}</p>
                      {user?.email && <p className="text-xs truncate mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{user.email}</p>}
                    </div>
                    <button
                      onClick={() => { setMenuOpen(false); void navigate('/profile') }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors hover:text-white text-left"
                      style={{ color: 'rgba(255,255,255,0.6)' }}
                    >
                      <User size={14} />
                      Profile
                    </button>
                    <button
                      onClick={() => void handleLogout()}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors text-left"
                      style={{ color: '#f87171' }}
                    >
                      <LogOut size={14} />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
