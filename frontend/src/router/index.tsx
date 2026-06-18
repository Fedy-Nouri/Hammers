import { lazy, Suspense } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import AppLayout from '../components/layout/AppLayout'
import AuthLayout from '../components/layout/AuthLayout'
import ProtectedRoute from '../components/auth/ProtectedRoute'

const HomePage = lazy(() => import('../pages/HomePage'))
const LoginPage = lazy(() => import('../pages/LoginPage'))
const RegisterPage = lazy(() => import('../pages/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('../pages/ForgotPasswordPage'))
const DashboardPage = lazy(() => import('../pages/DashboardPage'))
const ProfilePage = lazy(() => import('../pages/ProfilePage'))
const ChatPage = lazy(() => import('../pages/ChatPage'))
const MarketplacePage = lazy(() => import('../pages/MarketplacePage'))
const MeetingsPage = lazy(() => import('../pages/MeetingsPage'))
const MeetingMonitorPage = lazy(() => import('../pages/MeetingMonitorPage'))
const MeetingDetailPage = lazy(() => import('../pages/MeetingDetailPage'))

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div
        className="w-6 h-6 rounded-full border-2 animate-spin"
        style={{ borderColor: 'var(--color-brand-500)', borderTopColor: 'transparent' }}
      />
    </div>
  )
}

function wrap(Component: React.ComponentType) {
  return (
    <Suspense fallback={<PageLoader />}>
      <Component />
    </Suspense>
  )
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: wrap(HomePage) },
      // Protected
      {
        element: <ProtectedRoute />,
        children: [
          { path: 'dashboard', element: wrap(DashboardPage) },
          { path: 'profile', element: wrap(ProfilePage) },
          { path: 'chat', element: wrap(ChatPage) },
          { path: 'chat/:conversationId', element: wrap(ChatPage) },
          { path: 'marketplace', element: wrap(MarketplacePage) },
          { path: 'meetings', element: wrap(MeetingsPage) },
          { path: 'meetings/monitor', element: wrap(MeetingMonitorPage) },
          { path: 'meetings/:id', element: wrap(MeetingDetailPage) },
        ],
      },
    ],
  },
  {
    element: <AuthLayout />,
    children: [
      { path: 'login', element: wrap(LoginPage) },
      { path: 'register', element: wrap(RegisterPage) },
      { path: 'forgot-password', element: wrap(ForgotPasswordPage) },
    ],
  },
])

export default function AppRouter() {
  return <RouterProvider router={router} />
}
