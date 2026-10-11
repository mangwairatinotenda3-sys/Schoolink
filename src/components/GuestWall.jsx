import { useNavigate } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import BottomNav from './BottomNav.jsx'
import useLeaveGuest from '../lib/useLeaveGuest.js'

// Shown instead of a page that guests can't open (chats, alerts, communities...).
export default function GuestWall() {
  const navigate = useNavigate()
  const leaveGuest = useLeaveGuest()

  return (
    <div className="app-shell">
      <div className="screen-scroll flex flex-col items-center justify-center text-center px-8">
        <span className="w-16 h-16 rounded-full bg-brand-light flex items-center justify-center">
          <UserPlus size={30} className="text-brand-purple" />
        </span>
        <p className="font-bold text-lg mt-4">Sign in to use this</p>
        <p className="text-sm text-gray-500 mt-2">
          You're browsing as a guest. Create an account or sign in to chat, join communities, get alerts and more.
        </p>
        <button onClick={leaveGuest} className="w-full mt-6 bg-brand-purple text-white font-semibold py-3 rounded-xl">
          Sign in
        </button>
        <button onClick={leaveGuest} className="w-full mt-2 border border-gray-200 font-semibold py-3 rounded-xl">
          Create account
        </button>
        <button onClick={() => navigate('/home')} className="mt-3 text-sm text-gray-500">
          Back to Home
        </button>
      </div>
      <BottomNav />
    </div>
  )
}
