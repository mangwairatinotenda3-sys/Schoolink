import {
  ChevronRight,
  Shield,
  Lock,
  Palette,
  Eye,
  Bell,
  Database,
  HelpCircle,
  RefreshCw,
  UserPlus,
  Users,
  Clock,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import BackHeader from '../components/BackHeader.jsx'
import BottomNav from '../components/BottomNav.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { canManageStaff } from '../lib/permissions.js'

export default function Settings() {
  const navigate = useNavigate()
  const { signOut, profile } = useAuth()

  const items = [
    { label: 'Account', sub: 'Security, personal information', icon: Shield },
    { label: 'Privacy', sub: 'Block, visibility, read receipts', icon: Lock },
    { label: 'Chat Appearance', sub: 'Theme, wallpaper, chat settings', icon: Palette },
    { label: 'Accessibility', sub: 'Text size, display, contrast', icon: Eye },
    { label: 'App Language', sub: 'English (United States)', icon: Palette },
    { label: 'Notifications', sub: 'Message, group & call tones', icon: Bell },
    { label: 'Storage and Data', sub: 'Network usage, auto-download', icon: Database },
    { label: 'Staff Directory', sub: 'View everyone at your school', icon: Users, to: '/staff-directory' },
    ...(canManageStaff(profile)
      ? [
          { label: 'Invite a Member', sub: 'Invite staff, parents or others', icon: UserPlus, to: '/invite-member' },
          { label: 'Pending Approvals', sub: 'Review student join requests', icon: Clock, to: '/pending-approvals' },
        ]
      : []),
    { label: 'Help and Feedback', sub: 'Help center, contact us', icon: HelpCircle },
    { label: 'Updates', sub: 'Check for new updates', icon: RefreshCw },
  ]

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader title="Settings" />
      <div className="screen-scroll divide-y divide-gray-100 px-4">
        {items.map(({ label, sub, icon: Icon, to }) => (
          <button
            key={label}
            onClick={() => to && navigate(to)}
            className="w-full flex items-center justify-between py-3.5"
          >
            <span className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-full bg-brand-light flex items-center justify-center">
                <Icon size={16} className="text-brand-purple" />
              </span>
              <span className="text-left">
                <span className="block font-medium text-sm">{label}</span>
                <span className="block text-xs text-gray-400">{sub}</span>
              </span>
            </span>
            <ChevronRight size={18} className="text-gray-300" />
          </button>
        ))}

        <button onClick={signOut} className="w-full text-left py-4 text-red-500 font-medium text-sm">
          Sign Out
        </button>
      </div>
      <BottomNav />
    </div>
  )
            }
