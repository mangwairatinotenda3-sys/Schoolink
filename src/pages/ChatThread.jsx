import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Send, Check, CheckCheck, MoreVertical, X, CornerUpLeft, Mic, Square, Star, Image as ImageIcon } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useIsOnline } from '../lib/presence.jsx'

const QUICK_REACTIONS = ['❤️', '😂', '👍', '😮', '😢']

function MessageBubble({ m, isMine, reactions, starred, onReact, onReply, onStar, allMessages }) {
  const [showBar, setShowBar] = useState(false)
  const repliedTo = m.reply_to_id ? allMessages.find((x) => x.id === m.reply_to_id) : null
  const myReactions = reactions[m.id] ?? []
  const isStarred = starred.has(m.id)

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[75%]">
        <div onClick={() => setShowBar((s) => !s)} className={`rounded-2xl px-4 py-2 text-sm ${isMine ? 'bg-brand-purple text-white rounded-br-sm' : 'bg-gray-100 text-brand-navy rounded-bl-sm'}`}>
          {repliedTo ? <div className={`text-xs border-l-2 pl-2 mb-1 opacity-80 ${isMine ? 'border-white/50' : 'border-brand-purple/50'}`}>{repliedTo.content}</div> : null}
          {m.media_type === 'audio' && m.media_url ? <audio src={m.media_url} controls className="max-w-full" /> : null}
          {m.media_type === 'image' && m.media_url ? <img src={m.media_url} alt="" className="rounded-lg max-h-64 object-cover mb-1" /> : null}
          {m.content ? <p>{m.content}</p> : null}
          {isMine ? (
            <span className="flex justify-end mt-1">
              {m.read ? <CheckCheck size={14} className="text-blue-200" /> : <Check size={14} className="text-white/70" />}
            </span>
          ) : null}
        </div>

        {(myReactions.length > 0 || isStarred) ? (
          <div className="flex gap-1 mt-0.5">
            {isStarred ? <Star size={12} className="text-amber-500 fill-amber-500" /> : null}
            {myReactions.map((r) => <span key={r} className="text-xs bg-white border border-gray-100 rounded-full px-1.5">{r}</span>)}
          </div>
        ) : null}

        {showBar ? (
          <div className="flex items-center gap-1 mt-1 bg-white border border-gray-100 rounded-full px-2 py-1 shadow w-fit">
            {QUICK_REACTIONS.map((emoji) => (
              <button key={emoji} onClick={() => { onReact(m.id, emoji); setShowBar(false) }} className="text-base">{emoji}</button>
            ))}
            <button onClick={() => { onReply(m); setShowBar(false) }} className="pl-1 border-l border-gray-100 ml-1"><CornerUpLeft size={14} className="text-gray-400" /></button>
            <button onClick={() => { onStar(m.id, isStarred); setShowBar(false) }}><Star size={14} className={isStarred ? 'text-amber-500 fill-amber-500' : 'text-gray-400'} /></button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default function ChatThread() {
  const { userId: partnerId } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const isOnline = useIsOnline(partnerId)
  const fileInputRef = useRef(null)

  const [partner, setPartner] = useState(null)
  const [messages, setMessages] = useState([])
  const [reactions, setReactions] = useState({})
  const [starred, setStarred] = useState(new Set())
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [sending, setSending] = useState(false)
  const [isBlocked, setIsBlocked] = useState(false)
  const [recording, setRecording] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const bottomRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])

  useEffect(() => {
    supabase.from('profiles').select('full_name, avatar_url, role').eq('id', partnerId).maybeSingle().then(({ data }) => setPartner(data))
    supabase.from('blocked_users').select('*').eq('blocker_id', user.id).eq('blocked_id', partnerId).maybeSingle().then(({ data }) => setIsBlocked(!!data))
  }, [partnerId])

  useEffect(() => {
    if (!user) return
    loadMessages()
    const channel = supabase
      .channel(`chat-${user.id}-${partnerId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const m = payload.new
        const isThisThread = (m.sender_id === user.id && m.receiver_id === partnerId) || (m.sender_id === partnerId && m.receiver_id === user.id)
        if (isThisThread) {
          setMessages((prev) => [...prev, m])
          if (m.receiver_id === user.id && profile?.read_receipts_enabled !== false) {
            supabase.from('messages').update({ read: true }).eq('id', m.id)
          }
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user, partnerId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function loadMessages() {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true })
    setMessages(data ?? [])

    if (data && data.length > 0) {
      const { data: allReactions } = await supabase.from('message_reactions').select('*').in('message_id', data.map((m) => m.id))
      const grouped = {}
      for (const r of allReactions ?? []) grouped[r.message_id] = [...(grouped[r.message_id] ?? []), r.emoji]
      setReactions(grouped)

      const { data: starredRows } = await supabase.from('starred_messages').select('message_id').eq('user_id', user.id).in('message_id', data.map((m) => m.id))
      setStarred(new Set((starredRows ?? []).map((s) => s.message_id)))
    }

    const unreadIds = (data ?? []).filter((m) => m.receiver_id === user.id && !m.read).map((m) => m.id)
    if (unreadIds.length > 0) await supabase.from('messages').update({ read: true }).in('id', unreadIds)
  }

  async function handleReact(messageId, emoji) {
    await supabase.from('message_reactions').upsert({ message_id: messageId, user_id: user.id, emoji })
    setReactions((prev) => ({ ...prev, [messageId]: [...(prev[messageId] ?? []).filter((e) => e), emoji] }))
  }

  async function handleStar(messageId, isStarred) {
    if (isStarred) {
      await supabase.from('starred_messages').delete().eq('user_id', user.id).eq('message_id', messageId)
      setStarred((prev) => { const next = new Set(prev); next.delete(messageId); return next })
    } else {
      await supabase.from('starred_messages').insert({ user_id: user.id, message_id: messageId })
      setStarred((prev) => new Set(prev).add(messageId))
    }
  }

  async function handleSend() {
    if (!text.trim() || sending || isBlocked) return
    setSending(true)
    const content = text
    const replyId = replyTo?.id ?? null
    setText(''); setReplyTo(null)
    await supabase.from('messages').insert({ sender_id: user.id, receiver_id: partnerId, content, reply_to_id: replyId })
    setSending(false)
  }

  async function handlePhotoChange(e) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0 || isBlocked) return
    setUploadingPhoto(true)
    for (const file of files) {
      const path = `${user.id}/${Date.now()}-${file.name}`
      const { error } = await supabase.storage.from('chat-media').upload(path, file)
      if (!error) {
        const { data } = supabase.storage.from('chat-media').getPublicUrl(path)
        await supabase.from('messages').insert({ sender_id: user.id, receiver_id: partnerId, media_url: data.publicUrl, media_type: 'image' })
      }
    }
    setUploadingPhoto(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data)
      recorder.onstop = handleRecordingStop
      mediaRecorderRef.current = recorder
      recorder.start()
      setRecording(true)
    } catch {
      alert("Couldn't access microphone. Check your browser permissions.")
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  async function handleRecordingStop() {
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
    const path = `${user.id}/${Date.now()}.webm`
    const { error } = await supabase.storage.from('chat-media').upload(path, blob)
    if (!error) {
      const { data } = supabase.storage.from('chat-media').getPublicUrl(path)
      await supabase.from('messages').insert({ sender_id: user.id, receiver_id: partnerId, media_url: data.publicUrl, media_type: 'audio' })
    }
  }

  return (
    <div className="app-shell">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        <BackHeader />
        <span className="relative -ml-2">
          {partner?.avatar_url ? <img src={partner.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" /> : <span className="w-9 h-9 rounded-full bg-brand-light flex items-center justify-center text-lg">🙂</span>}
          {isOnline ? <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white" /> : null}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm truncate">{partner?.full_name || 'Schoolink member'}</p>
          <p className="text-xs text-gray-400 truncate">{isOnline ? 'Online' : partner?.role || ''}</p>
        </div>
        <button onClick={() => navigate(`/chats/${partnerId}/options`)}><MoreVertical size={18} className="text-gray-400" /></button>
      </div>

      {isBlocked ? <div className="bg-red-50 text-red-500 text-xs text-center py-2 px-4">You've blocked this person. Unblock to send messages.</div> : null}

      <div className="screen-scroll px-4 py-3 flex flex-col gap-3">
        {messages.map((m) => (
          <MessageBubble key={m.id} m={m} isMine={m.sender_id === user.id} reactions={reactions} starred={starred} onReact={handleReact} onReply={setReplyTo} onStar={handleStar} allMessages={messages} />
        ))}
        <div ref={bottomRef} />
      </div>

      {replyTo ? (
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-t border-gray-100">
          <p className="text-xs text-gray-500 truncate">Replying to: {replyTo.content}</p>
          <button onClick={() => setReplyTo(null)}><X size={14} className="text-gray-400" /></button>
        </div>
      ) : null}

      <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-100">
        <button onClick={() => fileInputRef.current?.click()} disabled={isBlocked || uploadingPhoto}>
          <ImageIcon size={18} className={uploadingPhoto ? 'text-gray-300' : 'text-gray-500'} />
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handlePhotoChange} className="hidden" />
        <button onClick={recording ? stopRecording : startRecording} disabled={isBlocked} className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${recording ? 'bg-red-500' : 'bg-gray-100'} disabled:opacity-60`}>
          {recording ? <Square size={14} className="text-white" /> : <Mic size={16} className="text-gray-500" />}
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={isBlocked ? 'Unblock to send a message' : recording ? 'Recording…' : 'Message…'}
          disabled={isBlocked || recording}
          className="flex-1 border border-gray-200 rounded-full px-4 py-2.5 text-sm outline-brand-purple disabled:opacity-60"
        />
        <button onClick={handleSend} disabled={sending || isBlocked || recording} className="w-10 h-10 rounded-full bg-brand-purple flex items-center justify-center shrink-0 disabled:opacity-60"><Send size={16} className="text-white" /></button>
      </div>
    </div>
  )
  }
