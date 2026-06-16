import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export default function ProtectedRoute() {
  const { accessToken, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div
          className="w-6 h-6 rounded-full border-2 animate-spin"
          style={{ borderColor: 'var(--color-brand-500)', borderTopColor: 'transparent' }}
        />
      </div>
    )
  }

  return accessToken ? <Outlet /> : <Navigate to="/login" replace />
}
