import { type AxiosResponse } from 'axios'
import { api } from './client'

const data = <T>(r: AxiosResponse<T>): T => r.data

export type JobStatus =
  | 'new'
  | 'saved'
  | 'applied'
  | 'interview'
  | 'offer'
  | 'rejected'
  | 'dismissed'

export type RemotePref = 'any' | 'remote' | 'hybrid' | 'onsite'

export interface JobProfile {
  id: string
  userId: string
  resumeUrl: string | null
  resumeText: string | null
  desiredTitles: string[]
  locations: string[]
  remotePref: RemotePref
  salaryMin: number | null
  keywords: string[]
  createdAt: string
  updatedAt: string
}

export interface JobApplication {
  id: string
  userId: string
  source: string
  url: string | null
  title: string
  company: string
  location: string | null
  description: string
  matchScore: number | null
  matchSummary: string | null
  strengths: string[]
  gaps: string[]
  coverLetter: string | null
  status: JobStatus
  notes: string | null
  appliedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface PreferencesInput {
  desiredTitles?: string[]
  locations?: string[]
  remotePref?: RemotePref
  salaryMin?: number
  keywords?: string[]
}

export interface IngestJobInput {
  url?: string
  title: string
  company: string
  location?: string
  description: string
}

export const jobsApi = {
  getProfile: () =>
    api.get<JobProfile | null>('/jobs/profile').then(data),

  setPreferences: (body: PreferencesInput) =>
    api.put<JobProfile>('/jobs/profile', body).then(data),

  uploadResume: (file: File) => {
    const form = new FormData()
    form.append('resume', file)
    return api
      .post<JobProfile>('/jobs/resume', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then(data)
  },

  ingest: (body: IngestJobInput) =>
    api.post<JobApplication>('/jobs/ingest', body).then(data),

  listApplications: (status?: JobStatus) =>
    api
      .get<JobApplication[]>('/jobs/applications', {
        params: status ? { status } : {},
      })
      .then(data),

  generateCoverLetter: (id: string) =>
    api.post<JobApplication>(`/jobs/applications/${id}/cover-letter`).then(data),

  updateApplication: (id: string, body: { status?: JobStatus; notes?: string }) =>
    api.patch<JobApplication>(`/jobs/applications/${id}`, body).then(data),

  deleteApplication: (id: string) => api.delete(`/jobs/applications/${id}`),
}
