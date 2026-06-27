import { useState, useRef, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Camera, Check, AlertCircle, Eye, EyeOff, Lock, User, BarChart2, Zap, DollarSign, Activity, ShieldAlert, Link2, Unlink, CreditCard, ArrowUpRight } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { usersApi } from '../lib/api/users'
import { usageApi } from '../lib/api/usage'
import { googleApi } from '../lib/api/google'
import { billingApi } from '../lib/api/billing'
import type { UsageSummary, UsageLog } from '../lib/api/usage'
import type { BillingUsage } from '../lib/api/billing'
import type { GoogleStatus } from '../lib/api/google'

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

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function formatCost(n: number): string {
  if (n === 0) return '$0.00'
  if (n < 0.001) return `$${n.toFixed(6)}`
  if (n < 1) return `$${n.toFixed(4)}`
  return `$${n.toFixed(2)}`
}

const PLAN_LABELS: Record<string, { label: string; color: string }> = {
  free: { label: 'Free', color: 'rgba(255,255,255,0.4)' },
  pro: { label: 'Pro', color: '#8b5cf6' },
  enterprise: { label: 'Enterprise', color: '#3b82f6' },
}

export default function ProfilePage() {
  const { user, updateUser, logout } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const fileRef = useRef<HTMLInputElement>(null)
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [infoStatus, setInfoStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [pwStatus, setPwStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [summary, setSummary] = useState<UsageSummary | null>(null)
  const [logs, setLogs] = useState<UsageLog[]>([])
  const [logsPage, setLogsPage] = useState(1)
  const [logsTotal, setLogsTotal] = useState(0)
  const LOGS_LIMIT = 5

  const [googleStatus, setGoogleStatus] = useState<GoogleStatus | null>(null)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [googleBanner, setGoogleBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const [billing, setBilling] = useState<BillingUsage | null>(null)
  const [billingBusy, setBillingBusy] = useState(false)
  const [billingMsg, setBillingMsg] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    usageApi.getSummary(30).then(setSummary).catch(() => null)
  }, [])

  useEffect(() => {
    billingApi.getUsage().then(setBilling).catch(() => null)
  }, [])

  // Returning from Stripe Checkout: refetch (the webhook may lag a moment) and clear the param.
  useEffect(() => {
    const checkout = searchParams.get('checkout')
    if (!checkout) return
    if (checkout === 'success') {
      setBillingMsg({ type: 'success', message: 'Subscription updated. Your new plan will appear shortly.' })
      billingApi.getUsage().then(setBilling).catch(() => null)
    }
    searchParams.delete('checkout')
    setSearchParams(searchParams, { replace: true })
  }, [searchParams, setSearchParams])

  async function startCheckout(plan: 'pro' | 'enterprise') {
    setBillingBusy(true)
    setBillingMsg(null)
    try {
      const { url } = await billingApi.createCheckout(plan)
      window.location.href = url
    } catch {
      setBillingBusy(false)
      setBillingMsg({ type: 'error', message: 'Could not start checkout — billing may not be configured yet.' })
    }
  }

  async function openPortal() {
    setBillingBusy(true)
    setBillingMsg(null)
    try {
      const { url } = await billingApi.createPortal()
      window.location.href = url
    } catch {
      setBillingBusy(false)
      setBillingMsg({ type: 'error', message: 'Could not open the billing portal — billing may not be configured yet.' })
    }
  }

  useEffect(() => {
    usageApi.getLogs(logsPage, LOGS_LIMIT).then((res) => {
      setLogs(res.data)
      setLogsTotal(res.total)
    }).catch(() => null)
  }, [logsPage])

  useEffect(() => {
    googleApi.getStatus().then(setGoogleStatus).catch(() => null)
  }, [])

  useEffect(() => {
    const param = searchParams.get('google')
    if (!param) return
    if (param === 'connected') {
      setGoogleBanner({ type: 'success', message: 'Google account connected successfully.' })
      googleApi.getStatus().then(setGoogleStatus).catch(() => null)
    } else if (param === 'error') {
      setGoogleBanner({ type: 'error', message: 'Failed to connect Google account. Please try again.' })
    }
    setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])

  const handleGoogleConnect = async () => {
    setGoogleLoading(true)
    try {
      const authUrl = await googleApi.getConnectUrl()
      window.location.href = authUrl
    } catch {
      setGoogleBanner({ type: 'error', message: 'Could not initiate Google connection. Please try again.' })
      setGoogleLoading(false)
    }
  }

  const handleGoogleDisconnect = async () => {
    setGoogleLoading(true)
    try {
      await googleApi.disconnect()
      setGoogleStatus({ connected: false })
      setGoogleBanner({ type: 'success', message: 'Google account disconnected.' })
    } catch {
      setGoogleBanner({ type: 'error', message: 'Failed to disconnect. Please try again.' })
    } finally {
      setGoogleLoading(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!deleteConfirm) { setDeleteConfirm(true); return }
    setDeleting(true)
    try {
      await usersApi.deleteAccount()
      await logout()
      void navigate('/')
    } catch {
      setDeleting(false)
      setDeleteConfirm(false)
    }
  }

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
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-medium text-white">Profile photo</p>
            {user?.subscriptionPlan && (() => {
              const plan = PLAN_LABELS[user.subscriptionPlan] ?? PLAN_LABELS.free
              return (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${plan.color}20`, color: plan.color, border: `1px solid ${plan.color}40` }}>
                  {plan.label}
                </span>
              )
            })()}
          </div>
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
        className="rounded-2xl p-6 mb-4"
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

      {/* Integrations */}
      <div
        className="rounded-2xl p-6 mb-4"
        style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center gap-2 mb-5">
          <Link2 size={15} style={{ color: 'var(--color-brand-400)' }} />
          <h2 className="text-sm font-semibold text-white">Integrations</h2>
        </div>

        {googleBanner && <StatusBanner type={googleBanner.type} message={googleBanner.message} />}

        <div
          className="flex items-center justify-between rounded-xl px-4 py-4"
          style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(66,133,244,0.12)', border: '1px solid rgba(66,133,244,0.2)' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-white">Google Account</p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {googleStatus?.connected
                  ? `Connected as ${googleStatus.email}`
                  : 'Connect to enable calendar access for Meeting Copilot'}
              </p>
            </div>
          </div>

          {googleStatus?.connected ? (
            <button
              onClick={() => void handleGoogleDisconnect()}
              disabled={googleLoading}
              className="ml-4 shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}
            >
              <Unlink size={13} />
              {googleLoading ? 'Disconnecting…' : 'Disconnect'}
            </button>
          ) : (
            <button
              onClick={() => void handleGoogleConnect()}
              disabled={googleLoading || googleStatus === null}
              className="ml-4 shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #4285F4, #34A853)' }}
            >
              <Link2 size={13} />
              {googleLoading ? 'Connecting…' : 'Connect'}
            </button>
          )}
        </div>
      </div>

      {/* Plan & Billing */}
      {billing && (() => {
        const plan = PLAN_LABELS[billing.plan] ?? PLAN_LABELS.free
        const barColor = billing.exceeded ? '#ef4444' : billing.percent >= 80 ? '#f59e0b' : '#10b981'
        const upgrades: ('pro' | 'enterprise')[] =
          billing.plan === 'free' ? ['pro', 'enterprise'] : billing.plan === 'pro' ? ['enterprise'] : []
        return (
          <div
            className="rounded-2xl p-6 mb-6"
            style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}
          >
            <div className="flex items-center gap-2 mb-5">
              <CreditCard size={15} style={{ color: 'var(--color-brand-400)' }} />
              <h2 className="text-sm font-semibold text-white">Plan &amp; Billing</h2>
              <span
                className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: `${plan.color}20`, color: plan.color, border: `1px solid ${plan.color}40` }}
              >
                {plan.label}
              </span>
            </div>

            {billingMsg && <StatusBanner type={billingMsg.type} message={billingMsg.message} />}

            {/* Usage bar */}
            <div className="flex items-center justify-between text-xs mb-2" style={{ color: 'rgba(255,255,255,0.55)' }}>
              <span>Monthly AI usage</span>
              <span>{formatCost(billing.usedUsd)} / {formatCost(billing.cap)}</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-3)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, billing.percent)}%`, background: barColor }}
              />
            </div>
            {billing.exceeded ? (
              <p className="text-xs mt-2" style={{ color: '#f87171' }}>
                You've reached your monthly limit — upgrade to keep using AI features.
              </p>
            ) : billing.percent >= 80 ? (
              <p className="text-xs mt-2" style={{ color: '#fbbf24' }}>
                You're at {billing.percent}% of your monthly limit.
              </p>
            ) : null}

            {/* Actions */}
            <div className="flex flex-wrap gap-2 mt-5">
              {upgrades.map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={billingBusy}
                  onClick={() => void startCheckout(p)}
                  className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium text-white transition-all disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, var(--color-brand-600), #3b82f6)' }}
                >
                  <ArrowUpRight size={14} />
                  Upgrade to {PLAN_LABELS[p]?.label ?? p}
                </button>
              ))}
              {billing.plan !== 'free' && (
                <button
                  type="button"
                  disabled={billingBusy}
                  onClick={() => void openPortal()}
                  className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium transition-all disabled:opacity-50"
                  style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'rgba(255,255,255,0.8)' }}
                >
                  Manage subscription
                </button>
              )}
            </div>
          </div>
        )
      })()}

      {/* Usage & Activity */}
      <div
        className="rounded-2xl p-6"
        style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center gap-2 mb-5">
          <BarChart2 size={15} style={{ color: 'var(--color-brand-400)' }} />
          <h2 className="text-sm font-semibold text-white">Usage &amp; Activity</h2>
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--color-surface-3)', color: 'rgba(255,255,255,0.4)' }}>
            Last 30 days
          </span>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { icon: Activity, label: 'AI calls', value: summary ? String(summary.totalCalls) : '—', color: '#8b5cf6' },
            { icon: Zap, label: 'Tokens used', value: summary ? formatTokens(summary.totalTokens) : '—', color: '#3b82f6' },
            { icon: DollarSign, label: 'Est. cost', value: summary ? formatCost(summary.totalCostUsd) : '—', color: '#10b981' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="rounded-xl p-4" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: `${color}20`, color }}>
                  <Icon size={13} />
                </div>
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</span>
              </div>
              <p className="text-xl font-bold text-white">{value}</p>
            </div>
          ))}
        </div>

        {/* By agent */}
        {summary && summary.byAgent.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-medium mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>Breakdown by agent</p>
            <div className="flex flex-col gap-2">
              {summary.byAgent.map((ag) => {
                const pct = summary.totalCalls > 0 ? (ag.calls / summary.totalCalls) * 100 : 0
                return (
                  <div key={ag.agentId ?? 'unknown'}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-white">{ag.agentId ?? 'Unknown'}</span>
                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        {ag.calls} call{ag.calls !== 1 ? 's' : ''} · {formatTokens(ag.totalTokens)} tokens · {formatCost(ag.costUsd)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-3)' }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, var(--color-brand-600), #3b82f6)' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* By provider */}
        {summary && summary.byProvider.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-medium mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>By provider</p>
            <div className="flex gap-2 flex-wrap">
              {summary.byProvider.map((p) => (
                <div key={p.provider} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
                  <span className="font-medium text-white capitalize">{p.provider}</span>
                  <span style={{ color: 'rgba(255,255,255,0.35)' }}>{p.calls} calls · {formatCost(p.costUsd)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Execution logs */}
        <div>
          <p className="text-xs font-medium mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>Execution logs</p>
          {logs.length === 0 ? (
            <div className="flex flex-col items-center py-8 gap-2">
              <Activity size={20} style={{ color: 'rgba(255,255,255,0.1)' }} />
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>No AI calls recorded yet</p>
            </div>
          ) : (
            <>
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
                      {['Provider / Model', 'Agent', 'Tokens', 'Cost', 'When'].map((h) => (
                        <th key={h} className="text-left px-3 py-2.5 font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log, i) => (
                      <tr key={log.id} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--color-surface-2)', borderBottom: i < logs.length - 1 ? '1px solid var(--color-border)' : undefined }}>
                        <td className="px-3 py-2.5">
                          <span className="font-medium text-white capitalize">{log.provider}</span>
                          <span className="ml-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{log.model}</span>
                        </td>
                        <td className="px-3 py-2.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{log.agentId ?? '—'}</td>
                        <td className="px-3 py-2.5">
                          <span style={{ color: 'rgba(255,255,255,0.7)' }}>{formatTokens(log.totalTokens)}</span>
                          <span className="ml-1" style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px' }}>
                            ({formatTokens(log.promptTokens)}↑ {formatTokens(log.completionTokens)}↓)
                          </span>
                        </td>
                        <td className="px-3 py-2.5" style={{ color: '#10b981' }}>{formatCost(log.costUsd)}</td>
                        <td className="px-3 py-2.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                          {new Date(log.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {logsTotal > LOGS_LIMIT && (
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{logsTotal} total logs</span>
                  <div className="flex items-center gap-2">
                    <button disabled={logsPage === 1} onClick={() => setLogsPage((p) => p - 1)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-30"
                      style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'rgba(255,255,255,0.6)' }}>
                      Prev
                    </button>
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      {logsPage} / {Math.ceil(logsTotal / LOGS_LIMIT)}
                    </span>
                    <button disabled={logsPage >= Math.ceil(logsTotal / LOGS_LIMIT)} onClick={() => setLogsPage((p) => p + 1)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-30"
                      style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'rgba(255,255,255,0.6)' }}>
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Danger zone */}
      <div
        className="rounded-2xl p-6"
        style={{ background: 'var(--color-surface-1)', border: '1px solid rgba(239,68,68,0.2)' }}
      >
        <div className="flex items-center gap-2 mb-4">
          <ShieldAlert size={15} style={{ color: '#f87171' }} />
          <h2 className="text-sm font-semibold" style={{ color: '#f87171' }}>Danger zone</h2>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white">Delete account</p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Permanently removes your account and all data. This cannot be undone.
            </p>
          </div>
          <button
            onClick={() => void handleDeleteAccount()}
            disabled={deleting}
            className="ml-6 flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
            style={{
              background: deleteConfirm ? 'rgba(239,68,68,0.15)' : 'transparent',
              border: '1px solid rgba(239,68,68,0.4)',
              color: '#f87171',
            }}
          >
            {deleting ? 'Deleting…' : deleteConfirm ? 'Confirm delete' : 'Delete account'}
          </button>
        </div>
        {deleteConfirm && !deleting && (
          <p className="text-xs mt-3" style={{ color: 'rgba(239,68,68,0.7)' }}>
            Click "Confirm delete" again to permanently delete your account.{' '}
            <button className="underline" onClick={() => setDeleteConfirm(false)}>Cancel</button>
          </p>
        )}
      </div>
    </div>
  )
}
