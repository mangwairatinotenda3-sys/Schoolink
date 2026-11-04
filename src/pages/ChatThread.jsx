import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Send, Check, CheckCheck, MoreVertical, X, CornerUpLeft, Mic, Star, Image as ImageIcon, Paperclip, Copy, Forward, FileText, Search, ChevronUp, ChevronDown, Plus, Trash2, Pencil, Smile, Camera, Clock, AlertCircle, Download, Film, Loader2, Info, Ban, User } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { CallButtons } from '../components/CallOverlay.jsx'
import VoicePlayer from '../components/VoicePlayer.jsx'
import MediaPreview from '../components/MediaPreview.jsx'
import ZoomImage from '../components/ZoomImage.jsx'
import ForwardPicker from '../components/ForwardPicker.jsx'
import AvatarViewer from '../components/AvatarViewer.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useIsOnline } from '../lib/presence.jsx'
import { wallpapers, playTone, shouldAutoLoadMedia } from '../lib/chatPrefs.js'
import VerifiedBadge from '../components/VerifiedBadge.jsx'
import { haptic } from '../lib/uiPrefs.js'

const PAGE_SIZE = 40
const EDIT_WINDOW_MS = 15 * 60 * 1000
const MAX_UPLOAD_MB = 50
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

function kindOfFile(file) {
  const type = file.type || ''
  if (type.startsWith('image/')) return 'image'
  if (type.startsWith('video/')) return 'video'
  return 'file'
}

function fileExt(name) {
  const part = String(name || '').split('.').pop()
  return part && part.length <= 5 && part !== name ? part : 'file'
}

function sizeText(bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Short text for a message, used in reply quotes and the reply bar.
function previewText(m) {
  if (!m) return ''
  if (m.deleted_at) return 'Message deleted'
  if (m.content && m.media_type !== 'file') return m.content
  if (m.media_type === 'image') return 'Photo'
  if (m.media_type === 'video') return 'Video'
  if (m.media_type === 'audio') return 'Voice message'
  if (m.media_type === 'file') return m.content || 'File'
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
        className="rounded-xl w-64 max-w-full max-h-72 object-cover"
      />
    )
  }
  return (
    <button
      onClick={(e) => { e.stopPropagation(); setRevealed(true) }}
      className="w-64 max-w-full h-40 rounded-xl bg-black/10 flex flex-col items-center justify-center gap-1"
    >
      <ImageIcon size={20} />
      <span className="text-xs">Tap to load</span>
    </button>
  )
}

