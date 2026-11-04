import { useState } from 'react'
import { Home, MessageCircle, Plus, Bell, User } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useUnreadCount } from '../lib/useUnreadCount.js'
import { useTranslation } from '../lib/i18n.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { canPost } from '../lib/permissions.js'
import OnboardingTour from './OnboardingTour.jsx'
import CreateSheet from './CreateSheet.jsx'

// Phones in portrait use the bar at the bottom. Tablets and landscape screens show the
// same tabs as a side bar (the nav-side rules are in index.css). Flat colours, no glow, no animation.
const BAR = '#150F45'
const ACCENT = '#7C5CF0'
const IDLE = '#9C98D4'
const ACTIVE_PILL = 'rgba(139,92,246,0.24)'

function Tab({ to, label, icon: Icon, showBadge, unread, vertical = false }) {
  return (
    <NavLink
      to={to}
      aria-label={label}
      style={{
        flex: vertical ? undefined : 1,
        width: vertical ? '100%' : undefined,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        textDecoration: 'none',
      }}
    >
      {({ isActive }) => (
        <>
          <span
            style={{
              position: 'relative',
              width: 52,
              height: 30,
              borderRadius: 999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isActive ? ACTIVE_PILL : 'transparent',
            }}
          >
            <Icon size={21} strokeWidth={isActive ? 2.3 : 2} color={isActive ? '#FFFFFF' : IDLE} />
            {showBadge && unread > 0 ? (
              <span
                style={{
                  position: 'absolute',
                  top: -3,
                  right: 4,
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

function PostButton({ label, onClick, big = true }) {
  const size = big ? 56 : 48
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{
        width: size,
        height: size,
        marginTop: big ? -24 : 0,
        borderRadius: 999,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: ACCENT,
        color: '#FFFFFF',
        border: `4px solid ${BAR}`,
      }}
    >
      <Plus size={big ? 26 : 22} strokeWidth={2.5} color="#FFFFFF" />
    </button>
  )
}

export default function BottomNav() {
  const unread = useUnreadCount()
  const { t } = useTranslation()
  const { profile } = useAuth()
  const showPost = canPost(profile)
  const [createOpen, setCreateOpen] = useState(false)

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
      {/* Phone, portrait: bar along the bottom */}
      <nav className="nav-bottom" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 30 }}>
        <div
          style={{
            position: 'relative',
            height: 68,
            display: 'flex',
            alignItems: 'center',
            padding: '0 10px',
            background: BAR,
            borderRadius: '22px 22px 0 0',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {left.map((item) => <Tab key={item.to} {...item} unread={unread} />)}
          {showPost ? (
            <div style={{ width: 84, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
              <PostButton label={t('post')} onClick={() => setCreateOpen(true)} big />
            </div>
          ) : null}
          {right.map((item) => <Tab key={item.to} {...item} unread={unread} />)}
        </div>
      </nav>

      {/* Tablet and landscape: side bar on the left */}
      <nav className="nav-side" aria-label="Main">
        {left.map((item) => <Tab key={item.to} {...item} unread={unread} vertical />)}
        {showPost ? <PostButton label={t('post')} onClick={() => setCreateOpen(true)} big={false} /> : null}
        {right.map((item) => <Tab key={item.to} {...item} unread={unread} vertical />)}
      </nav>

      <CreateSheet open={createOpen} onClose={() => setCreateOpen(false)} />
      <OnboardingTour />
    </>
  )
  }
