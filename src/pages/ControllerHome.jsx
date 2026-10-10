import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, Flag, MessageSquare, Search, UserCog, BarChart3, LogOut, ChevronRight } from 'lucide-react'
import ControllerShell, { ctl } from '../components/ControllerShell.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { ROLE_LABELS } from '../lib/team.js'

const tiles = [
  { to: '/controller/verification', label: 'Verification Queue', sub: 'IDs and school documents', icon: ShieldCheck, roles: ['owner', 'verifier'], count: 'pending_verifications' },
  { to: '/controller/reports', label: 'User Reports', sub: 'Posts, comments and profiles', icon: Flag, roles: ['owner', 'moderator'], count: 'pending_reports' },
  { to: '/controller/complaints', label: 'Complaints', sub: 'Help and feedback messages', icon: MessageSquare, roles: ['owner', 'support', 'moderator'], count: 'open_feedback' },
  { to: '/controller/users', label: 'Find a User', sub: 'Verify or ban accounts', icon: Search, roles: ['owner', 'verifier', 'moderator', 'support'] },
  { to: '/controller/team', label: 'Team Members', sub: 'Invite and manage the team', icon: UserCog, roles: ['owner'] },
  { to: '/controller/activity', label: 'Site Activity', sub: 'Numbers across Schoolink', icon: BarChart3, roles: ['owner'] },
]

export default function ControllerHome() {
  const navigate = useNavigate()
  const { user, teamRole, signOut } = useAuth()
  const [stats, setStats] = useState(null)

  useEffect(() => {
    supabase.rpc('site_stats').then(({ data }) => setStats(data || null))
  }, [])

  async function handleSignOut() {
    await signOut()
    navigate('/', { replace: true })
  }

  return (
    <ControllerShell
      title="Control Center"
      back={false}
      right={
        <button onClick={handleSignOut} className="flex items-center gap-1 text-xs" style={{ color: ctl.muted }}>
          <LogOut size={16} /> Sign out
        </button>
      }
    >
      <div className="rounded-2xl p-4 mb-4" style={{ background: ctl.card, border: `1px solid ${ctl.border}` }}>
        <p className="text-xs" style={{ color: ctl.muted }}>Signed in as</p>
        <p className="text-sm font-medium truncate">{user?.email}</p>
        <span className="inline-block text-[11px] mt-2 px-2 py-0.5 rounded-full" style={{ background: ctl.accent, color: '#fff' }}>
          {ROLE_LABELS[teamRole] || teamRole}
        </span>
      </div>

      <div className="space-y-2">
        {tiles.filter((t) => t.roles.includes(teamRole)).map((t) => {
          const Icon = t.icon
          const n = t.count && stats ? Number(stats[t.count] || 0) : 0
          return (
            <button
              key={t.to}
              onClick={() => navigate(t.to)}
              className="w-full flex items-center gap-3 rounded-2xl p-4 text-left"
              style={{ background: ctl.card, border: `1px solid ${ctl.border}` }}
            >
              <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#1E2745' }}>
                <Icon size={18} style={{ color: ctl.accent }} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium">{t.label}</span>
                <span className="block text-xs" style={{ color: ctl.muted }}>{t.sub}</span>
              </span>
              {n > 0 ? (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: ctl.bad, color: '#fff' }}>{n}</span>
              ) : null}
              <ChevronRight size={16} style={{ color: ctl.muted }} />
            </button>
          )
        })}
      </div>
    </ControllerShell>
  )
}
