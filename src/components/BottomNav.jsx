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

// One bar along the bottom on every screen and in every orientation, like WhatsApp.
const BAR = '#150F45'
const ACCENT = '#7C5CF0'
const IDLE = '#9C98D4'
const ACTIVE_PILL = 'rgba(139,92,246,0.24)'

function Tab({ to, label, icon: Icon, showBadge, unread }) {
  return (
    <NavLink
      to={to}
      aria-label={label}
      style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        textDecoration: 'none',
      }}
    >
      {({ isActive }) => (
        <>
          <span
            style={{
              position: 'relative',
              width: 48,
              height: 28,
              borderRadius: 999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isActive ? ACTIVE_PILL : 'transparent',
            }}
          >
            <Icon size={20} strokeWidth={isActive ? 2.3 : 2} color={isActive ? '#FFFFFF' : IDLE} />
            {showBadge && unread > 0 ? (
              <span
                style={{
                  position: 'absolute',
                  top: -3,
                  right: 2,
                  minWidth: 16,
                  height: 16,
                  padding: '0 4px',
                  borderRadius: 999,
                  background: '#F43F5E',
                  color: '#FFFFFF',
                  fontSize: 9,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: `2px solid ${BAR}`,
                }}
              >
                {unread > 9 ? '9+' : unread}
              </span>
            ) : null}
          </span>
          <span style={{ fontSize: 11, lineHeight: 1, fontWeight: isActive ? 600 : 500, color: isActive ? '#FFFFFF' : IDLE }}>{label}</span>
        </>
      )}
    </NavLink>
  )
}

// The create button is a small round button in the middle
function PostButton({ label, onClick }) {
  return (
    <div style={{ width: 64, flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        style={{
          width: 42,
          height: 42,
          borderRadius: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: ACCENT,
          color: '#FFFFFF',
          border: 'none',
        }}
      >
        <Plus size={22} strokeWidth={2.4} color="#FFFFFF" />
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
          display: 'flex',
          alignItems: 'center',
          boxSizing: 'border-box',
          height: 'calc(60px + env(safe-area-inset-bottom, 0px))',
          paddingLeft: 'max(8px, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(8px, env(safe-area-inset-right, 0px))',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          background: BAR,
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {left.map((item) => <Tab key={item.to} {...item} unread={unread} />)}
        {showPost ? <PostButton label={t('post')} onClick={() => setCreateOpen(true)} /> : null}
        {right.map((item) => <Tab key={item.to} {...item} unread={unread} />)}
      </nav>

      <CreateSheet open={createOpen} onClose={() => setCreateOpen(false)} />
      <OnboardingTour />
    </>
  )
    }
