import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})
type FormValues = z.infer<typeof schema>

export default function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { login } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (values: FormValues) => {
    setServerError('')
    try {
      await login(values.email, values.password)
      void navigate('/dashboard')
    } catch {
      setServerError('Invalid email or password')
    }
  }

  return (
    <>
      <h1 className="text-2xl font-bold text-white mb-1">{t('auth.login')}</h1>
      <p className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.4)' }}>
        Welcome back — pick up where you left off.
      </p>

      {serverError && (
        <div className="flex items-center gap-2 text-sm rounded-lg px-4 py-3 mb-4" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
          <AlertCircle size={15} />
          {serverError}
        </div>
      )}

      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>{t('auth.email')}</label>
          <input
            type="email"
            placeholder="you@example.com"
            {...register('email')}
            className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none transition-all placeholder:opacity-20 focus:ring-2"
            style={{ background: 'var(--color-surface-2)', border: `1px solid ${errors.email ? 'rgba(239,68,68,0.5)' : 'var(--color-border)'}`, '--tw-ring-color': 'rgba(139,92,246,0.4)' } as React.CSSProperties}
          />
          {errors.email && <p className="text-xs mt-1.5" style={{ color: '#f87171' }}>{errors.email.message}</p>}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>{t('auth.password')}</label>
            <Link to="/forgot-password" className="text-xs transition-colors hover:text-white" style={{ color: 'var(--color-brand-400)' }}>
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              {...register('password')}
              className="w-full rounded-xl px-4 py-3 pr-11 text-sm text-white outline-none transition-all placeholder:opacity-20 focus:ring-2"
              style={{ background: 'var(--color-surface-2)', border: `1px solid ${errors.password ? 'rgba(239,68,68,0.5)' : 'var(--color-border)'}`, '--tw-ring-color': 'rgba(139,92,246,0.4)' } as React.CSSProperties}
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && <p className="text-xs mt-1.5" style={{ color: '#f87171' }}>{errors.password.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="group w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          style={{ background: 'linear-gradient(135deg, var(--color-brand-600), #3b82f6)' }}
        >
          {isSubmitting ? 'Signing in…' : t('auth.login')}
          {!isSubmitting && <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />}
        </button>
      </form>

      <p className="text-center text-sm mt-6" style={{ color: 'rgba(255,255,255,0.35)' }}>
        {t('auth.noAccount')}{' '}
        <Link to="/register" className="font-medium transition-colors hover:text-white" style={{ color: 'var(--color-brand-400)' }}>
          {t('auth.register')}
        </Link>
      </p>
    </>
  )
}