// A photo, video, document or voice note that is still on its way: it shows straight away, with a spinner.
function PendingBubble({ item, onRetry, onDiscard }) {
  const failed = item.status === 'failed'
  const visual = item.kind === 'image' || item.kind === 'video'
  return (
    <div className="flex justify-end">
      <div className="max-w-[75%]">
        <div className={`chat-bubble mine bg-brand-purple text-white ${visual ? 'p-1.5' : 'px-4 py-2'}`}>
          {item.kind === 'image' ? (
            <div className="relative">
              <img src={item.previewUrl} alt="" className={`rounded-xl w-64 max-w-full max-h-72 object-cover ${failed ? 'opacity-60' : 'opacity-80'}`} />
              {!failed ? <span className="absolute inset-0 flex items-center justify-center"><Loader2 size={28} className="text-white animate-spin" /></span> : null}
            </div>
          ) : null}
          {item.kind === 'video' ? (
            <div className="relative w-64 max-w-full h-40 rounded-xl bg-black/40 flex items-center justify-center">
              <Film size={30} className="text-white/80" />
              {!failed ? <span className="absolute bottom-2 right-2"><Loader2 size={18} className="text-white animate-spin" /></span> : null}
            </div>
          ) : null}
          {item.kind === 'file' ? (
            <div className="flex items-center gap-3 w-56 max-w-full">
              <span className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center shrink-0"><FileText size={20} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm truncate">{item.name}</span>
                <span className="block text-[10px] opacity-70 uppercase">{fileExt(item.name)} · {sizeText(item.size)}</span>
              </span>
            </div>
          ) : null}
          {item.kind === 'audio' ? (
            <div className="flex items-center gap-2 w-56 max-w-full py-1">
              <span className="w-9 h-9 rounded-full bg-white/25 flex items-center justify-center shrink-0"><Mic size={16} /></span>
              <span className="text-xs opacity-90">Voice message</span>
            </div>
          ) : null}
          {item.caption ? <p className={`whitespace-pre-wrap break-words ${visual ? 'px-2 pt-1' : 'mt-1'}`}>{item.caption}</p> : null}
          <span className={`flex items-center justify-end gap-1 mt-1 text-[10px] opacity-80 ${visual ? 'px-2 pb-0.5' : ''}`}>
            {failed ? (
              <>
                <AlertCircle size={13} />
                <span>Not sent</span>
              </>
            ) : (
              <>
                <span>Sending…</span>
                <Clock size={12} />
              </>
            )}
          </span>
        </div>
        {failed ? (
          <div className="flex justify-end gap-3 mt-1 text-xs">
            <button onClick={() => onRetry(item.tempId)} className="text-brand-purple font-medium">Retry</button>
            <button onClick={() => onDiscard(item.tempId)} className="text-gray-400">Discard</button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function fullStamp(iso) {
  const d = new Date(iso)
  return `${d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · ${timeLabel(iso)}`
}

// Three bouncing dots shown while the other person is typing.
function TypingBubble() {
  return (
    <div className="flex justify-start">
      <style>{`@keyframes sl-dot{0%,60%,100%{transform:translateY(0);opacity:.35}30%{transform:translateY(-4px);opacity:1}}html[data-motion="reduce"] .sl-dot{animation:none!important}`}</style>
      <div className="chat-bubble theirs bg-gray-100 px-4 py-3 flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <span key={i} className="sl-dot w-1.5 h-1.5 rounded-full bg-gray-500" style={{ animation: 'sl-dot 1.1s infinite', animationDelay: `${i * 0.16}s` }} />
        ))}
      </div>
    </div>
  )
        }

// One chat bubble. Swipe right to reply, double-tap for a heart, press and hold (or right-click) for the menu.
function MessageBubble({ m, isMine, reactions, starred, currentUserId, partnerName, onOpenMenu, onReply, onReact, onRemoveReaction, onJumpTo, onOpenImage, allMessages, highlightQuery, isCurrentMatch, flash, autoDownloadMedia, last }) {
  const [dx, setDx] = useState(0)
  const touch = useRef({ x: 0, y: 0, active: false, swiping: false, moved: false, timer: null })
  const lastTap = useRef(0)
  const repliedTo = m.reply_to_id ? allMessages.find((x) => x.id === m.reply_to_id) : null
  const isStarred = starred.has(m.id)
  const deleted = !!m.deleted_at
  const visual = (m.media_type === 'image' || m.media_type === 'video') && !!m.media_url

  const groups = []
  for (const r of reactions[m.id] ?? []) {
    const g = groups.find((x) => x.emoji === r.emoji)
    if (g) { g.count += 1; if (r.user_id === currentUserId) g.mine = true } else groups.push({ emoji: r.emoji, count: 1, mine: r.user_id === currentUserId })
  }

  // Only the last bubble in a run gets the little corner "tail".
  const tailStyle = last ? undefined : { [isMine ? 'borderBottomRightRadius' : 'borderBottomLeftRadius']: 'var(--bubble-r, 16px)' }

  function clearTimer() { clearTimeout(touch.current.timer) }

  function onTouchStart(e) {
    const t = e.touches[0]
    clearTimer()
    touch.current = {
      x: t.clientX, y: t.clientY, active: true, swiping: false, moved: false,
      timer: setTimeout(() => {
        if (!touch.current.moved) { touch.current.active = false; haptic(12); onOpenMenu(m) }
      }, 450),
    }
  }

  function onTouchMove(e) {
    const t = e.touches[0]
    const ddx = t.clientX - touch.current.x
    const ddy = t.clientY - touch.current.y
    if (Math.abs(ddx) > 8 || Math.abs(ddy) > 8) { touch.current.moved = true; clearTimer() }
    if (!touch.current.active) return
    if (!touch.current.swiping && ddx > 14 && Math.abs(ddx) > Math.abs(ddy) * 1.6) touch.current.swiping = true
    if (touch.current.swiping) setDx(Math.min(72, Math.max(0, ddx)))
  }

  function onTouchEnd() {
    clearTimer()
    if (touch.current.swiping && dx >= 56) { haptic(10); onReply(m) }
    setDx(0)
    touch.current.active = false
    touch.current.swiping = false
  }

  function handleTap() {
    const now = Date.now()
    if (now - lastTap.current < 300) { lastTap.current = 0; haptic(8); onReact(m.id, '❤️') } else lastTap.current = now
  }

  if (deleted) {
    return (
      <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
        <div className="max-w-[75%] rounded-2xl px-4 py-2 text-xs italic text-gray-400 border border-gray-100 bg-white/70">
          <span className="inline-flex items-center gap-1.5"><Ban size={13} className="shrink-0" />This message was deleted</span>
          <span className="block text-right text-[10px] mt-0.5 not-italic opacity-70">{timeLabel(m.created_at)}</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative flex ${isMine ? 'justify-end' : 'justify-start'}`}>
      <span className="absolute left-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white shadow flex items-center justify-center" style={{ opacity: Math.min(1, dx / 56), transform: `translateY(-50%) scale(${0.6 + Math.min(1, dx / 56) * 0.4})` }}>
        <CornerUpLeft size={16} className="text-brand-purple" />
      </span>
      <div
        className="max-w-[78%]"
        style={{ transform: `translateX(${dx}px)`, transition: dx ? 'none' : 'transform 180ms ease', WebkitTouchCallout: 'none' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onContextMenu={(e) => { e.preventDefault(); onOpenMenu(m) }}
      >
        <div
          onClick={handleTap}
          style={tailStyle}
          className={`chat-bubble ${visual ? 'p-1.5' : 'px-3.5 py-2'} ${isMine ? 'mine bg-brand-purple text-white' : 'theirs bg-gray-100 text-brand-navy'} ${isCurrentMatch ? 'ring-2 ring-amber-400' : ''} ${flash ? 'ring-2 ring-brand-purple/70' : ''}`}
        >
          {repliedTo ? (
            <button
              onClick={(e) => { e.stopPropagation(); onJumpTo(repliedTo.id) }}
              className={`flex w-full text-left mb-1.5 rounded-lg overflow-hidden ${isMine ? 'bg-white/15' : 'bg-black/5'}`}
            >
              <span className={`w-1 shrink-0 ${isMine ? 'bg-white/70' : 'bg-brand-purple'}`} />
              <span className="min-w-0 flex-1 px-2 py-1">
                <span className={`block text-[11px] font-bold ${isMine ? 'text-white' : 'text-brand-purple'}`}>{repliedTo.sender_id === currentUserId ? 'You' : partnerName}</span>
                <span className="block text-xs opacity-85 truncate">{previewText(repliedTo)}</span>
              </span>
              {repliedTo.media_type === 'image' && repliedTo.media_url ? <img src={repliedTo.media_url} alt="" className="w-11 h-11 object-cover shrink-0" /> : null}
            </button>
          ) : null}
          {m.media_type === 'audio' && m.media_url ? <VoicePlayer url={m.media_url} mine={isMine} /> : null}
          {m.media_type === 'image' && m.media_url ? <ChatImage url={m.media_url} autoDownloadMedia={autoDownloadMedia} onOpen={onOpenImage} /> : null}
          {m.media_type === 'video' && m.media_url ? (
            <video src={m.media_url} controls playsInline preload="metadata" onClick={(e) => e.stopPropagation()} className="rounded-xl w-64 max-w-full max-h-72 bg-black" />
          ) : null}
          {m.media_type === 'file' && m.media_url ? (
            <a href={m.media_url} target="_blank" rel="noreferrer" download={m.content || undefined} onClick={(e) => e.stopPropagation()} className="flex items-center gap-3 w-56 max-w-full">
              <span className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isMine ? 'bg-white/20' : 'bg-white'}`}><FileText size={20} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm truncate">{m.content || 'Shared file'}</span>
                <span className="block text-[10px] opacity-70 uppercase">{fileExt(m.content)}</span>
              </span>
              <Download size={16} className="shrink-0 opacity-80" />
            </a>
          ) : null}
          {m.content && m.media_type !== 'file' ? <p className={`whitespace-pre-wrap break-words ${visual ? 'px-2 pt-1' : ''}`}>{renderContent(m.content, highlightQuery)}</p> : null}
          <span className={`flex items-center justify-end gap-1 mt-0.5 text-[10px] opacity-70 ${visual ? 'px-2 pb-0.5' : ''}`}>
            {isStarred ? <Star size={10} className="fill-current" /> : null}
            {m.edited_at ? <span>edited</span> : null}
            <span>{timeLabel(m.created_at)}</span>
            {isMine ? (m.read ? <CheckCheck size={14} className="text-sky-300" /> : <Check size={14} className="opacity-80" />) : null}
          </span>
        </div>

        {groups.length > 0 ? (
          <div className={`flex gap-1 -mt-2 px-2 relative ${isMine ? 'justify-end' : 'justify-start'}`}>
            {groups.map((g) => (
              <button
                key={g.emoji}
                onClick={(e) => { e.stopPropagation(); if (g.mine) onRemoveReaction(m.id) }}
                className={`text-xs rounded-full px-1.5 py-0.5 bg-white shadow-sm border ${g.mine ? 'border-brand-purple' : 'border-gray-100'}`}
              >
                {g.emoji}{g.count > 1 ? <span className="ml-0.5 text-[10px] text-gray-500">{g.count}</span> : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

// The menu that opens when you press and hold a message.
function MessageSheet({ m, isMine, isStarred, reactions, currentUserId, onClose, onReact, onRemoveReaction, onReply, onStar, onForward, onEdit, onDelete }) {
  const [more, setMore] = useState(false)
  const [info, setInfo] = useState(false)
  if (!m) return null
  const canEdit = isMine && !m.deleted_at && m.content && !m.media_type && Date.now() - new Date(m.created_at).getTime() < EDIT_WINDOW_MS
  const myEmoji = (reactions[m.id] ?? []).find((r) => r.user_id === currentUserId)?.emoji
  const canCopy = !!m.content && m.media_type !== 'file'

  function run(fn) {
    onClose()
    fn()
  }

  function pick(emoji) {
    if (myEmoji === emoji) onRemoveReaction(m.id)
    else onReact(m.id, emoji)
    onClose()
  }

  const actions = [
    { label: 'Reply', icon: CornerUpLeft, fn: () => onReply(m) },
    ...(canCopy ? [{ label: 'Copy', icon: Copy, fn: () => navigator.clipboard?.writeText(m.content) }] : []),
    { label: 'Forward', icon: Forward, fn: () => onForward(m) },
    { label: isStarred ? 'Remove star' : 'Star', icon: Star, fn: () => onStar(m.id, isStarred) },
    ...(canEdit ? [{ label: 'Edit', icon: Pencil, fn: () => onEdit(m) }] : []),
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[520px] bg-white rounded-t-3xl px-4 pt-3 pb-6 max-h-[85dvh] overflow-y-auto">
        <span className="block w-10 h-1.5 rounded-full bg-gray-200 mx-auto mb-3" />

        <div className="flex items-center justify-between bg-gray-50 rounded-full px-3 py-1.5">
          {QUICK_REACTIONS.map((emoji) => (
            <button key={emoji} onClick={() => pick(emoji)} className={`w-10 h-10 rounded-full text-[22px] flex items-center justify-center ${myEmoji === emoji ? 'bg-brand-light' : ''}`}>{emoji}</button>
          ))}
          <button onClick={() => setMore((v) => !v)} aria-label="More reactions" className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center"><Plus size={16} className="text-gray-500" /></button>
        </div>
        {more ? (
          <div className="mt-2 max-h-40 overflow-y-auto grid grid-cols-8 gap-1">
            {ALL_EMOJIS.map((emoji, i) => (
              <button key={`${emoji}-${i}`} onClick={() => pick(emoji)} className="text-2xl leading-none p-1.5 rounded-lg active:bg-gray-100">{emoji}</button>
            ))}
          </div>
        ) : null}

        <div className="mt-3 rounded-2xl border border-gray-100 divide-y divide-gray-100">
          {actions.map(({ label, icon: Icon, fn }) => (
            <button key={label} onClick={() => run(fn)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left">
              <Icon size={19} className="text-gray-500" /> <span className="text-[15px] text-brand-navy">{label}</span>
            </button>
          ))}
          <button onClick={() => setInfo((v) => !v)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left">
            <Info size={19} className="text-gray-500" /> <span className="text-[15px] text-brand-navy">Message info</span>
          </button>
          {info ? (
            <div className="px-4 py-3 bg-gray-50 text-sm text-gray-600 space-y-1">
              <p>Sent: {fullStamp(m.created_at)}</p>
              {isMine ? <p>{m.read ? 'Seen by them' : 'Delivered, not seen yet'}</p> : null}
              {m.edited_at ? <p>Edited: {fullStamp(m.edited_at)}</p> : null}
            </div>
          ) : null}
          {isMine ? (
            <button
              onClick={() => { if (window.confirm('Delete this message for everyone?')) run(() => onDelete(m.id)) }}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
            >
              <Trash2 size={19} className="text-red-500" /> <span className="text-[15px] text-red-500">Delete for everyone</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
    }

export default function ChatThread() {
  const { userId: partnerId } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const isOnline = useIsOnline(partnerId)
  const galleryInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const docInputRef = useRef(null)
  const recordStartRef = useRef(0)

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
  const [pending, setPending] = useState([])
  const [previewItems, setPreviewItems] = useState(null)
  const [showAttach, setShowAttach] = useState(false)
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
  const [menuMsg, setMenuMsg] = useState(null)
  const [flashId, setFlashId] = useState(null)
  const [dividerId, setDividerId] = useState(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const inputRef = useRef(null)
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
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setFlashId(messageId)
      setTimeout(() => setFlashId(null), 1400)
    }
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
      const unreadEl = dividerId ? messageRefs.current[dividerId] : null
      if (unreadEl) unreadEl.scrollIntoView({ behavior: 'auto', block: 'start' })
      else bottomRef.current?.scrollIntoView({ behavior: 'auto' })
    } else if (stickToBottomRef.current || last?.sender_id === user?.id) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // A new "sending" bubble appeared: keep it in view.
  useEffect(() => {
    if (pending.length > 0) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [pending.length])

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

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(120, el.scrollHeight)}px`
  }, [text])

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
    setDividerId(null)
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
    const firstUnread = active.find((m) => m.receiver_id === user.id && !m.read)
    setDividerId(firstUnread ? firstUnread.id : null)
    setUnreadCount(active.filter((m) => m.receiver_id === user.id && !m.read).length)
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

  async function sendQuick(words) {
    if (isBlocked) return
    const { error } = await sendRow({ sender_id: user.id, receiver_id: partnerId, content: words, expire_at: computeExpiry() })
    if (error) setSendError('Message not sent. Check your connection and try again.')
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
