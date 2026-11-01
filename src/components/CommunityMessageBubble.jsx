import { FileText, Pin, Clock, Ban, Star } from 'lucide-react'
import { previewOf } from './CommunityPinned.jsx'

const NAME_COLORS = ['#7C3AED', '#0EA5E9', '#16A34A', '#EA580C', '#DB2777', '#0D9488', '#CA8A04', '#4F46E5']

export function colorOf(id) {
  const s = String(id || '')
  let h = 0
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return NAME_COLORS[h % NAME_COLORS.length]
}

function timeOf(iso) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

// Regex that finds "@Name" for every member name, longest names first, so "@Ana Moyo" matches as one
export function mentionPattern(names) {
  const list = [...new Set(names.map((n) => (n || '').trim()).filter(Boolean))].sort((a, b) => b.length - a.length)
  if (!list.length) return null
  return new RegExp(`@(${list.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'i')
}

function Rich({ text, pattern, isMine }) {
  if (!pattern || !text) return text
  return text.split(pattern).map((part, i) => (i % 2 === 1
    ? <span key={i} className={`font-semibold rounded px-0.5 ${isMine ? 'bg-white/20' : 'bg-brand-light text-brand-purple'}`}>@{part}</span>
    : <span key={i}>{part}</span>))
}

export default function CommunityMessageBubble({
  message, meId, isMine, senderIsAdmin, showName, highlight, onOpen,
  replyTo = null, reactions = [], starred = false, pattern = null, onJump,
}) {
  if (message.kind === 'system') {
    return (
      <div className="flex justify-center my-1">
        <span className="text-[12px] text-gray-500 bg-gray-100 rounded-full px-3 py-1 text-center max-w-[88%]">{message.content}</span>
      </div>
    )
  }

  if (message.removed_at || message.deleted_at) {
    return (
      <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
        <div className="max-w-[80%] rounded-2xl px-3.5 py-2 text-[13px] italic text-gray-400 bg-gray-50 border border-gray-100 flex items-center gap-1.5">
          <Ban size={13} />
          {message.removed_at ? 'This message was removed by an admin' : 'This message was deleted'}
        </div>
      </div>
    )
  }

  const pending = message.status === 'pending'
  const replyName = replyTo && (replyTo.sender_id === meId ? 'You' : replyTo.sender_name || 'Member')

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onOpen(message)}
        onKeyDown={(e) => { if (e.key === 'Enter') onOpen(message) }}
        className={`max-w-[80%] text-left cursor-pointer chat-bubble chat-bubble-lg px-3 py-2 transition-shadow ${isMine ? 'mine bg-brand-purple text-white' : 'theirs bg-gray-100 text-gray-900'} ${pending ? 'opacity-70' : ''} ${highlight ? 'ring-2 ring-amber-400' : ''}`}
      >
        {!isMine && showName ? (
          <span className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[13px] font-semibold truncate" style={{ color: colorOf(message.sender_id) }}>{message.sender_name || 'Member'}</span>
            {senderIsAdmin ? <span className="text-[10px] font-semibold text-brand-purple bg-brand-light rounded-full px-1.5 py-px shrink-0">Admin</span> : null}
          </span>
        ) : null}

        {replyTo ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); if (!replyTo.missing) onJump?.(replyTo.id) }}
            className={`block w-full text-left rounded-lg border-l-4 px-2.5 py-1.5 mb-1.5 ${isMine ? 'bg-white/15' : 'bg-black/5'}`}
            style={{ borderColor: isMine ? '#ffffff' : colorOf(replyTo.sender_id) }}
          >
            <span className="block text-[12px] font-semibold truncate" style={{ color: isMine ? '#ffffff' : colorOf(replyTo.sender_id) }}>
              {replyTo.missing ? 'Message' : replyName}
            </span>
            <span className={`block text-[12.5px] truncate ${isMine ? 'text-white/85' : 'text-gray-600'}`}>
              {replyTo.missing ? 'Original message is not available' : previewOf(replyTo)}
            </span>
          </button>
        ) : null}

        {message.media_url && message.media_type === 'image' ? <img src={message.media_url} alt="" className="rounded-xl mb-1 max-h-64 w-full object-cover" /> : null}
        {message.media_url && message.media_type === 'video' ? <video src={message.media_url} controls onClick={(e) => e.stopPropagation()} className="rounded-xl mb-1 max-h-64 w-full" /> : null}
        {message.media_url && message.media_type === 'file' ? (
          <a href={message.media_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="flex items-center gap-2 mb-1">
            <FileText size={18} /> <span className="underline break-all">{message.content || 'Shared file'}</span>
          </a>
        ) : null}

        {message.content && message.media_type !== 'file' ? (
          <span className="block whitespace-pre-wrap break-words"><Rich text={message.content} pattern={pattern} isMine={isMine} /></span>
        ) : null}

        {reactions.length ? (
          <span className="flex flex-wrap gap-1 mt-1">
            {reactions.map((r) => (
              <span key={r.emoji} className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[12px] border text-gray-800 ${r.mine ? 'border-brand-purple bg-brand-light' : 'border-gray-200 bg-white'}`}>
                {r.emoji}{r.count > 1 ? <span className="text-[11px] text-gray-500">{r.count}</span> : null}
              </span>
            ))}
          </span>
        ) : null}

        <span className={`flex items-center justify-end gap-1 text-[10px] mt-0.5 ${isMine ? 'text-white/70' : 'text-gray-400'}`}>
          {starred ? <Star size={10} fill="currentColor" /> : null}
          {message.pinned_at ? <Pin size={10} /> : null}
          {pending ? <Clock size={10} /> : null}
          {message.edited_at ? <span>edited</span> : null}
          {timeOf(message.created_at)}
        </span>
      </div>
    </div>
  )
  }
