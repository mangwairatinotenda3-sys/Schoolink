import { useEffect, useState } from 'react'
import { Pin } from 'lucide-react'

export function previewOf(m) {
  if (!m) return ''
  if (m.removed_at) return 'Message removed'
  if (m.media_type === 'image') return m.content ? `Photo · ${m.content}` : 'Photo'
  if (m.media_type === 'video') return 'Video'
  if (m.media_type === 'file') return `File · ${m.content || 'document'}`
  return m.content || ''
}

// The strip under the header with pinned messages. Tap to jump to one; with several pins, each tap shows the next.
export default function CommunityPinned({ pinned, onJump }) {
  const [i, setI] = useState(0)
  useEffect(() => { if (i >= pinned.length) setI(0) }, [pinned.length])
  if (!pinned.length) return null
  const m = pinned[Math.min(i, pinned.length - 1)]

  return (
    <button
      onClick={() => { onJump(m); setI((i + 1) % pinned.length) }}
      className="w-full flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-100 text-left active:bg-gray-50"
    >
      <span className="flex flex-col gap-0.5 shrink-0" aria-hidden>
        {pinned.map((p, k) => <span key={p.id} className={`block w-[3px] rounded-full ${pinned.length > 1 ? 'h-3' : 'h-7'} ${k === Math.min(i, pinned.length - 1) ? 'bg-brand-purple' : 'bg-gray-200'}`} />)}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[11px] font-semibold text-brand-purple">Pinned message{pinned.length > 1 ? ` ${Math.min(i, pinned.length - 1) + 1} of ${pinned.length}` : ''}</span>
        <span className="block text-sm text-gray-600 truncate">{previewOf(m)}</span>
      </span>
      <Pin size={16} className="text-gray-400 shrink-0" />
    </button>
  )
}
