import { useEffect, useState } from 'react'
import { Home, MessageCircle, Plus, Bell, User } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useUnreadCount } from '../lib/useUnreadCount.js'
import { useTranslation } from '../lib/i18n.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { canPost } from '../lib/permissions.js'
import OnboardingTour from './OnboardingTour.jsx'
import CreateSheet from './CreateSheet.jsx'
import { initNavAutoHide } from '../lib/navAutoHide.js'

// A floating, frosted pill along the bottom, matching the "What's on your mind?" card.
const THEME = {
  dark: {
    glass: 'rgba(27,23,57,0.80)',
    border: 'rgba(255,255,255,0.10)',
    shadow: '0 14px 34px rgba(5,3,20,0.50)',
    idle: '#A7A3CC',
    active: '#FFFFFF',
    accent: '#7C5CFF',
    ring: '#0B0920',
    badgeRing: '#1B1739',
  },
  light: {
    glass: 'rgba(255,255,255,0.84)',
    border: 'rgba(108,76,224,0.12)',
    shadow: '0 14px 34px rgba(90,70,200,0.20)',
    idle: '#8A87A8',
    active: '#6C4CE0',
    accent: '#6C4CE0',
    ring: '#FFFFFF',
    badgeRing: '#FFFFFF',
  },
}

function Tab({ to, label, icon: Icon, showBadge, unread, t }) {
  return (
    <NavLink
      to={to}
      aria-label={label}
      style={{
        flex: 1,
        minWidth: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        textDecoration: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {({ isActive }) => (
        <>
          <span style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 24 }}>
            <Icon size={23} strokeWidth={isActive ? 2.4 : 1.9} color={isActive ? t.active : t.idle} />
            {showBadge && unread > 0 ? (
              <span
                style={{
                  position: 'absolute',
                  top: -4,
                  right: -8,
                  minWidth: 17,
                  height: 17,
                  padding: '0 4px',
                  borderRadius: 999,
                  background: '#F43F5E',
                  color: '#FFFFFF',
                  fontSize: 9.5,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: `2px solid ${t.badgeRing}`,
                }}
              >
                {unread > 9 ? '9+' : unread}
              </span>
            ) : null}
          </span>
          <span style={{ fontSize: 11, lineHeight: 1, fontWeight: isActive ? 700 : 500, color: isActive ? t.active : t.idle }}>{label}</span>
        </>
      )}
    </NavLink>
  )
}

// The create button: a raised, glowing circle in the middle of the pill
function PostButton({ label, onClick, t }) {
  return (
    <div style={{ width: 78, flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', top: -22 }}>
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        style={{
          width: 60,
          height: 60,
          borderRadius: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(145deg, #A583FF 0%, #6C4CE0 55%, #4F38C8 100%)',
          boxShadow: '0 10px 24px rgba(108,76,224,0.50), inset 0 1px 0 rgba(255,255,255,0.35)',
          border: `4px solid ${t.ring}`,
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <Plus size={28} strokeWidth={2.4} color="#FFFFFF" />
      </button>
    </div>
  )
}

export default function BottomNav() {
  const unread = useUnreadCount()
  const { t } = useTranslation()
  const { profile } = useAuth()
  const showPost = canPost(profile)
  const [createOpen, setCreateOpen] = useState(false)
  const theme = THEME[profile?.dark_mode ? 'dark' : 'light']

  // Hide the bar while scrolling down; bring it back when scrolling up or when scrolling stops
  useEffect(() => initNavAutoHide(), [])

  const left = [
    { to: '/home', label: t('home'), icon: Home },
    { to: '/chats', label: t('chats'), icon: MessageCircle },
  ]
  const right = [
    { to: '/notifications', label: t('alerts'), icon: Bell, showBadge: true },
    { to: '/profile', label: t('profile'), icon: User },
  ]

  return (
    <>
      <nav
        className="nav-bottom"
        aria-label="Main"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 30,
          boxSizing: 'border-box',
          // room above the pill for the raised create button
          paddingTop: 26,
          paddingLeft: 'max(14px, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(14px, env(safe-area-inset-right, 0px))',
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
          background: 'transparent',
          borderTop: 'none',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            position: 'relative',
            height: 66,
            display: 'flex',
            alignItems: 'stretch',
            padding: '0 8px',
            borderRadius: 33,
            background: theme.glass,
            backdropFilter: 'blur(22px) saturate(170%)',
            WebkitBackdropFilter: 'blur(22px) saturate(170%)',
            border: `1px solid ${theme.border}`,
            boxShadow: theme.shadow,
            pointerEvents: 'auto',
          }}
        >
          {left.map((item) => <Tab key={item.to} {...item} unread={unread} t={theme} />)}
          {showPost ? <PostButton label={t('post')} onClick={() => setCreateOpen(true)} t={theme} /> : null}
          {right.map((item) => <Tab key={item.to} {...item} unread={unread} t={theme} />)}
        </div>
      </nav>

      <CreateSheet open={createOpen} onClose={() => setCreateOpen(false)} />
      <OnboardingTour />
    </>
  )
  }
