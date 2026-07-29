import { Home, Bell, PlusCircle, Bookmark, User } from 'lucide-react'
import { NavLink } from 'react-router-dom'

const items = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/add-post', label: 'Add Post', icon: PlusCircle, primary: true },
  { to: '/saved', label: 'Saved', icon: Bookmark },
  { to: '/profile', label: 'Profile', icon: User },
]

export default function BottomNav() {
  return (
    <nav className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-around items-center py-2 px-2">
      {items.map(({ to, label, icon: Icon, primary }) => (
        <NavLink
          key={to}
          to={to}
          className="flex flex-col items-center gap-1 text-[11px] text-gray-500 relative"
        >
          {({ isActive }) =>
            primary ? (
              <>
                <span className="w-9 h-9 rounded-full bg-brand-purple flex items-center justify-center -mt-1">
                  <Icon size={20} className="text-white" />
                </span>
                <span className="text-gray-500">{label}</span>
              </>
            ) : (
              <>
                <Icon size={22} className={isActive ? 'text-brand-purple' : 'text-gray-400'} />
                <span className={isActive ? 'text-brand-purple font-medium' : ''}>{label}</span>
              </>
            )
          }
        </NavLink>
      ))}
    </nav>
  )
    }
