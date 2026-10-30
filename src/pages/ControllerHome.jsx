import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShieldCheck, Flag, MessageSquare, Search, UserCog, BarChart3, LogOut, ChevronRight,
  Crown, RefreshCw, BadgeCheck, Megaphone, GraduationCap,
} from 'lucide-react'
import ControllerShell, { ctl, CtlBlock, CtlSkeletonRows } from '../components/ControllerShell.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { ROLE_LABELS } from '../lib/team.js'

const OVERVIEW = [
  { key: 'pending_verifications', label: 'To verify', roles: ['owner', 'verifier'], color: '#7C3AED' },
  { key: 'pending_reports', label: 'Reports', roles: ['owner', 'moderator'], color: '#2563EB' },
  { key: 'open_feedback', label: 'Open messages', roles: ['owner', 'support', 'moderator'], color: '#10B981' },
]

const SECTIONS = [
  {
    title: 'Review',
    items: [
      { to: '/controller/verification', label: 'Verification queue', sub: 'IDs and school documents', icon: ShieldCheck, color: '#7C3AED', roles: ['owner', 'verifier'], count: 'pending_verifications' },
      { to: '/controller/school-reviews', label: 'School reviews', sub: 'Check school documents before payment', icon: ShieldCheck, color: '#0EA5E9', roles: ['owner', 'verifier'] },
      { to: '/controller/reports', label: 'User reports', sub: 'Posts, comments and profiles', icon: Flag, color: '#2563EB', roles: ['owner', 'moderator'], count: 'pending_reports' },
      { to: '/controller/complaints', label: 'Complaints', sub: 'Help and feedback messages', icon: MessageSquare, color: '#10B981', roles: ['owner', 'support', 'moderator'], count: 'open_feedback' },
    ],
  },
  {
    title: 'Manage',
    items: [
      { to: '/controller/users', label: 'Find a user', sub: 'Verify or ban accounts', icon: Search, color: '#F59E0B', roles: ['owner', 'verifier', 'moderator', 'support'] },
      { to: '/controller/verify-school', label: 'Verify a school', sub: 'Search any school and tick it', icon: BadgeCheck, color: '#0EA5E9', roles: ['owner', 'verifier'] },
    ],
  },
  {
    title: 'Team',
    items: [
      { to: '/controller/team', label: 'Team members', sub: 'Invite and manage the team', icon: UserCog, color: '#EC4899', roles: ['owner'] },
      { to: '/controller/activity', label: 'Site activity', sub: 'Numbers across Schoolink', icon: BarChart3, color: '#14B8A6', roles: ['owner'] },
      { to: '/controller/announce', label: 'Post an update', sub: 'Announce to everyone on Schoolink', icon: Megaphone, color: '#6366F1', roles: ['owner'] },
    ],
  },
]

const sectionLabel = {
  fontSize: 11, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase', color: ctl.faint, margin: '24px 4px 8px',
}

function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

function IconBtn({ label, onClick, children }) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      style={{
        width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: ctl.card, border: `1px solid ${ctl.border}`, color: ctl.muted, flexShrink: 0,
      }}
    >
      {children}
    </button>
  )
}

// Full-page placeholder shown on first load and on every refresh
function HomeSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading Control Center">
      <div className="flex items-center gap-3">
        <CtlBlock style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0 }} />
        <div className="flex-1">
          <CtlBlock style={{ height: 14, width: '40%' }} />
          <CtlBlock style={{ height: 10, width: '28%', marginTop: 8 }} />
        </div>
      </div>
      <CtlBlock style={{ height: 72, borderRadius: 16, marginTop: 20 }} />
      <CtlBlock style={{ height: 10, width: 70, marginTop: 24 }} />
      <div className="grid grid-cols-3 gap-2 mt-2">
        {[0, 1, 2].map((i) => <CtlBlock key={i} style={{ height: 74, borderRadius: 14 }} />)}
      </div>
      <CtlBlock style={{ height: 10, width: 60, marginTop: 24 }} />
      <div className="mt-2"><CtlSkeletonRows rows={3} /></div>
      <CtlBlock style={{ height: 10, width: 60, marginTop: 24 }} />
      <div className="mt-2"><CtlSkeletonRows rows={2} /></div>
    </div>
  )
}

