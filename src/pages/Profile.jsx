import { ChevronLeft, ChevronRight, UserSquare2, Briefcase, FileText, Users, Bookmark, Link2, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const menuItems = [
  { label: 'My School Profile', icon: UserSquare2 },
  { label: 'Professional Dashboard', icon: Briefcase, to: '/dashboard' },
  { label: 'My Posts', icon: FileText },
  { label: 'Groups & Communities', icon: Users },
  { label: 'Staff Directory', icon: Users, to: '/staff-directory' },
  { label: 'Saved Items', icon: Bookmark, to: '/saved' },
  { label: 'Connections', icon: Link2 },
  { label: 'Account Information', icon: User, to: '/settings' },
]

export default function Profile() {
  const navigate = useNavigate()
  const { profile, user } = useAuth()

  const name = profile?.full_name || user?.email?.split('@')[0] || 'Your Name'
  const role = profile?.role || 'Add your role'

  return (
    <div className="flex-1 flex flex-col">
      <div className="bg-brand-navy text-white px-4 pt-4 pb-6">
        <button onClick={() => navigate(-1)}>
          <ChevronLeft size={22} />
        </button>
        <div className="flex flex-col items-center mt-2">
          <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-3xl">
            🙂
          </div>
          <p className="font-semibold mt-2">{name}</p>
          <p className="text-sm text-white/70">{role}</p>
          <p className="text-sm text-white/70">Springfield High School</p>
          <p className="text-xs text-white/50">Harare, Zimbabwe</p>
        </div>
      </div>

      <div className="screen-scroll">
        <div className="flex justify-around py-4 border-b border-gray-100">
          <div className="text-center">
            <p className="font-bold">120</p>
            <p className="text-xs text-gray-400">Posts</p>
          </div>
          <div className="text-center">
            <p className="font-bold">1.2K</p>
            <p className="text-xs text-gray-400">Followers</p>
          </div>
          <div className="text-center">
            <p className="font-bold">320</p>
            <p className="text-xs text-gray-400">Following</p>
          </div>
        </div>

        <div className="divide-y divide-gray-100 px-4">
          {menuItems.map(({ label, icon: Icon, to }) => (
            <button
              key={label}
              onClick={() => to && navigate(to)}
              className="w-full flex items-center justify-between py-4"
            >
              <span className="flex items-center gap-3">
                <Icon size={18} className="text-brand-purple" />
                <span className="font-medium text-sm">{label}</span>
              </span>
              <ChevronRight size={18} className="text-gray-300" />
            </button>
          ))}
        </div>
      </div>

      <BottomNav />
    </div>
  )
  }
