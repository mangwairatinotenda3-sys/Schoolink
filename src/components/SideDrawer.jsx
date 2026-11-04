import { X, User, Settings, UserPlus, Users, Clock, Home, HelpCircle, Info, LogOut } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { canManageStaff, isSchoolMember } from '../lib/permissions.js'

// Side menu. Flat dark panel, one slide, no fades or glow. Colours are inline so it looks the same in every theme.
const PANEL = '#150F45'
const TEXT = '#F5F3FF'
const MUTED = '#8E8BC8'
const TILE = 'rgba(139,92,246,0.18)'
const ACTIVE = 'rgba(139,92,246,0.24)'

function Row({ label, icon: Icon, active, onClick, danger = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className="w-full flex items-center gap-3 text-left"
      style={{
        padding: '10px 12px',
        borderRadius: 14,
        background: active ? ACTIVE : 'transparent',
        color: danger ? '#FB7185' : TEXT,
      }}
    >
      <span
        style={{
          width: 34,
          height: 34,
          borderRadius: 11,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: danger ? 'rgba(244,63,94,0.14)' : TILE,
        }}
      >
        <Icon size={18} color={danger ? '#FB7185' : active ? '#FFFFFF' : '#C4B5FD'} />
      </span>
      <span style={{ fontSize: 15, fontWeight: active ? 600 : 500 }}>{label}</span>
    </button>
  )
}

function Group({ title, children }) {
  return (
    <div style={{ marginTop: 18 }}>
      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: MUTED, padding: '0 12px 6px' }}>{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

export default function SideDrawer({ open, onClose }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { profile, user, isGuest, signOut } = useAuth()

  function go(path) {
    onClose()
    navigate(path)
  }

  async function handleSignOut() {
    onClose()
    await signOut()
    navigate('/', { replace: true })
  }

  const menu = [
    { label: 'Home', icon: Home, to: '/home' },
    { label: 'Profile', icon: User, to: '/profile' },
    { label: 'Settings', icon: Settings, to: '/settings' },
    ...(isSchoolMember(profile) ? [{ label: 'Staff Directory', icon: Users, to: '/staff-directory' }] : []),
  ]
  const school = canManageStaff(profile)
    ? [
        { label: 'Invite a Member', icon: UserPlus, to: '/invite-member' },
        { label: 'Pending Approvals', icon: Clock, to: '/pending-approvals' },
      ]
    : []
  const help = [
    { label: 'Help & Support', icon: HelpCircle, to: '/settings/help' },
    { label: 'About Schoolink', icon: Info, to: '/about' },
  ]

  const name = isGuest ? 'Guest' : profile?.full_name || user?.email?.split('@')[0] || 'Guest'
  const subtitle = isGuest ? 'Not signed in' : profile?.role || user?.email || ''

  return (
    <>
      <div
        className={`fixed inset-0 z-40 ${open ? 'pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        style={{ background: 'rgba(5,3,25,0.55)' }}
        onClick={onClose}
      />
      <aside
        className={`fixed top-0 left-0 h-full z-50 flex flex-col transition-transform duration-200 ease-out ${open ? 'translate-x-0' : '-translate-x-full'}`}
        style={{
          width: 'min(84%, 320px)',
          background: PANEL,
          color: TEXT,
          borderRadius: '0 24px 24px 0',
          boxShadow: '4px 0 24px rgba(0,0,0,0.35)',
          paddingTop: 'max(16px, env(safe-area-inset-top))',
        }}
        aria-label="Side menu"
      >
        {/* Top: wordmark and close */}
        <div className="flex items-center justify-between px-5">
          <p style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.01em' }}>
            School<span style={{ color: '#A78BFA' }}>ink</span>
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            style={{ width: 36, height: 36, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: TILE, color: TEXT }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Profile */}
        <button
          type="button"
          onClick={() => go('/profile')}
          className="flex items-center gap-3 mx-3 mt-4 text-left"
          style={{ padding: 12, borderRadius: 18, background: 'rgba(255,255,255,0.05)' }}
        >
          <span
            style={{
              width: 52,
              height: 52,
              borderRadius: 999,
              overflow: 'hidden',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#3B2FA0',
            }}
          >
            {profile?.avatar_url && !isGuest ? (
              <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <User size={24} color="#FFFFFF" />
            )}
          </span>
          <span className="flex-1 min-w-0">
            <span className="block truncate" style={{ fontSize: 16, fontWeight: 600 }}>{name}</span>
            <span className="block truncate" style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{subtitle}</span>
          </span>
        </button>

        {/* Menu */}
        <nav className="flex-1 min-h-0 overflow-y-auto px-3 pb-4">
          <Group title="Menu">
            {menu.map(({ label, icon, to }) => (
              <Row key={label} label={label} icon={icon} active={pathname === to} onClick={() => go(to)} />
            ))}
          </Group>

          {school.length ? (
            <Group title="School">
              {school.map(({ label, icon, to }) => (
                <Row key={label} label={label} icon={icon} active={pathname === to} onClick={() => go(to)} />
              ))}
            </Group>
          ) : null}

          <Group title="Help">
            {help.map(({ label, icon, to }) => (
              <Row key={label} label={label} icon={icon} active={pathname === to} onClick={() => go(to)} />
            ))}
          </Group>
        </nav>

        {/* Sign in or out */}
        <div className="px-3 pb-6 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <Row
            label={isGuest ? 'Sign in' : 'Sign out'}
            icon={isGuest ? UserPlus : LogOut}
            onClick={handleSignOut}
            danger={!isGuest}
          />
        </div>
      </aside>
    </>
  )
        }
