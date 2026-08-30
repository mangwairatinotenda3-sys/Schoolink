import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackHeader from '../components/BackHeader.jsx'
import BottomNav from '../components/BottomNav.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useIsOnline } from '../lib/presence.jsx'

function timeAgo(dateString) {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
  if (seconds < 60) return 'now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

function ConversationRow({ conv, navigate }) {
  const isOnline = useIsOnline(conv.partnerId)
  return (
    <button
      onClick={() => navigate(`/chats/${conv.partnerId}`)}
      className="w-full flex items-center gap-3 py-3.5"
    >
      <span className="relative shrink-0">
        {conv.avatarUrl ? (
          <img src={conv.avatarUrl} alt="" className="w-12 h-12 rounded-full object-cover" />
        ) : (
          <span className="w-12 h-12 rounded-full bg-brand-light flex items-center justify-center text-xl">🙂</span>
        )}
        {isOnline ? (
          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-white" />
        ) : null}
      </span>
      <div className="min-w-0 flex-1 text-left">
        <p className="font-medium text-sm truncate">{conv.name}</p>
        <p className={`text-xs truncate ${conv.unread ? 'text-brand-navy font-medium' : 'text-gray-400'}`}>
          {conv.lastMessage}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-[10px] text-gray-400">{timeAgo(conv.lastTime)}</span>
        {conv.unread ? <span className="w-2 h-2 rounded-full bg-brand-purple" /> : null}
      </div>
    </button>
  )
}

export default function ChatList() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    loadConversations()
  }, [user])

  async function loadConversations() {
    setLoading(true)
    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false })

    const byPartner = new Map()
    for (const m of messages ?? []) {
      const partnerId = m.sender_id === user.id ? m.receiver_id : m.sender_id
      if (!byPartner.has(partnerId)) {
        byPartner.set(partnerId, {
          partnerId,
          lastMessage: m.content,
          lastTime: m.created_at,
          unread: m.receiver_id === user.id && !m.read,
        })
      }
    }

    const partnerIds = [...byPartner.keys()]
    if (partnerIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', partnerIds)

      for (const p of profiles ?? []) {
        const conv = byPartner.get(p.id)
        conv.name = p.full_name || 'Schoolink member'
        conv.avatarUrl = p.avatar_url
      }
    }

    setConversations([...byPartner.values()])
    setLoading(false)
  }

  return (
    <div className="app-shell">
      <BackHeader title="Chats" />
      <div className="screen-scroll px-4">
        {loading ? (
          <p className="text-center text-gray-400 mt-8">Loading…</p>
        ) : conversations.length === 0 ? (
          <div className="text-center text-gray-400 mt-8">
            <p>No conversations yet.</p>
            <p className="text-sm">Start one from the Staff Directory.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {conversations.map((conv) => (
              <ConversationRow key={conv.partnerId} conv={conv} navigate={navigate} />
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  )
                              }
