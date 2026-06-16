import { lazy, Suspense } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import AppLayout from '../components/layout/AppLayout'
import AuthLayout from '../components/layout/AuthLayout'

const HomePage = lazy(() => import('../pages/HomePage'))
const LoginPage = lazy(() => import('../pages/LoginPage'))
const RegisterPage = lazy(() => import('../pages/RegisterPage'))
const DashboardPage = lazy(() => import('../pages/DashboardPage'))

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--color-brand-500)', borderTopColor: 'transparent' }} />
    </div>
  )
}

function withSuspense(Component: React.ComponentType) {
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
      { index: true, element: withSuspense(HomePage) },
      { path: 'dashboard', element: withSuspense(DashboardPage) },
    ],
  },
  {
    element: <AuthLayout />,
    children: [
      { path: 'login', element: withSuspense(LoginPage) },
      { path: 'register', element: withSuspense(RegisterPage) },
    ],
  },
])

export default function AppRouter() {
  return <RouterProvider router={router} />
}
