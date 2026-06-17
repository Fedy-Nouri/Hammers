import { api } from './client'

export interface GoogleStatus {
  connected: boolean
  email?: string
}

export const googleApi = {
  getStatus: async (): Promise<GoogleStatus> => {
    const { data } = await api.get<GoogleStatus>('/google/status')
    return data
  },

  getConnectUrl: async (): Promise<string> => {
    const { data } = await api.get<{ authUrl: string }>('/google/connect')
    return data.authUrl
  },

  disconnect: async (): Promise<void> => {
    await api.delete('/google/disconnect')
  },
}