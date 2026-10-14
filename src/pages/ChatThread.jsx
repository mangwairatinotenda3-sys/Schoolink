import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Send, Check, CheckCheck, MoreVertical, X, CornerUpLeft, Mic, Square, Star, Image as ImageIcon, Paperclip, Copy, Forward, FileText, Search, ChevronUp, ChevronDown, Plus, Trash2, Pencil, Smile } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import ForwardPicker from '../components/ForwardPicker.jsx'
import AvatarViewer from '../components/AvatarViewer.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useIsOnline } from '../lib/presence.jsx'
import { wallpapers, playTone, shouldAutoLoadMedia } from '../lib/chatPrefs.js'
import VerifiedBadge from '../components/VerifiedBadge.jsx'

const PAGE_SIZE = 40
const EDIT_WINDOW_MS = 15 * 60 * 1000
const QUICK_REACTIONS = ['❤️', '😂', '👍', '😮', '😢']

const ALL_EMOJIS = [
  '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇',
  '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑',
  '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬',
  '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🥵', '🥶',
  '😵', '🤯', '🥳', '😎', '🤓', '🧐', '😕', '😟', '🙁', '😮', '😯', '😲', '😳',
  '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓',
  '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '👍', '👎', '👏', '🙌', '👌', '🤝',
  '🙏', '💪', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '💯', '🔥',
  '✨', '🎉', '🎊', '👀', '💀', '🤡', '👻', '🤖', '🐶', '🐱', '🎂', '🍕', '☕',
]

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function dayLabel(iso) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (sameDay(d, today)) return 'Today'
  if (sameDay(d, yesterday)) return 'Yesterday'
  return d.toLocaleDateString([], {
    weekday: 'long', day: 'numeric', month: 'long',
    year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  })
}

function timeLabel(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatSeconds(total) {
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// Short text for a message, used in reply quotes and the reply bar.
function previewText(m) {
  if (!m) return ''
  if (m.deleted_at) return 'Message deleted'
  if (m.content && m.media_type !== 'file') return m.content
  if (m.media_type === 'image') return '📷 Photo'
  if (m.media_type === 'audio') return '🎤 Voice message'
  if (m.media_type === 'file') return `📎 ${m.content || 'File'}`
  return m.content || ''
}

function highlightText(text, query) {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 text-inherit rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

const LINK_PATTERN = /(https?:\/\/[^\s]*[^\s.,!?;:)]|www\.[^\s]*[^\s.,!?;:)])/gi

// Turns web addresses in a message into tappable links and keeps search highlighting.
function renderContent(text, query) {
  const parts = text.split(LINK_PATTERN)
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      const href = part.toLowerCase().startsWith('http') ? part : `https://${part}`
      return (
        <a key={i} href={href} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="underline break-all">
          {part}
        </a>
      )
    }
    return <span key={i}>{query ? highlightText(part, query) : part}</span>
  })
}

function ChatImage({ url, autoDownloadMedia, onOpen }) {
  const [revealed, setRevealed] = useState(() => shouldAutoLoadMedia(autoDownloadMedia))
  if (revealed) {
    return (
      <img
        src={url}
        alt=""
        onClick={(e) => { e.stopPropagation(); onOpen(url) }}
        className="rounded-lg max-h-64 object-cover mb-1"
      />
    )
  }
  return (
    <button
      onClick={(e) => { e.stopPropagation(); setRevealed(true) }}
      className="w-40 h-28 rounded-lg bg-black/10 flex flex-col items-center justify-center gap-1 mb-1"
    >
      <ImageIcon size={20} />
      <span className="text-xs">Tap to load</span>
    </button>
  )
}

