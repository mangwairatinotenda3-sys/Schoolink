import { ChevronRight, Shield, Lock, Palette, Eye, Bell, Database, HelpCircle, RefreshCw, Globe } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import BackHeader from '../components/BackHeader.jsx'
import BottomNav from '../components/BottomNav.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-red-500', 'bg-teal-500', 'bg-indigo-500', 'bg-pink-500']

export default function Settings() {
  const navigate = useNavigate()
  const { signOut, profile, user } = useAuth()

  const name = profile?.full_name || user?.email?.split('@')[0] || 'Your Name'

  const items = [
    { label: 'Account', sub: 'Security, personal information', icon: Shield, to: '/settings/account' },
    { label: 'Privacy', sub: 'Block, visibility, read receipts', icon: Lock, to: '/settings/privacy' },
    { label: 'Chat Appearance', sub: 'Theme, wallpaper, chat settings', icon: Palette, to: '/settings/chat-appearance' },
    { label: 'Accessibility', sub: 'Text size, display, contrast', icon: Eye, to: '/settings/accessibility' },
    { label: 'App Language', sub: 'English (United States)', icon: Globe, to: '/settings/language' },
    { label: 'Notifications', sub: 'Message, group & call tones', icon: Bell, to: '/settings/notifications' },
    { label: 'Storage and Data', sub: 'Network usage, auto-download', icon: Database, to: '/settings/storage' },
    { label: 'Help and Feedback', sub: 'Contact us, send feedback', icon: HelpCircle, to: '/settings/help' },
    { label: 'Updates', sub: 'Check for new updates', icon: RefreshCw, to: '/settings/updates' },
  ]

  return (
    <div className="app-shell">
      <BackHeader title="Settings" />

      <div className="px-4 pt-2 pb-3 flex items-center gap-3 border-b border-gray-100">
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover" />
        ) : (
          <span className="w-14 h-14 rounded-full bg-brand-light flex items-center justify-center text-2xl">🙂</span>
        )}
        <div className="min-w-0">
          <p className="font-semibold truncate">{name}</p>
          {profile?.role ? (
            <span className="inline-block text-[11px] font-medium text-brand-purple bg-brand-light px-2 py-0.5 rounded-full mt-0.5">
              {profile.role}
            </span>
          ) : null}
        </div>
      </div>

      <div className="screen-scroll divide-y divide-gray-100 px-4">
        {items.map(({ label, sub, icon: Icon, to }, i) => (
          <button
            key={label}
            onClick={() => to && navigate(to)}
            className="w-full flex items-center justify-between py-3.5"
          >
            <span className="flex items-center gap-3">
              <span className={`w-9 h-9 rounded-full flex items-center justify-center ${colors[i % colors.length]}`}>
                <Icon size={16} className="text-white" />
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
