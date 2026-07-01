import { type AxiosResponse } from 'axios'
import { api } from './client'

export interface UserResponse {
  id: string
  email: string
  firstName?: string
  lastName?: string
  avatarUrl?: string
  subscriptionPlan: string
  role?: string
  createdAt: string
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  user: UserResponse
}

export interface TokensResponse {
  accessToken: string
  refreshToken: string
}

const data = <T>(r: AxiosResponse<T>): T => r.data

export const authApi = {
  register: (body: { email: string; password: string; firstName?: string; lastName?: string }) =>
    api.post<AuthResponse>('/auth/register', body).then(data),

  login: (body: { email: string; password: string }) =>
    api.post<AuthResponse>('/auth/login', body).then(data),

  refresh: (refreshToken: string) =>
    api.post<TokensResponse>('/auth/refresh', { refreshToken }).then(data),

  logout: () =>
    api.post<{ message: string }>('/auth/logout').then(data),

  forgotPassword: (email: string) =>
    api.post<{ message: string; resetToken?: string }>('/auth/forgot-password', { email }).then(data),

  resetPassword: (token: string, password: string) =>
    api.post<{ message: string }>('/auth/reset-password', { token, password }).then(data),
}
