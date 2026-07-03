import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { z } from 'zod'
import { ArrowLeft, Lock, CheckCircle, AlertCircle } from 'lucide-react'
import { authApi } from '../lib/api/auth'

const schema = z
  .object({
    password: z.string().min(8, 'Min. 8 characters'),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: 'Passwords do not match', path: ['confirm'] })
type FormValues = z.infer<typeof schema>

const inputCls =
  'w-full rounded-xl px-4 py-3 text-sm text-white outline-none transition-all placeholder:opacity-20 focus:ring-2'

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') ?? ''
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string>()

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: standardSchemaResolver(schema),
  })

  const onSubmit = async (values: FormValues) => {
    setError(undefined)
    try {
      await authApi.resetPassword(token, values.password)
      setDone(true)
      setTimeout(() => void navigate('/login'), 2000)
    } catch {
      setError('This reset link is invalid or has expired. Request a new one.')
    }
  }

  if (!token) {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
          <AlertCircle size={24} />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Invalid link</h1>
        <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.4)' }}>This reset link is missing its token.</p>
        <Link to="/forgot-password" className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--color-brand-400)' }}>
          <ArrowLeft size={14} />
          Request a new link
        </Link>
      </div>
    )
  }

  if (done) {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
          <CheckCircle size={24} />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Password reset</h1>
        <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.4)' }}>You can now sign in with your new password. Redirecting…</p>
        <Link to="/login" className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--color-brand-400)' }}>
          <ArrowLeft size={14} />
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col items-center text-center mb-8">
        <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(139,92,246,0.15)', color: 'var(--color-brand-400)' }}>
          <Lock size={22} />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Set a new password</h1>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Choose a strong password for your account.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm rounded-lg px-4 py-3 mb-4" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
          <AlertCircle size={15} />
          {error}
        </div>
      )}

      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>New password</label>
          <input
            type="password"
            placeholder="••••••••"
            {...register('password')}
            className={inputCls}
            style={{ background: 'var(--color-surface-2)', border: `1px solid ${errors.password ? 'rgba(239,68,68,0.5)' : 'var(--color-border)'}`, '--tw-ring-color': 'rgba(139,92,246,0.4)' } as React.CSSProperties}
          />
          {errors.password && <p className="text-xs mt-1.5" style={{ color: '#f87171' }}>{errors.password.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>Confirm password</label>
          <input
            type="password"
            placeholder="••••••••"
            {...register('confirm')}
            className={inputCls}
            style={{ background: 'var(--color-surface-2)', border: `1px solid ${errors.confirm ? 'rgba(239,68,68,0.5)' : 'var(--color-border)'}`, '--tw-ring-color': 'rgba(139,92,246,0.4)' } as React.CSSProperties}
          />
          {errors.confirm && <p className="text-xs mt-1.5" style={{ color: '#f87171' }}>{errors.confirm.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: 'linear-gradient(135deg, var(--color-brand-600), #3b82f6)' }}
        >
          {isSubmitting ? 'Resetting…' : 'Reset password'}
        </button>
      </form>

      <div className="mt-6 text-center">
        <Link to="/login" className="flex items-center justify-center gap-1 text-sm transition-colors hover:text-white" style={{ color: 'rgba(255,255,255,0.35)' }}>
          <ArrowLeft size={14} />
          Back to sign in
        </Link>
      </div>
    </>
  )
}
