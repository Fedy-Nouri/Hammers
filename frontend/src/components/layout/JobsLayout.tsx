import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { LayoutGrid, Sparkles, Settings } from 'lucide-react'

const TABS = [
  { label: 'Board', path: '/jobs', icon: LayoutGrid },
  { label: 'Matches', path: '/jobs/matches', icon: Sparkles },
  { label: 'Setup', path: '/jobs/setup', icon: Settings },
]

export default function JobsLayout() {
  const location = useLocation()
  const navigate = useNavigate()

  function isActive(path: string) {
    if (path === '/jobs') return location.pathname === '/jobs'
    return location.pathname.startsWith(path)
  }

  return (
    <div className="flex min-h-full">
      <aside
        className="sticky top-16 self-start w-44 shrink-0 py-4 px-2 border-r"
        style={{ borderColor: 'var(--color-border)', height: 'calc(100vh - 4rem)' }}
      >
        <p
          className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'rgba(255,255,255,0.25)' }}
        >
          Job Hunter
        </p>
        <nav className="flex flex-col gap-0.5">
          {TABS.map(({ label, path, icon: Icon }) => (
            <button
              key={path}
              onClick={() => void navigate(path)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all text-left w-full"
              style={{
                color: isActive(path) ? 'white' : 'rgba(255,255,255,0.45)',
                background: isActive(path) ? 'var(--color-surface-3)' : 'transparent',
              }}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="flex-1 min-w-0">
        <Outlet />
      </div>
    </div>
  )
}
