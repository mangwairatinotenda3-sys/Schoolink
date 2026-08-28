import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Send, Check, CheckCheck, MoreVertical, UserX } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useIsOnline } from '../lib/presence.jsx'

export default function ChatThread() {
  const { userId: partnerId } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const isOnline = useIsOnline(partnerId)

  const [partner, setPartner] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [isBlocked, setIsBlocked] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    supabase
      .from('profiles')
      .select('full_name, avatar_url, role')
      .eq('id', partnerId)
      .maybeSingle()
      .then(({ data }) => setPartner(data))

    supabase
      .from('blocked_users')
      .select('*')
      .eq('blocker_id', user.id)
      .eq('blocked_id', partnerId)
      .maybeSingle()
      .then(({ data }) => setIsBlocked(!!data))
  }, [partnerId])

  useEffect(() => {
    if (!user) return
    loadMessages()

    const channel = supabase
      .channel(`chat-${user.id}-${partnerId}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const m = payload.new
          const isThisThread =
            (m.sender_id === user.id && m.receiver_id === partnerId) ||
            (m.sender_id === partnerId && m.receiver_id === user.id)
          if (isThisThread) {
            setMessages((prev) => [...prev, m])
            if (m.receiver_id === user.id && profile?.read_receipts_enabled !== false) {
              supabase.from('messages').update({ read: true }).eq('id', m.id)
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, partnerId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadMessages() {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`
      )
      .order('created_at', { ascending: true })
    setMessages(data ?? [])

    if (profile?.read_receipts_enabled !== false) {
      const unreadIds = (data ?? [])
        .filter((m) => m.receiver_id === user.id && !m.read)
        .map((m) => m.id)
      if (unreadIds.length > 0) {
        await supabase.from('messages').update({ read: true }).in('id', unreadIds)
      }
    }
  }

  async function handleSend() {
    if (!text.trim() || sending || isBlocked) return
    setSending(true)
    const content = text
    setText('')
    await supabase.from('messages').insert({
      sender_id: user.id,
      receiver_id: partnerId,
      content,
    })
    setSending(false)
  }

  async function handleBlock() {
    setMenuOpen(false)
    if (isBlocked) {
      await supabase.from('blocked_users').delete().eq('blocker_id', user.id).eq('blocked_id', partnerId)
      setIsBlocked(false)
    } else {
      await supabase.from('blocked_users').insert({ blocker_id: user.id, blocked_id: partnerId })
      setIsBlocked(true)
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        <BackHeader />
        <span className="relative -ml-2">
          {partner?.avatar_url ? (
            <img src={partner.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
          ) : (
            <span className="w-9 h-9 rounded-full bg-brand-light flex items-center justify-center text-lg">🙂</span>
          )}
          {isOnline ? (
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white" />
          ) : null}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm truncate">{partner?.full_name || 'Schoolink member'}</p>
          <p className="text-xs text-gray-400 truncate">{isOnline ? 'Online' : partner?.role || ''}</p>
        </div>
        <div className="relative">
          <button onClick={() => setMenuOpen((m) => !m)}>
            <MoreVertical size={18} className="text-gray-400" />
          </button>
          {menuOpen ? (
            <div className="absolute right-0 top-8 bg-white border border-gray-100 rounded-lg shadow-lg z-10 w-40">
              <button
                onClick={handleBlock}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-500"
              >
                <UserX size={14} /> {isBlocked ? 'Unblock' : 'Block'}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {isBlocked ? (
        <div className="bg-red-50 text-red-500 text-xs text-center py-2 px-4">
          You've blocked this person. Unblock them to send messages.
        </div>
      ) : null}

      <div className="screen-scroll px-4 py-3 flex flex-col gap-2">
        {messages.map((m) => {
          const isMine = m.sender_id === user.id
          return (
            <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                  isMine ? 'bg-brand-purple text-white rounded-br-sm' : 'bg-gray-100 text-brand-navy rounded-bl-sm'
                }`}
              >
                <p>{m.content}</p>
                {isMine ? (
                  <span className="flex justify-end mt-1">
                    {m.read ? <CheckCheck size={14} className="text-blue-200" /> : <Check size={14} className="text-white/70" />}
                  </span>
                ) : null}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-100">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={isBlocked ? 'Unblock to send a message' : 'Message…'}
          disabled={isBlocked}
          className="flex-1 border border-gray-200 rounded-full px-4 py-2.5 text-sm outline-brand-purple disabled:opacity-60"
        />
        <button
          onClick={handleSend}
          disabled={sending || isBlocked}
          className="w-10 h-10 rounded-full bg-brand-purple flex items-center justify-center shrink-0 disabled:opacity-60"
        >
          <Send size={16} className="text-white" />
        </button>
      </div>
    </div>
  )
}
