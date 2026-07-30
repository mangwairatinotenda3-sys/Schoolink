import { Image as ImageIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function ComposerBar() {
  const navigate = useNavigate()
  const { profile } = useAuth()

  return (
    <button
      onClick={() => navigate('/add-post')}
      className="mx-4 mt-3 flex items-center gap-3 bg-gray-50 rounded-full px-3 py-2.5 text-left"
    >
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
      ) : (
        <span className="w-9 h-9 rounded-full bg-brand-light flex items-center justify-center text-lg shrink-0">🙂</span>
      )}
      <span className="flex-1 text-gray-400 text-sm">What's on your mind?</span>
      <ImageIcon size={20} className="text-green-500 shrink-0" />
    </button>
  )
          }
