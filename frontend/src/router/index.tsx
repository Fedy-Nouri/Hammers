import { lazy, Suspense } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import AppLayout from '../components/layout/AppLayout'
import AuthLayout from '../components/layout/AuthLayout'
import ProtectedRoute from '../components/auth/ProtectedRoute'
import MeetingBotLayout from '../components/layout/MeetingBotLayout'
import JobsLayout from '../components/layout/JobsLayout'

const HomePage = lazy(() => import('../pages/HomePage'))
const LoginPage = lazy(() => import('../pages/LoginPage'))
const RegisterPage = lazy(() => import('../pages/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('../pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('../pages/ResetPasswordPage'))
const DashboardPage = lazy(() => import('../pages/DashboardPage'))
const ProfilePage = lazy(() => import('../pages/ProfilePage'))
const ChatPage = lazy(() => import('../pages/ChatPage'))
const MarketplacePage = lazy(() => import('../pages/MarketplacePage'))
const AdminPage = lazy(() => import('../pages/AdminPage'))
const MeetingsPage = lazy(() => import('../pages/MeetingsPage'))
const MeetingMonitorPage = lazy(() => import('../pages/MeetingMonitorPage'))
const MeetingDetailPage = lazy(() => import('../pages/MeetingDetailPage'))
const MeetingReportPage = lazy(() => import('../pages/MeetingReportPage'))
const JobsBoardPage = lazy(() => import('../pages/JobsBoardPage'))
const JobsMatchesPage = lazy(() => import('../pages/JobsMatchesPage'))
const JobsSetupPage = lazy(() => import('../pages/JobsSetupPage'))

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
          { path: 'admin', element: wrap(AdminPage) },
          {
            path: 'meetings',
            element: <MeetingBotLayout />,
            children: [
              { index: true, element: wrap(MeetingsPage) },
              { path: 'monitor', element: wrap(MeetingMonitorPage) },
              { path: ':id', element: wrap(MeetingDetailPage) },
              { path: ':id/report', element: wrap(MeetingReportPage) },
            ],
          },
          {
            path: 'jobs',
            element: <JobsLayout />,
            children: [
              { index: true, element: wrap(JobsBoardPage) },
              { path: 'matches', element: wrap(JobsMatchesPage) },
              { path: 'setup', element: wrap(JobsSetupPage) },
            ],
          },
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
      { path: 'reset-password', element: wrap(ResetPasswordPage) },
    ],
  },
])

export default function AppRouter() {
  return <RouterProvider router={router} />
}
