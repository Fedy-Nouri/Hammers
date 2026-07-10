import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ProfilePage from './ProfilePage'

// Auth context — a logged-in user drives the hero + prefilled form.
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      subscriptionPlan: 'pro',
      avatarUrl: null,
    },
    updateUser: vi.fn(),
    logout: vi.fn(),
  }),
}))

// API modules — resolve to minimal shapes so every section renders without a backend.
vi.mock('../lib/api/users', () => ({ usersApi: { updateMe: vi.fn(), changePassword: vi.fn(), uploadAvatar: vi.fn(), deleteAccount: vi.fn() } }))
vi.mock('../lib/api/usage', () => ({
  usageApi: {
    getSummary: vi.fn().mockResolvedValue({
      totalCalls: 12,
      totalTokens: 3400,
      totalCostUsd: 0.42,
      byAgent: [],
      byProvider: [],
    }),
    getLogs: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  },
}))
vi.mock('../lib/api/google', () => ({ googleApi: { getStatus: vi.fn().mockResolvedValue({ connected: false }), getConnectUrl: vi.fn(), disconnect: vi.fn() } }))
vi.mock('../lib/api/billing', () => ({
  billingApi: {
    getUsage: vi.fn().mockResolvedValue({ plan: 'pro', usedUsd: 5, cap: 25, percent: 20, exceeded: false }),
    createCheckout: vi.fn(),
    createPortal: vi.fn(),
  },
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/profile']}>
      <ProfilePage />
    </MemoryRouter>,
  )
}

describe('ProfilePage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the hero with the user name and plan', async () => {
    renderPage()
    // Await the async-driven billing card so all initial effects settle inside act().
    await screen.findByText('Plan & Billing')
    expect(screen.getByRole('heading', { name: 'Jane Doe' })).toBeInTheDocument()
    expect(screen.getByText('jane@example.com')).toBeInTheDocument()
  })

  it('renders every account section', async () => {
    renderPage()
    await screen.findByText('Plan & Billing')
    expect(screen.getByText('Personal information')).toBeInTheDocument()
    expect(screen.getByText('Change password')).toBeInTheDocument()
    expect(screen.getByText('Integrations')).toBeInTheDocument()
    expect(screen.getByText('Usage & Activity')).toBeInTheDocument()
    expect(screen.getByText('Danger zone')).toBeInTheDocument()
  })

  it('prefills the personal-info form from the current user', async () => {
    renderPage()
    await screen.findByText('Plan & Billing')
    expect(screen.getByDisplayValue('Jane')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Doe')).toBeInTheDocument()
    expect(screen.getByDisplayValue('jane@example.com')).toBeInTheDocument()
  })

  it('renders the billing card once usage resolves', async () => {
    renderPage()
    expect(await screen.findByText('Plan & Billing')).toBeInTheDocument()
  })
})
