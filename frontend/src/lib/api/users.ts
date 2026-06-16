import { type AxiosResponse } from 'axios'
import { api } from './client'
import type { UserResponse } from './auth'

const data = <T>(r: AxiosResponse<T>): T => r.data

export const usersApi = {
  getMe: () =>
    api.get<UserResponse>('/users/me').then(data),

  updateMe: (body: { firstName?: string; lastName?: string; email?: string }) =>
    api.patch<UserResponse>('/users/me', body).then(data),

  uploadAvatar: (file: File) => {
    const form = new FormData()
    form.append('avatar', file)
    return api.post<UserResponse>('/users/me/avatar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(data)
  },

  changePassword: (currentPassword: string, newPassword: string) =>
    api.patch<{ message: string }>('/users/me/password', { currentPassword, newPassword }).then(data),
}
