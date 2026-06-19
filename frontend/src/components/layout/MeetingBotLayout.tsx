import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Calendar, Monitor } from 'lucide-react'

const TABS = [
  { label: 'Meetings', path: '/meetings', icon: Calendar },
  { label: 'Monitor', path: '/meetings/monitor', icon: Monitor },
]

export default function MeetingBotLayout() {
  const location = useLocation()
  const navigate = useNavigate()

  function isActive(path: string) {
    if (path === '/meetings/monitor') return location.pathname.startsWith('/meetings/monitor')
    return location.pathname === '/meetings' ||
      (location.pathname.startsWith('/meetings/') && !location.pathname.startsWith('/meetings/monitor'))
  }

  return (
    <div className="flex flex-col min-h-full">
      <div
        className="sticky top-16 z-40 border-b"
        style={{ background: 'rgba(13,13,20,0.9)', borderColor: 'var(--color-border)', backdropFilter: 'blur(12px)' }}
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center gap-1 h-11">
          {TABS.map(({ label, path, icon: Icon }) => (
            <button
              key={path}
              onClick={() => void navigate(path)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={{
                color: isActive(path) ? 'white' : 'rgba(255,255,255,0.45)',
                background: isActive(path) ? 'var(--color-surface-3)' : 'transparent',
              }}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  )
}
