import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, Flag, MessageSquare, Search, UserCog, BarChart3, LogOut, ChevronRight, GraduationCap, Crown, User, Plus, Bug, Scale, Wallet } from 'lucide-react'
import ControllerShell, { ctl } from '../components/ControllerShell.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { ROLE_LABELS } from '../lib/team.js'

const tiles = [
  { to: '/controller/verification', label: 'Verification Queue', sub: 'IDs and school documents', icon: ShieldCheck, color: '#7C3AED', roles: ['owner', 'verifier'], count: 'pending_verifications' },
  { to: '/controller/reports', label: 'User Reports', sub: 'Posts, comments and profiles', icon: Flag, color: '#2563EB', roles: ['owner', 'moderator'], count: 'pending_reports' },
  { to: '/controller/appeals', label: 'Ban Appeals', sub: 'People asking to be unbanned', icon: Scale, color: '#E11D48', roles: ['owner', 'moderator'], count: 'pending_appeals' },
  { to: '/controller/complaints', label: 'Complaints', sub: 'Help and feedback messages', icon: MessageSquare, color: '#10B981', roles: ['owner', 'support', 'moderator'], count: 'open_feedback' },
  { to: '/controller/users', label: 'Find a User', sub: 'Verify or ban accounts', icon: Search, color: '#F59E0B', roles: ['owner', 'verifier', 'moderator', 'support'] },
  { to: '/controller/team', label: 'Team Members', sub: 'Invite and manage the team', icon: UserCog, color: '#EC4899', roles: ['owner'] },
  { to: '/controller/activity', label: 'Site Activity', sub: 'Numbers across Schoolink', icon: BarChart3, color: '#14B8A6', roles: ['owner'] },
  { to: '/controller/app-health', label: 'App Health', sub: 'Crashes and screen usage', icon: Bug, color: '#EF4444', roles: ['owner'] },
   { to: '/controller/payments', label: 'School Payments', sub: 'Confirm School Plus payments', icon: Wallet, color: '#D97706', roles: ['owner'] },
]

