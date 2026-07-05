import { describe, expect, it, vi } from 'vitest'
import { render, renderHook, screen, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from './AuthContext'

function Probe() {
  const { user, isLoading } = useAuth()
  return <div>{isLoading ? 'loading' : `user:${user ? user.email : 'none'}`}</div>
}

describe('AuthContext', () => {
  it('throws when useAuth is used outside AuthProvider', () => {
    // React logs the thrown error during render — silence it for a clean test run.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useAuth())).toThrow(/AuthProvider/)
    spy.mockRestore()
  })

  it('settles into a logged-out state when there is no refresh token', async () => {
    localStorage.clear()
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByText('user:none')).toBeInTheDocument())
  })
})
