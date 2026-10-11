import { X, User, Settings, UserPlus, Users, Clock, Home, HelpCircle, Info, LogOut, ChevronRight, GraduationCap } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { canManageStaff, isSchoolMember } from '../lib/permissions.js'

// Dark side menu. Colours are inline so it looks the same in every theme.
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

  const links = [
    { label: 'Home', icon: Home, to: '/home' },
    { label: 'Profile', icon: User, to: '/profile' },
    { label: 'Settings', icon: Settings, to: '/settings' },
    ...(isSchoolMember(profile) ? [{ label: 'Staff Directory', icon: Users, to: '/staff-directory' }] : []),
    ...(canManageStaff(profile)
      ? [
          { label: 'Invite a Member', icon: UserPlus, to: '/invite-member' },
          { label: 'Pending Approvals', icon: Clock, to: '/pending-approvals' },
        ]
      : []),
    { label: 'Help & Support', icon: HelpCircle, to: '/settings/help' },
    { label: 'About Schoolink', icon: Info, to: '/settings/updates' },
  ]

  const name = isGuest ? 'Guest' : profile?.full_name || user?.email?.split('@')[0] || 'Guest'
  const subtitle = isGuest ? 'Not signed in' : profile?.role || user?.email || ''

  return (
    <>
      <div
        className={`fixed inset-0 z-40 transition-opacity ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        style={{ background: 'rgba(0,0,0,0.55)' }}
        onClick={onClose}
      />
      <div
        className={`fixed top-0 left-0 h-full z-50 transition-transform ${open ? 'translate-x-0' : '-translate-x-full'}`}
        style={{
          width: 'min(86%, 340px)', overflowY: 'auto',
          background: 'linear-gradient(180deg, #1B1450 0%, #0E0B33 45%, #0A0828 100%)',
          borderRadius: '0 28px 28px 0', color: '#fff', boxShadow: '8px 0 40px rgba(0,0,0,0.5)',
        }}
      >
        {/* header */}
        <div
          style={{
            padding: '24px 20px 20px', position: 'relative',
            background: 'linear-gradient(135deg, rgba(109,77,255,0.55), rgba(27,20,80,0.2))',
            borderRadius: '0 28px 0 0',
          }}
        >
          <button onClick={onClose} aria-label="Close" style={{ position: 'absolute', top: 18, right: 18, color: '#fff' }}>
            <X size={24} />
          </button>
          <div className="flex items-center gap-3">
            <span
              style={{
                width: 52, height: 52, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg, #8B5CF6, #4F46E5)', flexShrink: 0,
              }}
            >
              <GraduationCap size={28} color="#fff" />
            </span>
            <div>
              <p style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.1 }}>
                School<span style={{ color: '#A78BFA' }}>ink</span>
              </p>
              <p style={{ fontSize: 11.5, color: '#C7D2FE' }}>Connect &nbsp;•&nbsp; Learn &nbsp;•&nbsp; Grow</p>
            </div>
          </div>

          <button onClick={() => go('/profile')} className="flex items-center gap-3 w-full text-left" style={{ marginTop: 18 }}>
            <span
              style={{
                width: 58, height: 58, borderRadius: 999, padding: 3, flexShrink: 0,
                background: 'linear-gradient(135deg, #A78BFA, #6D4DFF)',
              }}
            >
              {profile?.avatar_url && !isGuest ? (
                <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: 999, objectFit: 'cover' }} />
              ) : (
                <span
                  style={{
                    width: '100%', height: '100%', borderRadius: 999, background: '#3B2FA0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <User size={28} color="#fff" />
                </span>
              )}
            </span>
            <span className="flex-1 min-w-0">
              <span className="truncate" style={{ display: 'block', fontSize: 18, fontWeight: 700 }}>{name}</span>
              <span className="truncate" style={{ display: 'block', fontSize: 12.5, color: '#C7D2FE' }}>{subtitle}</span>
            </span>
            <ChevronRight size={20} color="#C7D2FE" />
          </button>
        </div>

        {/* menu */}
        <div style={{ padding: '16px 14px 24px' }}>
          {links.map(({ label, icon: Icon, to }) => {
            const active = pathname === to
            return (
              <button
                key={label}
                onClick={() => go(to)}
                className="w-full flex items-center gap-3 text-left"
                style={{
                  padding: '13px 14px', marginBottom: 6, borderRadius: 18, fontSize: 15, fontWeight: 500,
                  background: active ? 'linear-gradient(90deg, #5B4BFF, #7C3AED)' : 'transparent',
                  boxShadow: active ? '0 6px 20px rgba(91,75,255,0.45)' : 'none',
                }}
              >
                <Icon size={22} color={active ? '#fff' : '#A78BFA'} />
                <span className="flex-1">{label}</span>
                <ChevronRight size={18} color={active ? '#fff' : '#C7D2FE'} />
              </button>
            )
          })}

          <div style={{ height: 1, background: 'rgba(129,140,248,0.35)', margin: '12px 6px' }} />

          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 text-left"
            style={{ padding: '13px 14px', borderRadius: 18, fontSize: 15, fontWeight: 600, color: isGuest ? '#A78BFA' : '#F43F5E' }}
          >
            {isGuest ? <UserPlus size={22} /> : <LogOut size={22} />}
            <span className="flex-1">{isGuest ? 'Sign In' : 'Sign Out'}</span>
            <ChevronRight size={18} color="#C7D2FE" />
          </button>
        </div>
      </div>
    </>
  )
}
