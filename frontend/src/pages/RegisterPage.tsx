import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const schema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})
type FormValues = z.infer<typeof schema>

function InputField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>{label}</label>
      {children}
      {error && <p className="text-xs mt-1.5" style={{ color: '#f87171' }}>{error}</p>}
    </div>
  )
}

export default function RegisterPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { register: registerUser } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (values: FormValues) => {
    setServerError('')
    try {
      await registerUser(values)
      void navigate('/dashboard')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      setServerError(msg.includes('409') || msg.includes('conflict') ? 'Email already in use' : 'Something went wrong. Please try again.')
    }
  }

  const inputStyle = (hasError: boolean): React.CSSProperties => ({
    background: 'var(--color-surface-2)',
    border: `1px solid ${hasError ? 'rgba(239,68,68,0.5)' : 'var(--color-border)'}`,
    '--tw-ring-color': 'rgba(139,92,246,0.4)',
  } as React.CSSProperties)

  const inputClass = 'w-full rounded-xl px-4 py-3 text-sm text-white outline-none transition-all placeholder:opacity-20 focus:ring-2'

  return (
    <>
      <h1 className="text-2xl font-bold text-white mb-1">{t('auth.register')}</h1>
      <p className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.4)' }}>
        Create your account and start in seconds.
      </p>

      {serverError && (
        <div className="flex items-center gap-2 text-sm rounded-lg px-4 py-3 mb-4" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
          <AlertCircle size={15} />
          {serverError}
        </div>
      )}

      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-2 gap-3">
          <InputField label={t('auth.firstName')} error={errors.firstName?.message}>
            <input placeholder="Jane" {...register('firstName')} className={inputClass} style={inputStyle(!!errors.firstName)} />
          </InputField>
          <InputField label={t('auth.lastName')} error={errors.lastName?.message}>
            <input placeholder="Doe" {...register('lastName')} className={inputClass} style={inputStyle(!!errors.lastName)} />
          </InputField>
        </div>

        <InputField label={t('auth.email')} error={errors.email?.message}>
          <input type="email" placeholder="you@example.com" {...register('email')} className={inputClass} style={inputStyle(!!errors.email)} />
        </InputField>

        <InputField label={t('auth.password')} error={errors.password?.message}>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Min. 8 characters"
              {...register('password')}
              className={`${inputClass} pr-11`}
              style={inputStyle(!!errors.password)}
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </InputField>

        <button
          type="submit"
          disabled={isSubmitting}
          className="group w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          style={{ background: 'linear-gradient(135deg, var(--color-brand-600), #3b82f6)' }}
        >
          {isSubmitting ? 'Creating account…' : t('auth.register')}
          {!isSubmitting && <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />}
        </button>
      </form>

      <p className="text-center text-sm mt-6" style={{ color: 'rgba(255,255,255,0.35)' }}>
        {t('auth.hasAccount')}{' '}
        <Link to="/login" className="font-medium transition-colors hover:text-white" style={{ color: 'var(--color-brand-400)' }}>
          {t('auth.login')}
        </Link>
      </p>
    </>
  )
}
