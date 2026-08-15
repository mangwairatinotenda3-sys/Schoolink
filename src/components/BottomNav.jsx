import { Home, MessageCircle, Bell, Bookmark, User } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useUnreadCount } from '../lib/useUnreadCount.js'

const items = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/chats', label: 'Chats', icon: MessageCircle },
  { to: '/notifications', label: 'Alerts', icon: Bell, showBadge: true },
  { to: '/saved', label: 'Saved', icon: Bookmark },
  { to: '/profile', label: 'Profile', icon: User },
]

export default function BottomNav() {
  const unread = useUnreadCount()

  return (
    <nav className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-around items-center py-2 px-2">
      {items.map(({ to, label, icon: Icon, showBadge }) => (
        <NavLink
          key={to}
          to={to}
          className="flex flex-col items-center gap-1 text-[11px] text-gray-500 relative"
        >
          {({ isActive }) => (
            <>
              <span className="relative">
                <Icon size={22} className={isActive ? 'text-brand-purple' : 'text-gray-400'} />
                {showBadge && unread > 0 ? (
                  <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[9px] rounded-full w-3.5 h-3.5 flex items-center justify-center">
                    {unread > 9 ? '9+' : unread}
                  </span>
                ) : null}
              </span>
              <span className={isActive ? 'text-brand-purple font-medium' : ''}>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
    }
