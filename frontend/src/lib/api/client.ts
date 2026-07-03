import axios, { type InternalAxiosRequestConfig } from 'axios'

// Empty by default → same-origin relative '/api' (works behind the nginx reverse proxy).
// Set VITE_API_URL (e.g. https://api.example.com) for a split-origin deploy; the backend
// must then allow that browser origin via CORS_ORIGINS. Used by axios and the raw-fetch
// SSE streams (chat, transcript) so there is one source of truth for the API origin.
export const API_BASE: string = import.meta.env.VITE_API_URL ?? ''

export const api = axios.create({
  baseURL: `${API_BASE}/api`,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = sessionStorage.getItem('accessToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
