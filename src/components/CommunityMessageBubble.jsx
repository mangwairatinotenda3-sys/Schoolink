import { FileText, Pin, Clock, Ban } from 'lucide-react'

const NAME_COLORS = ['#7C3AED', '#0EA5E9', '#16A34A', '#EA580C', '#DB2777', '#0D9488', '#CA8A04', '#4F46E5']

function colorOf(id) {
  const s = String(id || '')
  let h = 0
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return NAME_COLORS[h % NAME_COLORS.length]
}

function timeOf(iso) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

// One message in a community chat. Tapping it opens the actions for that message.
export default function CommunityMessageBubble({ message, isMine, senderIsAdmin, showName, highlight, onOpen }) {
  const removed = !!message.removed_at
  const pending = message.status === 'pending'

  if (removed) {
    return (
      <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
        <div className="max-w-[80%] rounded-2xl px-3.5 py-2 text-[13px] italic text-gray-400 bg-gray-50 border border-gray-100 flex items-center gap-1.5">
          <Ban size={13} /> This message was removed by an admin
        </div>
      </div>
    )
  }

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onOpen(message)}
        onKeyDown={(e) => { if (e.key === 'Enter') onOpen(message) }}
        className={`max-w-[80%] text-left cursor-pointer rounded-2xl px-3 py-2 text-[15px] transition-shadow ${isMine ? 'bg-brand-purple text-white rounded-br-md' : 'bg-gray-100 text-gray-900 rounded-bl-md'} ${pending ? 'opacity-70' : ''} ${highlight ? 'ring-2 ring-amber-400' : ''}`}
      >
        {!isMine && showName ? (
          <span className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[13px] font-semibold truncate" style={{ color: colorOf(message.sender_id) }}>{message.sender_name || 'Member'}</span>
            {senderIsAdmin ? <span className="text-[10px] font-semibold text-brand-purple bg-brand-light rounded-full px-1.5 py-px shrink-0">Admin</span> : null}
          </span>
        ) : null}

        {message.media_url && message.media_type === 'image' ? <img src={message.media_url} alt="" className="rounded-xl mb-1 max-h-64 w-full object-cover" /> : null}
        {message.media_url && message.media_type === 'video' ? <video src={message.media_url} controls onClick={(e) => e.stopPropagation()} className="rounded-xl mb-1 max-h-64 w-full" /> : null}
        {message.media_url && message.media_type === 'file' ? (
          <a href={message.media_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="flex items-center gap-2 mb-1">
            <FileText size={18} /> <span className="underline break-all">{message.content || 'Shared file'}</span>
          </a>
        ) : null}

        {message.content && message.media_type !== 'file' ? <span className="block whitespace-pre-wrap break-words">{message.content}</span> : null}

        <span className={`flex items-center justify-end gap-1 text-[10px] mt-0.5 ${isMine ? 'text-white/70' : 'text-gray-400'}`}>
          {message.pinned_at ? <Pin size={10} /> : null}
          {pending ? <Clock size={10} /> : null}
          {timeOf(message.created_at)}
        </span>
      </div>
    </div>
  )
    }