function MessageBubble({ m, isMine, reactions, starred, currentUserId, onReact, onRemoveReaction, onReply, onStar, onForward, onDelete, onEdit, onJumpTo, onOpenImage, allMessages, highlightQuery, isCurrentMatch, autoDownloadMedia }) {
  const [showBar, setShowBar] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const repliedTo = m.reply_to_id ? allMessages.find((x) => x.id === m.reply_to_id) : null
  const myReactions = reactions[m.id] ?? []
  const isStarred = starred.has(m.id)
  const deleted = !!m.deleted_at
  const canEdit = isMine && !deleted && m.content && !m.media_type && Date.now() - new Date(m.created_at).getTime() < EDIT_WINDOW_MS

  function handleCopy(e) {
    e.stopPropagation()
    if (m.content) navigator.clipboard?.writeText(m.content)
    setShowBar(false)
  }

  function handlePickEmoji(e, emoji) {
    e.stopPropagation()
    onReact(m.id, emoji)
    setShowEmojiPicker(false)
    setShowBar(false)
  }

  function handleDelete(e) {
    e.stopPropagation()
    if (!window.confirm('Delete this message for everyone?')) return
    onDelete(m.id)
    setShowBar(false)
  }

  if (deleted) {
    return (
      <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
        <div className="max-w-[75%] rounded-2xl px-4 py-2 text-xs italic text-gray-400 border border-gray-100 bg-white/70">
          🚫 This message was deleted
          <span className="block text-right text-[10px] mt-0.5 not-italic opacity-70">{timeLabel(m.created_at)}</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[75%]">
        <div onClick={() => setShowBar((s) => !s)} className={`rounded-2xl px-4 py-2 text-sm ${isMine ? 'bg-brand-purple text-white rounded-br-sm' : 'bg-gray-100 text-brand-navy rounded-bl-sm'} ${isCurrentMatch ? 'ring-2 ring-amber-400' : ''}`}>
          {repliedTo ? (
            <button
              onClick={(e) => { e.stopPropagation(); onJumpTo(repliedTo.id) }}
              className={`block w-full text-left text-xs border-l-2 pl-2 mb-1 opacity-80 truncate ${isMine ? 'border-white/50' : 'border-brand-purple/50'}`}
            >
              {previewText(repliedTo)}
            </button>
          ) : null}
          {m.media_type === 'audio' && m.media_url ? <audio src={m.media_url} controls preload="none" className="max-w-full" /> : null}
          {m.media_type === 'image' && m.media_url ? <ChatImage url={m.media_url} autoDownloadMedia={autoDownloadMedia} onOpen={onOpenImage} /> : null}
          {m.media_type === 'file' && m.media_url ? (
            <a href={m.media_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="flex items-center gap-2 underline"><FileText size={15} /> {m.content || 'Shared file'}</a>
          ) : null}
          {m.content && m.media_type !== 'file' ? <p className="whitespace-pre-wrap break-words">{renderContent(m.content, highlightQuery)}</p> : null}
          <span className="flex items-center justify-end gap-1 mt-1 text-[10px] opacity-70">
            {m.edited_at ? <span>edited</span> : null}
            <span>{timeLabel(m.created_at)}</span>
            {isMine ? (m.read ? <CheckCheck size={14} className="text-blue-200" /> : <Check size={14} className="text-white/70" />) : null}
          </span>
        </div>

        {(myReactions.length > 0 || isStarred) ? (
          <div className="flex gap-1 mt-0.5">
            {isStarred ? <Star size={12} className="text-amber-500 fill-amber-500" /> : null}
            {myReactions.map((r, i) => {
              const mine = r.user_id === currentUserId
              return (
                <span
                  key={`${r.emoji}-${r.user_id}-${i}`}
                  onClick={(e) => { e.stopPropagation(); if (mine) onRemoveReaction(m.id) }}
                  className={`text-xs bg-white border border-gray-100 rounded-full px-1.5 ${mine ? 'cursor-pointer' : ''}`}
                  title={mine ? 'Tap to remove' : ''}
                >
                  {r.emoji}
                </span>
              )
            })}
          </div>
        ) : null}

        {showBar ? (
          <div className="mt-1 relative w-fit">
            <div className="flex items-center gap-1 bg-white border border-gray-100 rounded-full px-2 py-1 shadow w-fit">
              {QUICK_REACTIONS.map((emoji) => (
                <button key={emoji} onClick={(e) => { e.stopPropagation(); onReact(m.id, emoji); setShowBar(false) }} className="text-base">{emoji}</button>
              ))}
              <button onClick={(e) => { e.stopPropagation(); setShowEmojiPicker((s) => !s) }} className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center shrink-0"><Plus size={12} className="text-gray-500" /></button>
              <button onClick={(e) => { e.stopPropagation(); onReply(m); setShowBar(false) }} className="pl-1 border-l border-gray-100 ml-1"><CornerUpLeft size={14} className="text-gray-400" /></button>
              <button onClick={(e) => { e.stopPropagation(); onStar(m.id, isStarred); setShowBar(false) }}><Star size={14} className={isStarred ? 'text-amber-500 fill-amber-500' : 'text-gray-400'} /></button>
              {m.content ? <button onClick={handleCopy}><Copy size={14} className="text-gray-400" /></button> : null}
              <button onClick={(e) => { e.stopPropagation(); onForward(m); setShowBar(false) }}><Forward size={14} className="text-gray-400" /></button>
              {canEdit ? <button onClick={(e) => { e.stopPropagation(); onEdit(m); setShowBar(false) }}><Pencil size={14} className="text-gray-400" /></button> : null}
              {isMine ? <button onClick={handleDelete}><Trash2 size={14} className="text-red-400" /></button> : null}
            </div>

            {showEmojiPicker ? (
              <div onClick={(e) => e.stopPropagation()} className="absolute top-full mt-1 left-0 z-10 w-56 max-h-40 overflow-y-auto bg-white border border-gray-100 rounded-xl shadow p-2 grid grid-cols-7 gap-1">
                {ALL_EMOJIS.map((emoji) => (
                  <button key={emoji} onClick={(e) => handlePickEmoji(e, emoji)} className="text-lg leading-none p-0.5">{emoji}</button>
                ))}
              </div>
            ) : null}
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
  const photoInputRef = useRef(null)
  const fileInputRef = useRef(null)

  const [partner, setPartner] = useState(null)
  const [messages, setMessages] = useState([])
  const [hasMore, setHasMore] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [reactions, setReactions] = useState({})
  const [starred, setStarred] = useState(new Set())
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [editing, setEditing] = useState(null)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [isBlocked, setIsBlocked] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [forwarding, setForwarding] = useState(null)
  const [myChatSettings, setMyChatSettings] = useState({ disappearing_enabled: false, disappearing_seconds: 86400 })
  const mutedRef = useRef(false)
  useEffect(() => { mutedRef.current = !!myChatSettings.muted }, [myChatSettings])
  const [viewingAvatar, setViewingAvatar] = useState(null)
  const [lightboxUrl, setLightboxUrl] = useState(null)
  const [showEmojis, setShowEmojis] = useState(false)
  const [partnerTyping, setPartnerTyping] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [matchIndex, setMatchIndex] = useState(0)
  const [atBottom, setAtBottom] = useState(true)
  const [newCount, setNewCount] = useState(0)
  const scrollRef = useRef(null)
  const bottomRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const cancelRecordingRef = useRef(false)
  const messageRefs = useRef({})
  const stickToBottomRef = useRef(true)
  const firstLoadRef = useRef(true)
  const prevHeightRef = useRef(null)
  const typingChannelRef = useRef(null)
  const typingReadyRef = useRef(false)
  const lastTypingSentRef = useRef(0)
  const typingTimerRef = useRef(null)

  const matches = searchQuery.trim()
    ? messages.filter((m) => !m.deleted_at && m.content?.toLowerCase().includes(searchQuery.toLowerCase().trim()))
    : []

  useEffect(() => { setMatchIndex(0) }, [searchQuery])

  useEffect(() => {
    if (matches.length === 0) return
    const current = matches[matchIndex]
    if (current) messageRefs.current[current.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [matchIndex, searchQuery])

  function goToPrevMatch() {
    if (matches.length === 0) return
    setMatchIndex((i) => (i - 1 + matches.length) % matches.length)
  }

  function goToNextMatch() {
    if (matches.length === 0) return
    setMatchIndex((i) => (i + 1) % matches.length)
  }

  function closeSearch() {
    setSearchOpen(false)
    setSearchQuery('')
  }

  function jumpTo(messageId) {
    const el = messageRefs.current[messageId]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  // Keep the person's place: stay at the bottom for new messages, but never yank the screen
  // while they are reading older ones.
  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    stickToBottomRef.current = near
    setAtBottom(near)
    if (near) setNewCount(0)
  }

  function scrollToBottom(smooth = true) {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })
    stickToBottomRef.current = true
    setAtBottom(true)
    setNewCount(0)
  }

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (prevHeightRef.current !== null) {
      // Older messages were added at the top: keep the same message in view.
      el.scrollTop += el.scrollHeight - prevHeightRef.current
      prevHeightRef.current = null
      return
    }
    if (messages.length === 0) return
    const last = messages[messages.length - 1]
    if (firstLoadRef.current) {
      firstLoadRef.current = false
      bottomRef.current?.scrollIntoView({ behavior: 'auto' })
    } else if (stickToBottomRef.current || last?.sender_id === user?.id) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  useEffect(() => {
    setPartner(null)
    supabase.from('profiles').select('full_name, avatar_url, role').eq('id', partnerId).maybeSingle().then(({ data }) => setPartner(data))
    supabase.from('blocked_users').select('*').eq('blocker_id', user.id).eq('blocked_id', partnerId).maybeSingle().then(({ data }) => setIsBlocked(!!data))
    supabase.from('chat_settings').select('*').eq('user_id', user.id).eq('partner_id', partnerId).maybeSingle().then(({ data }) => {
      if (data) setMyChatSettings(data)
    })
  }, [partnerId])

  // Unsent text is kept per chat, so leaving the screen does not lose it.
  const draftKey = `schoolink_draft_${user?.id}_${partnerId}`
  useEffect(() => {
    try {
      setText(localStorage.getItem(draftKey) || '')
    } catch {
      setText('')
    }
    setReplyTo(null)
    setEditing(null)
    setShowEmojis(false)
  }, [partnerId])

  function updateText(value) {
    setText(value)
    setSendError('')
    if (!editing) {
      try {
        if (value) localStorage.setItem(draftKey, value)
        else localStorage.removeItem(draftKey)
      } catch {
        // ignore
      }
    }
    sendTyping(value)
  }

  function addMessage(m) {
    setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]))
  }

  // Realtime: new messages, edits, deletes and read ticks, plus the "typing…" signal.
  useEffect(() => {
    if (!user) return undefined
    firstLoadRef.current = true
    stickToBottomRef.current = true
    setNewCount(0)
    loadMessages()

    const isThisThread = (m) => (m.sender_id === user.id && m.receiver_id === partnerId) || (m.sender_id === partnerId && m.receiver_id === user.id)

    const channel = supabase
      .channel(`chat-${user.id}-${partnerId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const m = payload.new
        if (!isThisThread(m)) return
        addMessage(m)
        if (m.receiver_id === user.id && profile?.read_receipts_enabled !== false) {
          supabase.from('messages').update({ read: true }).eq('id', m.id)
        }
        if (m.sender_id !== user.id) {
          setPartnerTyping(false)
          if (!stickToBottomRef.current) setNewCount((c) => c + 1)
          if (!mutedRef.current) playTone(profile?.notify_message_tone || 'default')
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
        const m = payload.new
        if (!isThisThread(m)) return
        setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, ...m } : x)))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
        const id = payload.old?.id
        if (id) setMessages((prev) => prev.filter((x) => x.id !== id))
      })
      .subscribe()

    const names = [user.id, partnerId].sort().join('-')
    const typingChannel = supabase
      .channel(`typing-${names}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload?.from !== partnerId) return
        setPartnerTyping(true)
        clearTimeout(typingTimerRef.current)
        typingTimerRef.current = setTimeout(() => setPartnerTyping(false), 3000)
      })
      .subscribe((status) => { typingReadyRef.current = status === 'SUBSCRIBED' })
    typingChannelRef.current = typingChannel

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(typingChannel)
      typingChannelRef.current = null
      typingReadyRef.current = false
      clearTimeout(typingTimerRef.current)
      setPartnerTyping(false)
    }
  }, [user, partnerId])

  function sendTyping(value) {
    if (!value || !typingReadyRef.current || !typingChannelRef.current) return
    const now = Date.now()
    if (now - lastTypingSentRef.current < 2000) return
    lastTypingSentRef.current = now
    typingChannelRef.current.send({ type: 'broadcast', event: 'typing', payload: { from: user.id } })
  }

  const threadFilter = () => `and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`

  async function loadExtras(ids) {
    if (ids.length === 0) return
    const { data: allReactions } = await supabase.from('message_reactions').select('*').in('message_id', ids)
    setReactions((prev) => {
      const next = { ...prev }
      for (const r of allReactions ?? []) {
        const list = next[r.message_id] ?? []
        if (!list.some((x) => x.user_id === r.user_id && x.emoji === r.emoji)) next[r.message_id] = [...list, { emoji: r.emoji, user_id: r.user_id }]
      }
      return next
    })
    const { data: starredRows } = await supabase.from('starred_messages').select('message_id').eq('user_id', user.id).in('message_id', ids)
    setStarred((prev) => {
      const next = new Set(prev)
      for (const s of starredRows ?? []) next.add(s.message_id)
      return next
    })
  }

  // Only the latest messages load first; older ones load when asked.
  async function loadMessages() {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(threadFilter())
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)

    const page = (data ?? []).slice().reverse()
    setHasMore((data ?? []).length === PAGE_SIZE)

    const now = new Date()
    const active = page.filter((m) => !m.expire_at || new Date(m.expire_at) > now)
    const expired = page.filter((m) => m.expire_at && new Date(m.expire_at) <= now)
    if (expired.length > 0) {
      await supabase.from('messages').delete().in('id', expired.map((m) => m.id))
    }
    setMessages(active)
    await loadExtras(active.map((m) => m.id))

    const unreadIds = active.filter((m) => m.receiver_id === user.id && !m.read).map((m) => m.id)
    if (unreadIds.length > 0) await supabase.from('messages').update({ read: true }).in('id', unreadIds)
  }

  async function loadOlder() {
    if (loadingOlder || messages.length === 0) return
    setLoadingOlder(true)
    const oldest = messages[0]
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(threadFilter())
      .lt('created_at', oldest.created_at)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)

    const older = (data ?? []).slice().reverse()
    setHasMore((data ?? []).length === PAGE_SIZE)
    const now = new Date()
    const active = older.filter((m) => !m.expire_at || new Date(m.expire_at) > now)
    if (scrollRef.current) prevHeightRef.current = scrollRef.current.scrollHeight
    setMessages((prev) => [...active.filter((m) => !prev.some((x) => x.id === m.id)), ...prev])
    await loadExtras(active.map((m) => m.id))
    setLoadingOlder(false)
  }

  function computeExpiry() {
    return myChatSettings.disappearing_enabled ? new Date(Date.now() + myChatSettings.disappearing_seconds * 1000).toISOString() : null
  }

  // Saves a message and shows it straight away, without waiting for the live update.
  async function sendRow(row) {
    const { data, error } = await supabase.from('messages').insert(row).select().single()
    if (data) addMessage(data)
    return { error }
  }

  async function handleReact(messageId, emoji) {
    await supabase.from('message_reactions').upsert({ message_id: messageId, user_id: user.id, emoji })
    setReactions((prev) => {
      const others = (prev[messageId] ?? []).filter((r) => r.user_id !== user.id)
      return { ...prev, [messageId]: [...others, { emoji, user_id: user.id }] }
    })
  }

  async function handleRemoveReaction(messageId) {
    await supabase.from('message_reactions').delete().eq('message_id', messageId).eq('user_id', user.id)
    setReactions((prev) => ({ ...prev, [messageId]: (prev[messageId] ?? []).filter((r) => r.user_id !== user.id) }))
  }

  // Delete for everyone: the message stays as "This message was deleted".
  async function handleDeleteMessage(messageId) {
    const stamp = new Date().toISOString()
    const { error } = await supabase
      .from('messages')
      .update({ deleted_at: stamp, content: null, media_url: null, media_type: null })
      .eq('id', messageId)
    if (error) {
      // The new columns are not set up yet: fall back to removing the message.
      await supabase.from('messages').delete().eq('id', messageId)
      setMessages((prev) => prev.filter((m) => m.id !== messageId))
      return
    }
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, deleted_at: stamp, content: null, media_url: null, media_type: null } : m)))
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

  function startEdit(m) {
    setReplyTo(null)
    setEditing(m)
    setText(m.content || '')
    setShowEmojis(false)
  }

  function cancelEdit() {
    setEditing(null)
    try {
      setText(localStorage.getItem(draftKey) || '')
    } catch {
      setText('')
    }
  }

  async function handleSend() {
    if (!text.trim() || sending || isBlocked) return
    setSending(true)
    setSendError('')
    const content = text
    setShowEmojis(false)

    if (editing) {
      const target = editing
      const stamp = new Date().toISOString()
      const { error } = await supabase.from('messages').update({ content: content.trim(), edited_at: stamp }).eq('id', target.id)
      setSending(false)
      if (error) {
        setSendError("Couldn't save the change. Try again.")
        return
      }
      setMessages((prev) => prev.map((m) => (m.id === target.id ? { ...m, content: content.trim(), edited_at: stamp } : m)))
      setEditing(null)
      try {
        setText(localStorage.getItem(draftKey) || '')
      } catch {
        setText('')
      }
      return
    }

    const replyId = replyTo?.id ?? null
    const previousReply = replyTo
    setText('')
    setReplyTo(null)
    try {
      localStorage.removeItem(draftKey)
    } catch {
      // ignore
    }
    const { error } = await sendRow({ sender_id: user.id, receiver_id: partnerId, content, reply_to_id: replyId, expire_at: computeExpiry() })
    setSending(false)
    if (error) {
      // Put the text back so nothing is lost.
      setText(content)
      setReplyTo(previousReply)
      setSendError('Message not sent. Check your connection and tap send again.')
    }
  }

  async function handlePhotoChange(e) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0 || isBlocked) return
    setUploading(true)
    setSendError('')
    for (const file of files) {
      const path = `${user.id}/${Date.now()}-${file.name}`
      const { error } = await supabase.storage.from('chat-media').upload(path, file)
      if (error) {
        setSendError(`Couldn't upload ${file.name}.`)
        continue
      }
      const { data } = supabase.storage.from('chat-media').getPublicUrl(path)
      await sendRow({ sender_id: user.id, receiver_id: partnerId, media_url: data.publicUrl, media_type: 'image', expire_at: computeExpiry() })
    }
    setUploading(false)
    if (photoInputRef.current) photoInputRef.current.value = ''
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file || isBlocked) return
    setUploading(true)
    setSendError('')
    const path = `${user.id}/${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from('chat-media').upload(path, file)
    if (error) {
      setSendError(`Couldn't upload ${file.name}.`)
    } else {
      const { data } = supabase.storage.from('chat-media').getPublicUrl(path)
      await sendRow({ sender_id: user.id, receiver_id: partnerId, media_url: data.publicUrl, media_type: 'file', content: file.name, expire_at: computeExpiry() })
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Voice notes: a running timer, and the microphone is released when you stop or cancel.
  useEffect(() => {
    if (!recording) return undefined
    setRecordSeconds(0)
    const timer = setInterval(() => setRecordSeconds((s) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [recording])

  // Picks a sound format this phone can record and play back.
  function pickAudioType() {
    if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return ''
    const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
    return types.find((t) => MediaRecorder.isTypeSupported(t)) || ''
  }

    async function handleRecordingStop() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (cancelRecordingRef.current) return
    const base = (mediaRecorderRef.current?.mimeType || 'audio/webm').split(';')[0]
    const ext = base.includes('mp4') ? 'm4a' : base.includes('ogg') ? 'ogg' : 'webm'
    const blob = new Blob(chunksRef.current, { type: base })
    if (blob.size === 0) {
      setSendError('Nothing was recorded. Hold the phone closer and try again.')
      return
    }
    setUploading(true)
    const path = `${user.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('chat-media').upload(path, blob, { contentType: base })
    if (error) {
      setUploading(false)
      setSendError("Couldn't send the voice message.")
      return
    }
    const { data } = supabase.storage.from('chat-media').getPublicUrl(path)
    const { error: sendErr } = await sendRow({ sender_id: user.id, receiver_id: partnerId, media_url: data.publicUrl, media_type: 'audio', expire_at: computeExpiry() })
    setUploading(false)
    if (sendErr) setSendError(`The voice message was uploaded but couldn't be sent. (${sendErr.message || 'unknown error'})`)
}

  async function handleForwardSend(recipientId) {
    if (!forwarding) return
    await supabase.from('messages').insert({ sender_id: user.id, receiver_id: recipientId, content: forwarding.content, media_url: forwarding.media_url, media_type: forwarding.media_type })
    setForwarding(null)
    navigate(`/chats/${recipientId}`)
    }

  return (
    <div className="app-shell">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        {searchOpen ? (
          <>
            <button onClick={closeSearch}><X size={18} className="text-gray-400" /></button>
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in this chat…"
              className="flex-1 border border-gray-200 rounded-full px-4 py-2 text-sm outline-brand-purple"
            />
            <span className="text-xs text-gray-400 shrink-0 w-10 text-center">{searchQuery.trim() ? (matches.length > 0 ? `${matchIndex + 1}/${matches.length}` : '0/0') : ''}</span>
            <button onClick={goToPrevMatch} disabled={matches.length === 0}><ChevronUp size={18} className={matches.length ? 'text-brand-purple' : 'text-gray-300'} /></button>
            <button onClick={goToNextMatch} disabled={matches.length === 0}><ChevronDown size={18} className={matches.length ? 'text-brand-purple' : 'text-gray-300'} /></button>
          </>
        ) : (
          <>
            <BackHeader />
            <button onClick={() => partner?.avatar_url && setViewingAvatar(partner.avatar_url)} className="relative -ml-2">
              {partner?.avatar_url ? <img src={partner.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" /> : <span className="w-9 h-9 rounded-full bg-brand-light flex items-center justify-center text-lg">🙂</span>}
              {isOnline ? <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white" /> : null}
            </button>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm truncate flex items-center gap-1"><span className="truncate">{partner?.full_name || 'Schoolink member'}</span><VerifiedBadge userId={partnerId} size={14} /></p>
              <p className={`text-xs truncate ${partnerTyping ? 'text-brand-purple font-medium' : 'text-gray-400'}`}>{partnerTyping ? 'typing…' : isOnline ? 'Online' : partner?.role || ''}</p>
            </div>
            <button onClick={() => setSearchOpen(true)}><Search size={18} className="text-gray-400" /></button>
            <button onClick={() => navigate(`/chats/${partnerId}/options`)}><MoreVertical size={18} className="text-gray-400" /></button>
          </>
        )}
      </div>

      {isBlocked ? <div className="bg-red-50 text-red-500 text-xs text-center py-2 px-4">You've blocked this person. Unblock to send messages.</div> : null}
      {myChatSettings.disappearing_enabled ? <div className="bg-brand-light text-brand-purple text-[11px] text-center py-1.5 px-4">Disappearing messages are on</div> : null}

      <div ref={scrollRef} onScroll={handleScroll} className="screen-scroll px-4 py-3 flex flex-col gap-3" style={wallpapers.find((w) => w.key === (profile?.chat_wallpaper || 'default'))?.style}>
        {hasMore ? (
          <button onClick={loadOlder} disabled={loadingOlder} className="self-center text-xs text-brand-purple bg-white/80 border border-gray-100 rounded-full px-4 py-1.5 disabled:opacity-60">
            {loadingOlder ? 'Loading…' : 'Load earlier messages'}
          </button>
        ) : null}
        {messages.map((m, i) => {
          const showDay = i === 0 || !sameDay(new Date(messages[i - 1].created_at), new Date(m.created_at))
          return (
            <div key={m.id} ref={(el) => (messageRefs.current[m.id] = el)} className="flex flex-col gap-3">
              {showDay ? (
                <span className="self-center text-[11px] text-gray-500 bg-white/80 border border-gray-100 rounded-full px-3 py-0.5">{dayLabel(m.created_at)}</span>
              ) : null}
              <MessageBubble m={m} isMine={m.sender_id === user.id} reactions={reactions} starred={starred} currentUserId={user.id} onReact={handleReact} onRemoveReaction={handleRemoveReaction} onReply={setReplyTo} onStar={handleStar} onForward={setForwarding} onDelete={handleDeleteMessage} onEdit={startEdit} onJumpTo={jumpTo} onOpenImage={setLightboxUrl} allMessages={messages} highlightQuery={searchQuery.trim()} isCurrentMatch={matches[matchIndex]?.id === m.id} autoDownloadMedia={profile?.auto_download_media} />
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {!atBottom ? (
        <button
          onClick={() => scrollToBottom(true)}
          aria-label="Scroll to latest"
          className="absolute bottom-24 right-4 w-10 h-10 rounded-full bg-white border border-gray-200 shadow flex items-center justify-center"
        >
          <ChevronDown size={20} className="text-brand-purple" />
          {newCount > 0 ? (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-purple text-white text-[10px] font-semibold flex items-center justify-center">{newCount > 9 ? '9+' : newCount}</span>
          ) : null}
        </button>
      ) : null}

      {sendError ? <div className="bg-red-50 text-red-500 text-xs text-center py-2 px-4">{sendError}</div> : null}

      {editing ? (
        <div className="flex items-center justify-between px-4 py-2 bg-brand-light border-t border-gray-100">
          <p className="text-xs text-brand-purple truncate flex items-center gap-1"><Pencil size={12} /> Editing message</p>
          <button onClick={cancelEdit}><X size={14} className="text-gray-400" /></button>
        </div>
      ) : null}

      {replyTo ? (
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-t border-gray-100">
          <p className="text-xs text-gray-500 truncate">Replying to: {previewText(replyTo)}</p>
          <button onClick={() => setReplyTo(null)}><X size={14} className="text-gray-400" /></button>
        </div>
      ) : null}

      {showEmojis ? (
        <div className="px-4 py-2 border-t border-gray-100 bg-white max-h-36 overflow-y-auto grid grid-cols-9 gap-1">
          {ALL_EMOJIS.map((emoji, i) => (
            <button key={`${emoji}-${i}`} onClick={() => updateText(text + emoji)} className="text-xl leading-none p-1">{emoji}</button>
          ))}
        </div>
      ) : null}

      <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-100">
        {recording ? (
          <>
            <button onClick={cancelRecording} aria-label="Cancel recording" className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0"><Trash2 size={16} className="text-red-400" /></button>
            <div className="flex-1 flex items-center gap-2 border border-red-200 bg-red-50 rounded-full px-4 py-2.5 text-sm text-red-500">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              Recording {formatSeconds(recordSeconds)}
            </div>
            <button onClick={stopRecording} aria-label="Send voice message" className="w-10 h-10 rounded-full bg-brand-purple flex items-center justify-center shrink-0"><Send size={16} className="text-white" /></button>
          </>
        ) : (
          <>
            <button onClick={() => photoInputRef.current?.click()} disabled={isBlocked || uploading || !!editing}><ImageIcon size={18} className={uploading ? 'text-gray-300' : 'text-gray-500'} /></button>
            <input ref={photoInputRef} type="file" accept="image/*" multiple onChange={handlePhotoChange} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} disabled={isBlocked || uploading || !!editing}><Paperclip size={17} className={uploading ? 'text-gray-300' : 'text-gray-500'} /></button>
            <input ref={fileInputRef} type="file" onChange={handleFileChange} className="hidden" />
            <button onClick={() => setShowEmojis((s) => !s)} aria-label="Emoji"><Smile size={18} className={showEmojis ? 'text-brand-purple' : 'text-gray-500'} /></button>
            <input
              value={text}
              onChange={(e) => updateText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && profile?.chat_enter_to_send !== false && handleSend()}
              placeholder={isBlocked ? 'Unblock to send a message' : editing ? 'Edit your message…' : 'Message…'}
              disabled={isBlocked}
              className="flex-1 min-w-0 border border-gray-200 rounded-full px-4 py-2.5 text-sm outline-brand-purple disabled:opacity-60"
            />
            {text.trim() || editing ? (
              <button onClick={handleSend} disabled={sending || isBlocked} className="w-10 h-10 rounded-full bg-brand-purple flex items-center justify-center shrink-0 disabled:opacity-60">
                {editing ? <Check size={18} className="text-white" /> : <Send size={16} className="text-white" />}
              </button>
            ) : (
              <button onClick={startRecording} disabled={isBlocked} aria-label="Record voice message" className="w-10 h-10 rounded-full bg-brand-purple flex items-center justify-center shrink-0 disabled:opacity-60">
                <Mic size={18} className="text-white" />
              </button>
            )}
          </>
        )}
      </div>

      {lightboxUrl ? (
        <div onClick={() => setLightboxUrl(null)} className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
          <button onClick={() => setLightboxUrl(null)} aria-label="Close" className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 flex items-center justify-center"><X size={20} className="text-white" /></button>
          <img src={lightboxUrl} alt="" onClick={(e) => e.stopPropagation()} className="max-w-full max-h-full object-contain" />
          <a href={lightboxUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="absolute bottom-6 text-xs text-white/80 underline">Open original</a>
        </div>
      ) : null}

      {forwarding ? <ForwardPicker onClose={() => setForwarding(null)} onSend={handleForwardSend} /> : null}
      {viewingAvatar ? <AvatarViewer imageUrl={viewingAvatar} onClose={() => setViewingAvatar(null)} /> : null}
    </div>
  )
            }
