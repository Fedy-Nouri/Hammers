import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Users, DollarSign, Activity, CreditCard, Shield, ShieldOff, Mail } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { adminApi, type AdminMetrics, type AdminUser, type EmailLogRow } from '../lib/api/admin'
import { agentsApi, type Agent } from '../lib/api/conversations'

const card = { background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' } as const
const dollars = (n: number) => `$${n.toFixed(n < 1 && n > 0 ? 4 : 2)}`

export default function AdminPage() {
  const { user } = useAuth()
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [emails, setEmails] = useState<EmailLogRow[]>([])

  useEffect(() => { adminApi.metrics().then(setMetrics).catch(() => null) }, [])
  useEffect(() => { adminApi.users().then((r) => setUsers(r.data)).catch(() => null) }, [])
  useEffect(() => { agentsApi.list().then(setAgents).catch(() => null) }, [])
  useEffect(() => { adminApi.emails(1, 10).then((r) => setEmails(r.data)).catch(() => null) }, [])

  if (user && user.role !== 'admin') return <Navigate to="/dashboard" replace />

  async function toggleRole(u: AdminUser) {
    const updated = await adminApi.setRole(u.id, u.role === 'admin' ? 'user' : 'admin')
    setUsers((prev) => prev.map((x) => (x.id === u.id ? updated : x)))
  }

  async function refreshAgents() {
    setAgents(await agentsApi.list().catch(() => agents))
  }
  async function toggleAgent(a: Agent) {
    await adminApi.updateAgent(a.id, { enabled: !a.enabled }).catch(() => null)
    await refreshAgents()
  }
  async function setMinPlan(a: Agent, minPlan: 'free' | 'pro' | 'enterprise') {
    await adminApi.updateAgent(a.id, { minPlan }).catch(() => null)
    await refreshAgents()
  }

  const stats = metrics && [
    { icon: Users, label: 'Users', value: String(metrics.totalUsers), color: '#8b5cf6' },
    { icon: CreditCard, label: 'Active subs', value: String(metrics.activeSubscriptions), color: '#3b82f6' },
    { icon: DollarSign, label: 'Est. MRR', value: dollars(metrics.estimatedMrrUsd), color: '#10b981' },
    { icon: Activity, label: 'AI cost (mo)', value: dollars(metrics.monthToDate.costUsd), color: '#f59e0b' },
  ]

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex items-center gap-2 mb-8">
        <Shield size={20} style={{ color: 'var(--color-brand-400)' }} />
        <h1 className="text-3xl font-bold text-white">Admin</h1>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {(stats || []).map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="rounded-2xl p-5" style={card}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}20`, color }}>
                <Icon size={14} />
              </div>
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</span>
            </div>
            <p className="text-2xl font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Users */}
      <section className="mb-10">
        <h2 className="text-base font-semibold text-white mb-3">Users</h2>
        <div className="rounded-2xl overflow-hidden" style={card}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: 'rgba(255,255,255,0.4)' }} className="text-xs text-left">
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">AI cost (mo)</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderTop: '1px solid var(--color-border)', color: 'rgba(255,255,255,0.8)' }}>
                  <td className="px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3 capitalize">{u.subscriptionPlan}</td>
                  <td className="px-4 py-3" style={{ color: 'rgba(255,255,255,0.5)' }}>{u.subscriptionStatus ?? '—'}</td>
                  <td className="px-4 py-3">{dollars(u.monthToDateCostUsd)}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full" style={u.role === 'admin' ? { background: 'rgba(139,92,246,0.15)', color: '#a78bfa' } : { background: 'var(--color-surface-3)', color: 'rgba(255,255,255,0.5)' }}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => void toggleRole(u)}
                      disabled={u.id === user?.id}
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition-colors disabled:opacity-30 hover:text-white"
                      style={{ color: 'rgba(255,255,255,0.5)', border: '1px solid var(--color-border)' }}
                      title={u.id === user?.id ? "You can't change your own role" : ''}
                    >
                      {u.role === 'admin' ? <ShieldOff size={12} /> : <Shield size={12} />}
                      {u.role === 'admin' ? 'Demote' : 'Make admin'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Agents */}
      <section className="mb-10">
        <h2 className="text-base font-semibold text-white mb-3">Agents</h2>
        <div className="rounded-2xl overflow-hidden" style={card}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: 'rgba(255,255,255,0.4)' }} className="text-xs text-left">
                <th className="px-4 py-3 font-medium">Agent</th>
                <th className="px-4 py-3 font-medium">Min plan</th>
                <th className="px-4 py-3 font-medium">Enabled</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.id} style={{ borderTop: '1px solid var(--color-border)', color: 'rgba(255,255,255,0.8)' }}>
                  <td className="px-4 py-3">{a.name}</td>
                  <td className="px-4 py-3">
                    <select
                      value={a.minPlan ?? 'free'}
                      onChange={(e) => void setMinPlan(a, e.target.value as 'free' | 'pro' | 'enterprise')}
                      className="text-xs rounded-lg px-2 py-1 outline-none"
                      style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'white' }}
                    >
                      <option value="free">free</option>
                      <option value="pro">pro</option>
                      <option value="enterprise">enterprise</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => void toggleAgent(a)}
                      className="text-xs px-2.5 py-1 rounded-lg transition-colors hover:opacity-90"
                      style={a.enabled ? { background: 'rgba(16,185,129,0.12)', color: '#10b981' } : { background: 'var(--color-surface-3)', color: 'rgba(255,255,255,0.4)' }}
                    >
                      {a.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Emails */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Mail size={15} style={{ color: 'var(--color-brand-400)' }} />
          <h2 className="text-base font-semibold text-white">Recent emails</h2>
          {metrics && <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{metrics.emails.sent} sent / {metrics.emails.total} logged</span>}
        </div>
        <div className="rounded-2xl overflow-hidden" style={card}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: 'rgba(255,255,255,0.4)' }} className="text-xs text-left">
                <th className="px-4 py-3 font-medium">To</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {emails.map((e) => (
                <tr key={e.id} style={{ borderTop: '1px solid var(--color-border)', color: 'rgba(255,255,255,0.7)' }}>
                  <td className="px-4 py-3">{e.to}</td>
                  <td className="px-4 py-3">{e.type}</td>
                  <td className="px-4 py-3" style={{ color: 'rgba(255,255,255,0.5)' }}>{e.status}</td>
                  <td className="px-4 py-3" style={{ color: 'rgba(255,255,255,0.4)' }}>{new Date(e.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {emails.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>No emails yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
