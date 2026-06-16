import { useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Camera, Check, AlertCircle, Eye, EyeOff, Lock, User } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { usersApi } from '../lib/api/users'

const infoSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email('Enter a valid email'),
})
type InfoValues = z.infer<typeof infoSchema>

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Required'),
    newPassword: z.string().min(8, 'Min. 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
type PasswordValues = z.infer<typeof passwordSchema>

function inputBase(hasError: boolean): React.CSSProperties {
  return {
    background: 'var(--color-surface-2)',
    border: `1px solid ${hasError ? 'rgba(239,68,68,0.5)' : 'var(--color-border)'}`,
  }
}
const cls = 'w-full rounded-xl px-4 py-3 text-sm text-white outline-none transition-all placeholder:opacity-20 focus:ring-2'
const ringStyle: React.CSSProperties = { '--tw-ring-color': 'rgba(139,92,246,0.4)' } as React.CSSProperties

function StatusBanner({ type, message }: { type: 'success' | 'error'; message: string }) {
  const isOk = type === 'success'
  return (
    <div
      className="flex items-center gap-2 text-sm rounded-lg px-4 py-3 mb-4"
      style={{
        background: isOk ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
        border: `1px solid ${isOk ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
        color: isOk ? '#34d399' : '#f87171',
      }}
    >
      {isOk ? <Check size={15} /> : <AlertCircle size={15} />}
      {message}
    </div>
  )
}

export default function ProfilePage() {
  const { user, updateUser } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [infoStatus, setInfoStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [pwStatus, setPwStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const initials = user?.firstName
    ? `${user.firstName[0]}${user.lastName ? user.lastName[0] : ''}`.toUpperCase()
    : (user?.email?.[0] ?? '?').toUpperCase()

  const {
    register,
    handleSubmit,
    formState: { errors: infoErrors, isSubmitting: infoSubmitting },
  } = useForm<InfoValues>({
    resolver: zodResolver(infoSchema),
    defaultValues: {
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      email: user?.email ?? '',
    },
  })

  const {
    register: regPw,
    handleSubmit: handlePw,
    reset: resetPw,
    formState: { errors: pwErrors, isSubmitting: pwSubmitting },
  } = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema) })

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarLoading(true)
    try {
      const updated = await usersApi.uploadAvatar(file)
      updateUser(updated)
    } catch {
      // silent — avatar upload failure is non-critical
    } finally {
      setAvatarLoading(false)
      e.target.value = ''
    }
  }

  const onInfoSubmit = async (values: InfoValues) => {
    setInfoStatus(null)
    try {
      const updated = await usersApi.updateMe(values)
      updateUser(updated)
      setInfoStatus({ type: 'success', message: 'Profile updated successfully' })
    } catch {
      setInfoStatus({ type: 'error', message: 'Failed to update profile. Please try again.' })
    }
  }

  const onPasswordSubmit = async (values: PasswordValues) => {
    setPwStatus(null)
    try {
      await usersApi.changePassword(values.currentPassword, values.newPassword)
      setPwStatus({ type: 'success', message: 'Password changed successfully' })
      resetPw()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      setPwStatus({
        type: 'error',
        message: msg.includes('401') || msg.includes('incorrect') ? 'Current password is incorrect' : 'Failed to change password',
      })
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold text-white mb-1">Profile</h1>
      <p className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.4)' }}>
        Manage your account information and security settings.
      </p>

      {/* Avatar */}
      <div
        className="rounded-2xl p-6 mb-4 flex items-center gap-6"
        style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}
      >
        <div className="relative flex-shrink-0">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center overflow-hidden"
            style={{ background: 'linear-gradient(135deg, var(--color-brand-500), #3b82f6)' }}
          >
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-bold text-white">{initials}</span>
            )}
          </div>
          {avatarLoading && (
            <div className="absolute inset-0 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
              <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: 'white', borderTopColor: 'transparent' }} />
            </div>
          )}
        </div>

        <div>
          <p className="text-sm font-medium text-white mb-1">Profile photo</p>
          <p className="text-xs mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>
            JPG, PNG, GIF or WebP · max 5 MB
          </p>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={avatarLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
            style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)', color: 'rgba(255,255,255,0.8)' }}
          >
            <Camera size={14} />
            {user?.avatarUrl ? 'Change photo' : 'Upload photo'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        </div>
      </div>

      {/* Personal info */}
      <div
        className="rounded-2xl p-6 mb-4"
        style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center gap-2 mb-5">
          <User size={15} style={{ color: 'var(--color-brand-400)' }} />
          <h2 className="text-sm font-semibold text-white">Personal information</h2>
        </div>

        {infoStatus && <StatusBanner type={infoStatus.type} message={infoStatus.message} />}

        <form className="space-y-4" onSubmit={handleSubmit(onInfoSubmit)}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>First name</label>
              <input
                placeholder="Jane"
                {...register('firstName')}
                className={cls}
                style={{ ...inputBase(!!infoErrors.firstName), ...ringStyle }}
              />
              {infoErrors.firstName && <p className="text-xs mt-1" style={{ color: '#f87171' }}>{infoErrors.firstName.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>Last name</label>
              <input
                placeholder="Doe"
                {...register('lastName')}
                className={cls}
                style={{ ...inputBase(!!infoErrors.lastName), ...ringStyle }}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              {...register('email')}
              className={cls}
              style={{ ...inputBase(!!infoErrors.email), ...ringStyle }}
            />
            {infoErrors.email && <p className="text-xs mt-1" style={{ color: '#f87171' }}>{infoErrors.email.message}</p>}
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={infoSubmitting}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, var(--color-brand-600), #3b82f6)' }}
            >
              {infoSubmitting ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Change password */}
      <div
        className="rounded-2xl p-6"
        style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center gap-2 mb-5">
          <Lock size={15} style={{ color: 'var(--color-brand-400)' }} />
          <h2 className="text-sm font-semibold text-white">Change password</h2>
        </div>

        {pwStatus && <StatusBanner type={pwStatus.type} message={pwStatus.message} />}

        <form className="space-y-4" onSubmit={handlePw(onPasswordSubmit)}>
          {(
            [
              { id: 'currentPassword' as const, label: 'Current password', show: showCurrent, toggle: () => setShowCurrent((v) => !v) },
              { id: 'newPassword' as const, label: 'New password', show: showNew, toggle: () => setShowNew((v) => !v) },
              { id: 'confirmPassword' as const, label: 'Confirm new password', show: showConfirm, toggle: () => setShowConfirm((v) => !v) },
            ] as const
          ).map(({ id, label, show, toggle }) => (
            <div key={id}>
              <label className="block text-xs font-medium mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</label>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  placeholder="••••••••"
                  {...regPw(id)}
                  className={`${cls} pr-11`}
                  style={{ ...inputBase(!!pwErrors[id]), ...ringStyle }}
                />
                <button type="button" onClick={toggle} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {show ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {pwErrors[id] && <p className="text-xs mt-1" style={{ color: '#f87171' }}>{pwErrors[id]?.message}</p>}
            </div>
          ))}

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={pwSubmitting}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, var(--color-brand-600), #3b82f6)' }}
            >
              {pwSubmitting ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
