import { X, User, Settings, UserPlus, Users, LogOut, Clock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { canManageStaff } from '../lib/permissions.js'

export default function SideDrawer({ open, onClose }) {
  const navigate = useNavigate()
  const { profile, user, signOut } = useAuth()

  function go(path) {
    onClose()
    navigate(path)
  }

  const links = [
    { label: 'Profile', icon: User, to: '/profile' },
    { label: 'Settings', icon: Settings, to: '/settings' },
    { label: 'Staff Directory', icon: Users, to: '/staff-directory' },
    ...(canManageStaff(profile)
      ? [
          { label: 'Invite a Member', icon: UserPlus, to: '/invite-member' },
          { label: 'Pending Approvals', icon: Clock, to: '/pending-approvals' },
        ]
      : []),
  ]

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      <div
        className={`fixed top-0 left-0 h-full w-72 max-w-[80%] bg-white z-50 shadow-xl transition-transform ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="bg-brand-navy text-white px-5 pt-6 pb-5 flex items-start justify-between">
          <div>
            <p className="font-semibold">{profile?.full_name || user?.email?.split('@')[0] || 'Guest'}</p>
            <p className="text-xs text-white/70">{profile?.role || 'Guest'}</p>
          </div>
          <button onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="divide-y divide-gray-100">
          {links.map(({ label, icon: Icon, to }) => (
            <button
              key={label}
              onClick={() => go(to)}
              className="w-full flex items-center gap-3 px-5 py-3.5 text-sm font-medium"
            >
              <Icon size={18} className="text-brand-purple" />
              {label}
            </button>
          ))}
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-5 py-3.5 text-sm font-medium text-red-500"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </div>
    </>
  )
  }
