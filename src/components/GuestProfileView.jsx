import { useNavigate } from 'react-router-dom'
import { User, HelpCircle, FileText, ShieldCheck, ChevronRight } from 'lucide-react'
import BottomNav from './BottomNav.jsx'
import useLeaveGuest from '../lib/useLeaveGuest.js'

const links = [
  { label: 'Help and feedback', icon: HelpCircle, to: '/settings/help' },
  { label: 'Terms of Service', icon: FileText, to: '/terms' },
  { label: 'Privacy Policy', icon: ShieldCheck, to: '/privacy' },
]

// What a guest sees on the Profile tab: a sign-in invitation, like other apps do.
export default function GuestProfileView() {
  const navigate = useNavigate()
  const leaveGuest = useLeaveGuest()

  return (
    <div className="app-shell">
      <div className="bg-brand-navy text-white px-4 pt-4 pb-3 text-center">
        <h1 className="font-bold text-lg">Profile</h1>
      </div>
      <div className="screen-scroll px-6 pt-8">
        <div className="flex flex-col items-center text-center">
          <span className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center">
            <User size={44} className="text-gray-400" />
          </span>
          <p className="font-bold text-xl mt-4">You're browsing as a guest</p>
          <p className="text-sm text-gray-500 mt-2">
            Sign in to follow people, like and comment, chat, join communities and have your own profile.
          </p>
          <button onClick={leaveGuest} className="w-full mt-6 bg-brand-purple text-white font-semibold py-3 rounded-xl">
            Sign in
          </button>
          <button onClick={leaveGuest} className="w-full mt-2 border border-gray-200 font-semibold py-3 rounded-xl">
            Create account
          </button>
        </div>

        <div className="mt-8 divide-y divide-gray-100">
          {links.map(({ label, icon: Icon, to }) => (
            <button key={to} onClick={() => navigate(to)} className="w-full flex items-center gap-3 py-3.5 text-left">
              <Icon size={18} className="text-gray-400" />
              <span className="flex-1 text-sm">{label}</span>
              <ChevronRight size={16} className="text-gray-300" />
            </button>
          ))}
        </div>
      </div>
      <BottomNav />
    </div>
  )
}