export default function ControllerHome() {
  const navigate = useNavigate()
  const { user, profile, teamRole, signOut } = useAuth()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  async function load() {
    setLoading(true)
    setFailed(false)
    const { data, error } = await supabase.rpc('site_stats')
    if (error) setFailed(true)
    setStats(data || null)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleSignOut() {
    await signOut()
    navigate('/', { replace: true })
  }

  const name = profile?.full_name || user?.email || 'Team member'
  const count = (key) => Number(stats?.[key] || 0)
  const overview = OVERVIEW.filter((o) => o.roles.includes(teamRole))
  const sections = SECTIONS
    .map((s) => ({ ...s, items: s.items.filter((i) => i.roles.includes(teamRole)) }))
    .filter((s) => s.items.length)

  return (
    <ControllerShell title="Control Center" back={false} header={false}>
      {loading ? (
        <HomeSkeleton />
      ) : (
        <>
          {/* header */}
          <div className="flex items-center gap-3">
            <span
              style={{
                width: 40, height: 40, borderRadius: 12, background: ctl.accent, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
            >
              <GraduationCap size={22} />
            </span>
            <div className="flex-1 min-w-0">
              <p style={{ fontSize: 17, fontWeight: 700, color: ctl.text, lineHeight: 1.2 }}>Control Center</p>
              <p style={{ fontSize: 12, color: ctl.muted, marginTop: 2 }}>Schoolink team</p>
            </div>
            <IconBtn label="Refresh" onClick={load}><RefreshCw size={17} /></IconBtn>
            <IconBtn label="Sign out" onClick={handleSignOut}><LogOut size={17} /></IconBtn>
          </div>

          {/* profile card */}
          <button
            onClick={() => navigate('/controller/profile')}
            className="mt-5 flex w-full items-center gap-3 text-left"
            style={{ background: ctl.card, border: `1px solid ${ctl.border}`, borderRadius: 16, padding: 14 }}
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" style={{ width: 48, height: 48, borderRadius: 999, objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <span
                style={{
                  width: 48, height: 48, borderRadius: 999, background: ctl.raised, color: ctl.accentText,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, flexShrink: 0,
                }}
              >
                {initials(name)}
              </span>
            )}
            <span className="flex-1 min-w-0">
              <span className="block truncate" style={{ fontSize: 15, fontWeight: 600, color: ctl.text }}>{name}</span>
              <span className="block truncate" style={{ fontSize: 12, color: ctl.muted, marginTop: 2 }}>{user?.email}</span>
              <span
                className="inline-flex items-center gap-1"
                style={{
                  marginTop: 8, padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                  background: ctl.accentSoft, color: ctl.accentText,
                }}
              >
                {teamRole === 'owner' ? <Crown size={11} /> : <ShieldCheck size={11} />}
                {ROLE_LABELS[teamRole] || teamRole}
              </span>
            </span>
            <ChevronRight size={18} style={{ color: ctl.faint, flexShrink: 0 }} />
          </button>

          {/* overview counts */}
          {overview.length ? (
            <>
              <p style={sectionLabel}>Overview</p>
              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${overview.length}, minmax(0, 1fr))` }}>
                {overview.map((o) => (
                  <div key={o.key} style={{ background: ctl.card, border: `1px solid ${ctl.border}`, borderRadius: 14, padding: '12px 12px 11px' }}>
                    <p style={{ fontSize: 22, fontWeight: 700, color: ctl.text, lineHeight: 1 }}>
                      {count(o.key) > 999 ? '999+' : count(o.key)}
                    </p>
                    <p className="flex items-center gap-1.5" style={{ fontSize: 11.5, color: ctl.muted, marginTop: 7 }}>
                      <span style={{ width: 6, height: 6, borderRadius: 999, background: o.color, flexShrink: 0 }} />
                      {o.label}
                    </p>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          {/* sections */}
          {sections.map((sec) => (
            <div key={sec.title}>
              <p style={sectionLabel}>{sec.title}</p>
              <div style={{ background: ctl.card, border: `1px solid ${ctl.border}`, borderRadius: 16, overflow: 'hidden' }}>
                {sec.items.map((item, i) => {
                  const Icon = item.icon
                  const n = item.count ? count(item.count) : 0
                  return (
                    <button
                      key={item.to}
                      onClick={() => navigate(item.to)}
                      className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
                      style={{ borderTop: i ? `1px solid ${ctl.border}` : 'none' }}
                    >
                      <span
                        style={{
                          width: 36, height: 36, borderRadius: 10, background: `${item.color}22`, color: item.color,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}
                      >
                        <Icon size={18} />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block truncate" style={{ fontSize: 14.5, fontWeight: 600, color: ctl.text }}>{item.label}</span>
                        <span className="block truncate" style={{ fontSize: 12, color: ctl.muted, marginTop: 2 }}>{item.sub}</span>
                      </span>
                      {n > 0 ? (
                        <span
                          style={{
                            minWidth: 22, height: 22, padding: '0 7px', borderRadius: 999, background: ctl.bad, color: '#fff',
                            fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          {n > 99 ? '99+' : n}
                        </span>
                      ) : null}
                      <ChevronRight size={16} style={{ color: ctl.faint, flexShrink: 0 }} />
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {failed ? (
            <p style={{ fontSize: 12, color: ctl.warn, marginTop: 18, textAlign: 'center' }}>
              Could not load the counts. Tap refresh.
            </p>
          ) : null}
        </>
      )}
    </ControllerShell>
  )
  }
