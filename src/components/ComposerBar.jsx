import { Image as ImageIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useIsOnline } from '../lib/presence.jsx'

export default function ComposerBar() {
  const navigate = useNavigate()
  const { profile, user } = useAuth()
  const isOnline = useIsOnline(user?.id)

  return (
    <button
      onClick={() => navigate('/add-post')}
      className="mx-4 mt-3 flex items-center gap-3 bg-gray-50 rounded-full px-3 py-3 text-left w-[calc(100%-2rem)]"
    >
      <span className="relative shrink-0">
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
        ) : (
          <span className="w-10 h-10 rounded-full bg-brand-light flex items-center justify-center text-lg">🙂</span>
        )}
        {isOnline ? (
          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-white" />
        ) : null}
      </span>
      <span className="flex-1 text-gray-400 text-sm">What's on your mind?</span>
      <ImageIcon size={20} className="text-green-500 shrink-0" />
    </button>
  )
    }