export default function ControllerHome() {
  const navigate = useNavigate()
  const { user, profile, teamRole, signOut } = useAuth()
  const [stats, setStats] = useState(null)

  useEffect(() => {
    supabase.rpc('site_stats').then(({ data }) => setStats((prev) => ({ ...(data || {}), ...(prev || {}) })))
    supabase.rpc('list_appeals', { p_status: 'pending' }).then(({ data }) => {
      if (data?.ok) setStats((prev) => ({ ...(prev || {}), pending_appeals: data.items?.length ?? 0 }))
    })
  }, [])

  async function handleSignOut() {
    await signOut()
    navigate('/', { replace: true })
  }

  const plusButton = teamRole === 'owner' ? (
    <button
      onClick={() => navigate('/controller/announce')}
      aria-label="Post an update"
      style={{
        width: 84, height: 84, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'radial-gradient(circle, rgba(124,58,237,0.35), rgba(124,58,237,0) 70%)',
        border: '1px solid rgba(167,139,250,0.55)',
      }}
    >
      <span
        style={{
          width: 62, height: 62, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg, #6366F1, #7C3AED)', color: '#fff',
          boxShadow: '0 0 24px rgba(124,58,237,0.8)',
        }}
      >
        <Plus size={32} />
      </span>
    </button>
  ) : null

  return (
    <ControllerShell title="Control Center" back={false} header={false} floating={plusButton}>
      <div style={{ position: 'relative' }}>
        {/* soft glow in the top-right corner */}
        <div
          style={{
            position: 'absolute', top: -60, right: -70, width: 300, height: 260, pointerEvents: 'none',
            background: 'radial-gradient(circle at 60% 40%, rgba(99,102,241,0.45), rgba(99,102,241,0) 65%)',
          }}
        />

        <div style={{ position: 'relative' }}>
          {/* top bar */}
          <div className="flex items-center gap-3">
            <span
              style={{
                width: 48, height: 48, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg, #8B5CF6, #4F46E5)', color: '#fff', flexShrink: 0,
              }}
            >
              <GraduationCap size={26} />
            </span>
            <div className="flex-1 min-w-0">
              <p style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.1, color: '#fff' }}>Schoolink</p>
              <p style={{ fontSize: 12, color: ctl.muted }}>Connect &nbsp;•&nbsp; Manage &nbsp;•&nbsp; Grow</p>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5"
              style={{ border: '1px solid rgba(129,140,248,0.6)', borderRadius: 999, padding: '8px 12px', fontSize: 12, color: '#fff', background: 'rgba(99,102,241,0.15)' }}
            >
              <LogOut size={15} /> Sign out
            </button>
          </div>

          {/* title */}
          <div className="flex items-stretch gap-3 mt-5">
            <span style={{ width: 4, borderRadius: 4, background: '#7C3AED', flexShrink: 0 }} />
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 700, color: '#fff', lineHeight: 1.15 }}>Control Center</h1>
              <p style={{ fontSize: 12.5, color: '#CBD5E1', marginTop: 4 }}>
                Access your school tools and manage your platform from one place.
              </p>
            </div>
          </div>

                              {/* signed-in card: tap to open your profile */}
          <button
            onClick={() => navigate('/controller/profile')}
            className="flex items-center gap-3 mt-5 w-full text-left"
            style={{
              borderRadius: 18, padding: 14,
              background: 'linear-gradient(135deg, rgba(79,70,229,0.55), rgba(30,27,107,0.75))',
              border: '1px solid rgba(129,140,248,0.55)',
            }}
          >
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                style={{ width: 56, height: 56, borderRadius: 999, objectFit: 'cover', flexShrink: 0 }}
              />
            ) : (
              <span
                style={{
                  width: 56, height: 56, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'linear-gradient(135deg, #8B5CF6, #4F46E5)', color: '#fff', flexShrink: 0,
                }}
              >
                <User size={28} />
              </span>
            )}
            <span className="flex-1 min-w-0">
              <span style={{ display: 'block', fontSize: 10.5, letterSpacing: 0.6, color: '#C7D2FE' }}>SIGNED IN AS</span>
              <span className="truncate" style={{ display: 'block', fontSize: 17, fontWeight: 700, color: '#fff' }}>{user?.email}</span>
              <span
                className="inline-flex items-center gap-1"
                style={{ marginTop: 6, padding: '3px 10px', borderRadius: 999, fontSize: 11.5, background: '#5B4BFF', color: '#fff' }}
              >
                {teamRole === 'owner' ? <Crown size={12} /> : <ShieldCheck size={12} />}
                {ROLE_LABELS[teamRole] || teamRole}
              </span>
            </span>
            <ChevronRight size={20} style={{ color: '#C7D2FE' }} />
          </button>

          {/* tiles */}
          <div className="grid grid-cols-2 gap-3 mt-4">
            {tiles.filter((t) => t.roles.includes(teamRole)).map((t) => {
              const Icon = t.icon
              const n = t.count && stats ? Number(stats[t.count] || 0) : 0
              return (
                <button
                  key={t.to}
                  onClick={() => navigate(t.to)}
                  className="flex items-center gap-2 text-left"
                  style={{
                    position: 'relative', padding: '14px 8px 14px 12px', borderRadius: 16, minHeight: 92,
                    background: 'linear-gradient(135deg, rgba(30,41,99,0.8), rgba(12,18,52,0.9))',
                    border: `1px solid ${ctl.border}`, borderLeft: `4px solid ${t.color}`,
                  }}
                >
                  <span
                    style={{
                      width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: t.color, color: '#fff', flexShrink: 0,
                    }}
                  >
                    <Icon size={22} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>{t.label}</span>
                    <span style={{ display: 'block', fontSize: 11, color: ctl.muted, marginTop: 3, lineHeight: 1.25 }}>{t.sub}</span>
                  </span>
                  <ChevronRight size={16} style={{ color: '#C7D2FE', flexShrink: 0 }} />
                  {n > 0 ? (
                    <span
                      style={{
                        position: 'absolute', top: -7, right: -5, minWidth: 20, height: 20, padding: '0 6px', borderRadius: 999,
                        fontSize: 11, fontWeight: 700, color: '#fff', background: ctl.bad,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {n > 99 ? '99+' : n}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>

          {/* banner */}
          <div
            className="flex items-center gap-3 mt-4"
            style={{
              position: 'relative', overflow: 'hidden', borderRadius: 16, padding: '16px 14px',
              background: 'linear-gradient(90deg, #1E2A8A, #2B35D8)', border: '1px solid rgba(129,140,248,0.4)',
            }}
          >
            <span style={{ color: '#A5B4FC', flexShrink: 0, position: 'relative' }}>
              <GraduationCap size={36} />
            </span>
            <div style={{ position: 'relative', maxWidth: '62%' }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#fff', lineHeight: 1.25 }}>Better Schools. Stronger Communities.</p>
              <p style={{ fontSize: 11.5, color: '#C7D2FE', marginTop: 4 }}>Everything you need, all in one place.</p>
            </div>
            <svg
              width="120" height="70" viewBox="0 0 120 70" aria-hidden="true"
              style={{ position: 'absolute', right: 0, bottom: 0, opacity: 0.3 }}
            >
              <rect x="10" y="30" width="100" height="40" fill="#818CF8" />
              <rect x="40" y="14" width="40" height="56" fill="#A5B4FC" />
              <polygon points="60,0 40,14 80,14" fill="#A5B4FC" />
              <rect x="54" y="48" width="12" height="22" fill="#1E2A8A" />
              <rect x="18" y="40" width="10" height="10" fill="#1E2A8A" />
              <rect x="92" y="40" width="10" height="10" fill="#1E2A8A" />
              <rect x="46" y="26" width="8" height="8" fill="#1E2A8A" />
              <rect x="66" y="26" width="8" height="8" fill="#1E2A8A" />
            </svg>
          </div>
        </div>
      </div>
    </ControllerShell>
  )
                                                           }
