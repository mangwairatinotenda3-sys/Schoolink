import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { User, Image as ImageIcon, Star, Heart, BellOff, Ban, Flag, Trash2, ChevronRight } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function ChatOptions() {
  const { userId: partnerId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [partner, setPartner] = useState(null)
  const [settings, setSettings] = useState({ muted: false })
  const [isFavourite, setIsFavourite] = useState(false)
  const [isBlocked, setIsBlocked] = useState(false)

  useEffect(() => {
    supabase.from('profiles').select('*').eq('id', partnerId).maybeSingle().then(({ data }) => setPartner(data))
    supabase.from('chat_settings').select('*').eq('user_id', user.id).eq('partner_id', partnerId).maybeSingle().then(({ data }) => {
      if (data) setSettings(data)
    })
    supabase.from('favourite_chats').select('*').eq('user_id', user.id).eq('partner_id', partnerId).maybeSingle().then(({ data }) => setIsFavourite(!!data))
    supabase.from('blocked_users').select('*').eq('blocker_id', user.id).eq('blocked_id', partnerId).maybeSingle().then(({ data }) => setIsBlocked(!!data))
  }, [partnerId])

  async function toggleMute() {
    const next = { ...settings, muted: !settings.muted }
    setSettings(next)
    await supabase.from('chat_settings').upsert({ user_id: user.id, partner_id: partnerId, ...next })
  }

  async function toggleFavourite() {
    if (isFavourite) {
      await supabase.from('favourite_chats').delete().eq('user_id', user.id).eq('partner_id', partnerId)
      setIsFavourite(false)
    } else {
      await supabase.from('favourite_chats').insert({ user_id: user.id, partner_id: partnerId })
      setIsFavourite(true)
    }
  }

  async function toggleBlock() {
    if (isBlocked) {
      await supabase.from('blocked_users').delete().eq('blocker_id', user.id).eq('blocked_id', partnerId)
      setIsBlocked(false)
    } else {
      await supabase.from('blocked_users').insert({ blocker_id: user.id, blocked_id: partnerId })
      setIsBlocked(true)
    }
  }

  async function handleReport() {
    const reason = window.prompt('Briefly describe the issue (spam, harassment, impersonation, etc.):')
    if (!reason) return
    await supabase.from('app_feedback').insert({ user_id: user.id, message: `Chat report against ${partner?.full_name || partnerId}: ${reason}` })
    alert('Report submitted to the platform admin.')
  }

  async function handleDeleteChat() {
    if (!window.confirm('Delete this entire conversation for both of you? This cannot be undone.')) return
    await supabase.from('messages').delete().or(`and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`)
    navigate('/chats')
  }

  const rows = [
    { label: 'View Profile', icon: User, action: () => navigate(`/users/${partnerId}`) },
    { label: 'Media, Files & Links', icon: ImageIcon, action: () => navigate(`/chats/${partnerId}/media`) },
    { label: 'Starred Messages', icon: Star, action: () => navigate('/settings/starred') },
    { label: isFavourite ? 'Remove from Favourites' : 'Add to Favourites', icon: Heart, action: toggleFavourite },
    { label: settings.muted ? 'Unmute Notifications' : 'Mute Notifications', icon: BellOff, action: toggleMute },
  ]

  return (
    <div className="app-shell">
      <BackHeader title="Chat Options" />
      <div className="screen-scroll px-4 pt-2">
        <div className="flex flex-col items-center py-3">
          {partner?.avatar_url ? <img src={partner.avatar_url} alt="" className="w-16 h-16 rounded-full object-cover" /> : <span className="w-16 h-16 rounded-full bg-brand-light flex items-center justify-center text-2xl">🙂</span>}
          <p className="font-semibold mt-2">{partner?.full_name || 'Schoolink member'}</p>
          <span className="text-[11px] bg-brand-light text-brand-purple px-2 py-0.5 rounded-full mt-1">{partner?.role}</span>
        </div>

        <div className="bg-brand-light rounded-xl p-3 text-center text-xs text-brand-purple mt-2">
          🔒 Private conversation — only visible to the two of you.
        </div>

        <div className="divide-y divide-gray-100 mt-4">
          {rows.map(({ label, icon: Icon, action }) => (
            <button key={label} onClick={action} className="w-full flex items-center justify-between py-3.5">
              <span className="flex items-center gap-3"><Icon size={17} className="text-brand-purple" /><span className="text-sm font-medium">{label}</span></span>
              <ChevronRight size={16} className="text-gray-300" />
            </button>
          ))}
        </div>

        <div className="h-px bg-gray-100 my-4" />

        <button onClick={toggleBlock} className="w-full flex items-center gap-3 py-3 text-red-500"><Ban size={17} /><span className="text-sm font-medium">{isBlocked ? 'Unblock' : 'Block'}</span></button>
        <button onClick={handleReport} className="w-full flex items-center gap-3 py-3 text-red-500"><Flag size={17} /><span className="text-sm font-medium">Report</span></button>
        <button onClick={handleDeleteChat} className="w-full flex items-center gap-3 py-3 mb-6 text-red-600"><Trash2 size={17} /><span className="text-sm font-medium">Delete Chat</span></button>
      </div>
    </div>
  )
}
