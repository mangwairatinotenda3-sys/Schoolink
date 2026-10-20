import { useEffect, useState } from 'react'
import { ChevronRight, Shield, Lock, Palette, Eye, Bell, Database, HelpCircle, RefreshCw, Globe, ShieldCheck, FileText, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { getAppInfo } from '../lib/appInfo.js'

const GROUPS = [
  {
    title: 'Account',
    items: [
      { label: 'Account', sub: 'Security, personal information', icon: Shield, color: 'bg-blue-500', to: '/settings/account' },
      { label: 'Privacy', sub: 'Block, visibility, read receipts', icon: Lock, color: 'bg-green-500', to: '/settings/privacy' },
      { label: 'Safety and Data', sub: 'Appeals, download your data', icon: ShieldCheck, color: 'bg-teal-500', to: '/settings/safety' },
    ],
  },
  {
    title: 'Preferences',
    items: [
      { label: 'Chat Appearance', sub: 'Theme, wallpaper, chat settings', icon: Palette, color: 'bg-purple-500', to: '/settings/chat-appearance' },
      { label: 'Accessibility', sub: 'Text size, display, contrast', icon: Eye, color: 'bg-indigo-500', to: '/settings/accessibility' },
      { label: 'App Language', sub: 'Choose your language', icon: Globe, color: 'bg-orange-500', to: '/settings/language' },
      { label: 'Notifications', sub: 'Message, group & call tones', icon: Bell, color: 'bg-red-500', to: '/settings/notifications' },
      { label: 'Storage and Data', sub: 'Network usage, auto-download', icon: Database, color: 'bg-pink-500', to: '/settings/storage' },
    ],
  },
  {
    title: 'Support',
    items: [
      { label: 'Help and Feedback', sub: 'Report a problem, send an idea', icon: HelpCircle, color: 'bg-sky-500', to: '/settings/help' },
      { label: 'Updates', sub: 'Check for a new version', icon: RefreshCw, color: 'bg-emerald-500', to: '/settings/updates' },
      { label: 'Data sharing and legal', sub: 'Crash reports, privacy, delete account', icon: FileText, color: 'bg-gray-500', to: '/settings/data-sharing' },
    ],
  },
]

export default function Settings() {
  const navigate = useNavigate()
  const { signOut, profile, user } = useAuth()
  const [info, setInfo] = useState(null)
  useEffect(() => { getAppInfo().then(setInfo) }, [])

  const name = profile?.full_name || user?.email?.split('@')[0] || 'Your Name'

  return (
    <div className="app-shell">
      <div className="px-4 pt-4 pb-1 shrink-0">
        <h1 className="font-bold text-[28px] leading-none">Settings</h1>
      </div>

      <div className="screen-scroll px-4 pb-6">
        <button onClick={() => navigate('/profile')} className="w-full mt-3 flex items-center gap-3.5 rounded-2xl bg-white border border-gray-100 p-4 text-left active:bg-gray-50">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-16 h-16 rounded-full object-cover" />
          ) : (
            <span className="w-16 h-16 rounded-full bg-brand-light flex items-center justify-center text-brand-purple text-2xl font-semibold">{name.slice(0, 1).toUpperCase()}</span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-[17px] truncate">{name}</span>
            <span className="block text-[13px] text-gray-400 truncate">{user?.email || 'Guest'}</span>
            {profile?.role ? <span className="inline-block text-[11px] font-medium text-brand-purple bg-brand-light px-2 py-0.5 rounded-full mt-1">{profile.role}</span> : null}
          </span>
          <ChevronRight size={18} className="text-gray-300" />
        </button>

        {GROUPS.map((g) => (
          <section key={g.title} className="mt-6">
            <h2 className="px-1 pb-2 text-[12px] font-semibold uppercase tracking-wide text-gray-400">{g.title}</h2>
            <div className="rounded-2xl bg-white border border-gray-100 overflow-hidden divide-y divide-gray-100">
              {g.items.map(({ label, sub, icon: Icon, color, to }) => (
                <button key={label} onClick={() => navigate(to)} className="w-full flex items-center gap-3.5 px-4 py-3 text-left active:bg-gray-50">
                  <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${color}`}><Icon size={17} className="text-white" /></span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-medium text-[15px]">{label}</span>
                    <span className="block text-xs text-gray-400 truncate">{sub}</span>
                  </span>
                  <ChevronRight size={18} className="text-gray-300 shrink-0" />
                </button>
              ))}
            </div>
          </section>
        ))}

        <button onClick={signOut} className="w-full mt-6 flex items-center justify-center gap-2 rounded-2xl bg-white border border-gray-100 py-3.5 text-red-500 font-semibold active:bg-gray-50">
          <LogOut size={18} /> Sign out
        </button>
        <p className="text-center text-xs text-gray-300 mt-5">Schoolink {info?.native ? `${info.version} (${info.build})` : 'web'}</p>
      </div>
      <BottomNav />
    </div>
  )
        }
