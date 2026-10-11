import { Home, MessageCircle, Plus, Bell, User } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useUnreadCount } from '../lib/useUnreadCount.js'
import { useTranslation } from '../lib/i18n.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { canPost } from '../lib/permissions.js'

// Dark bottom bar with a raised round "+" button in the middle.
// Colours are inline so the bar looks the same in every theme.
const BAR = '#150F45'
const IDLE = '#8E8BC8'

export default function BottomNav() {
  const unread = useUnreadCount()
  const { t } = useTranslation()
  const { profile } = useAuth()
  const showPost = canPost(profile)

  const left = [
    { to: '/home', label: t('home'), icon: Home },
    { to: '/chats', label: t('chats'), icon: MessageCircle },
  ]
  const right = [
    { to: '/notifications', label: t('alerts'), icon: Bell, showBadge: true },
    { to: '/profile', label: t('profile'), icon: User },
  ]

  function Tab({ to, label, icon: Icon, showBadge }) {
    return (
      <NavLink
        key={to}
        to={to}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}
      >
        {({ isActive }) => (
          <>
            <span
              style={{
                position: 'relative', width: 44, height: 34, borderRadius: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isActive ? 'linear-gradient(135deg, #6D4DFF, #8B5CF6)' : 'transparent',
                boxShadow: isActive ? '0 0 16px rgba(124,92,255,0.7)' : 'none',
              }}
            >
              <Icon size={22} color={isActive ? '#fff' : IDLE} />
              {showBadge && unread > 0 ? (
                <span
                  style={{
                    position: 'absolute', top: -2, right: 2, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999,
                    background: '#EF4444', color: '#fff', fontSize: 9, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {unread > 9 ? '9+' : unread}
                </span>
              ) : null}
            </span>
            <span style={{ fontSize: 11, fontWeight: isActive ? 600 : 400, color: isActive ? '#fff' : IDLE }}>{label}</span>
          </>
        )}
      </NavLink>
    )
  }

  return (
    <nav style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 30 }}>
      {showPost ? (
        <>
          {/* the curved cradle behind the + button */}
          <div
            style={{
              position: 'absolute', left: '50%', top: -34, transform: 'translateX(-50%)',
              width: 96, height: 96, borderRadius: 999, background: BAR,
              borderTop: '1px solid rgba(139,92,246,0.55)',
            }}
          />
          <NavLink
            to="/add-post"
            aria-label={t('post')}
            style={{
              position: 'absolute', left: '50%', top: -26, transform: 'translateX(-50%)',
              width: 64, height: 64, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', color: '#fff',
              border: '3px solid rgba(255,255,255,0.85)', boxShadow: '0 0 22px rgba(124,58,237,0.75)',
            }}
          >
            <Plus size={32} />
          </NavLink>
        </>
      ) : null}

      <div
        style={{
          position: 'relative', height: 70, display: 'flex', alignItems: 'center', padding: '0 8px',
          background: `linear-gradient(180deg, ${BAR}, #0F0B38)`,
          borderRadius: '24px 24px 0 0', borderTop: '1px solid rgba(139,92,246,0.35)',
          boxShadow: '0 -6px 24px rgba(21,15,69,0.35)',
        }}
      >
        {left.map((item) => <Tab key={item.to} {...item} />)}
        {showPost ? <div style={{ width: 84, flexShrink: 0 }} /> : null}
        {right.map((item) => <Tab key={item.to} {...item} />)}
      </div>
    </nav>
  )
}
