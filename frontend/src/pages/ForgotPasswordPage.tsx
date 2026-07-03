import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { z } from 'zod'
import { ArrowLeft, Mail, CheckCircle } from 'lucide-react'
import { authApi } from '../lib/api/auth'

const schema = z.object({ email: z.string().email('Enter a valid email') })
type FormValues = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false)
  const [devToken, setDevToken] = useState<string>()

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: standardSchemaResolver(schema),
  })

  const onSubmit = async (values: FormValues) => {
    const res = await authApi.forgotPassword(values.email)
    if (res.resetToken) setDevToken(res.resetToken)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <>
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
            <CheckCircle size={24} />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Check your email</h1>
          <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.4)' }}>
            If an account exists for that email, we've sent a reset link.
          </p>

          {devToken && (
            <div className="w-full rounded-xl p-4 mb-6 text-left" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <p className="text-xs font-semibold mb-1" style={{ color: '#fbbf24' }}>Dev mode — reset link</p>
              <Link to={`/reset-password?token=${devToken}`} className="text-xs font-mono break-all underline" style={{ color: 'var(--color-brand-400)' }}>
                Open reset page
              </Link>
            </div>
          )}

          <Link to="/login" className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-white" style={{ color: 'var(--color-brand-400)' }}>
            <ArrowLeft size={14} />
            Back to sign in
          </Link>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="flex flex-col items-center text-center mb-8">
        <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(139,92,246,0.15)', color: 'var(--color-brand-400)' }}>
          <Mail size={22} />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Forgot password?</h1>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Enter your email and we'll send a reset link.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>Email</label>
          <input
            type="email"
            placeholder="you@example.com"
            {...register('email')}
            className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none transition-all placeholder:opacity-20 focus:ring-2"
            style={{ background: 'var(--color-surface-2)', border: `1px solid ${errors.email ? 'rgba(239,68,68,0.5)' : 'var(--color-border)'}`, '--tw-ring-color': 'rgba(139,92,246,0.4)' } as React.CSSProperties}
          />
          {errors.email && <p className="text-xs mt-1.5" style={{ color: '#f87171' }}>{errors.email.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: 'linear-gradient(135deg, var(--color-brand-600), #3b82f6)' }}
        >
          {isSubmitting ? 'Sending…' : 'Send reset link'}
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
