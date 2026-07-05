import { afterEach, describe, expect, it } from 'vitest'
import { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import { api } from './client'

interface RequestHandler {
  fulfilled: (config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig
}

// Run the request interceptor the client registered against a bare config.
function applyRequestInterceptor(): InternalAxiosRequestConfig {
  const { handlers } = api.interceptors.request as unknown as { handlers: RequestHandler[] }
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig
  return handlers[0].fulfilled(config)
}

describe('api client', () => {
  afterEach(() => sessionStorage.clear())

  it('targets the /api base URL', () => {
    expect(api.defaults.baseURL).toBe('/api')
  })

  it('attaches a Bearer token from sessionStorage', () => {
    sessionStorage.setItem('accessToken', 'tok-123')
    expect(applyRequestInterceptor().headers.Authorization).toBe('Bearer tok-123')
  })

  it('omits Authorization when no token is stored', () => {
    expect(applyRequestInterceptor().headers.Authorization).toBeUndefined()
  })
})
