import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Pin, Archive } from 'lucide-react'
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
        <p className="font-medium text-sm truncate flex items-center gap-1">
          {conv.pinned ? <Pin size={12} className="text-brand-purple shrink-0" /> : null}
          {conv.name}
        </p>
        <p className={`text-xs truncate ${conv.unread && !conv.muted ? 'text-brand-navy font-medium' : 'text-gray-400'}`}>
          {conv.lastMessage}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-[10px] text-gray-400">{timeAgo(conv.lastTime)}</span>
        {conv.unread && !conv.muted ? <span className="w-2 h-2 rounded-full bg-brand-purple" /> : null}
      </div>
    </button>
  )
}

export default function ChatList() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false)

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

      const { data: settingsRows } = await supabase
        .from('chat_settings')
        .select('*')
        .eq('user_id', user.id)
        .in('partner_id', partnerIds)
      for (const s of settingsRows ?? []) {
        const conv = byPartner.get(s.partner_id)
        if (conv) {
          conv.pinned = s.pinned
          conv.archived = s.archived
          conv.muted = s.muted
        }
      }
    }

    setConversations([...byPartner.values()])
    setLoading(false)
  }

  const visible = conversations
    .filter((c) => !!c.archived === showArchived)
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))

  return (
    <div className="app-shell">
      <BackHeader title="Chats" />

      <div className="flex px-4 gap-6 border-b border-gray-100">
        {[{ key: false, label: 'Active' }, { key: true, label: 'Archived' }].map((t) => (
          <button
            key={t.label}
            onClick={() => setShowArchived(t.key)}
            className={`py-2 text-sm font-medium border-b-2 flex items-center gap-1 ${
              showArchived === t.key ? 'border-brand-purple text-brand-purple' : 'border-transparent text-gray-400'
            }`}
          >
            {t.key ? <Archive size={13} /> : null}
            {t.label}
          </button>
        ))}
      </div>

      <div className="screen-scroll px-4">
        {loading ? (
          <p className="text-center text-gray-400 mt-8">Loading…</p>
        ) : visible.length === 0 ? (
          <div className="text-center text-gray-400 mt-8">
            <p>{showArchived ? 'No archived chats.' : 'No conversations yet.'}</p>
            {!showArchived ? <p className="text-sm">Start one from the Staff Directory.</p> : null}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {visible.map((conv) => (
              <ConversationRow key={conv.partnerId} conv={conv} navigate={navigate} />
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  )
    }
