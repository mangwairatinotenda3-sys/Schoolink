import { useState } from 'react'
import { X, Send, FileText, Trash2 } from 'lucide-react'

function sizeText(bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// The screen you see after choosing photos, videos or a document, before sending (like WhatsApp):
// look at it, add a caption, then send.
export default function MediaPreview({ items, onSend, onCancel }) {
  const [list, setList] = useState(items)
  const [index, setIndex] = useState(0)
  const [captions, setCaptions] = useState({})

  const safeIndex = Math.min(index, Math.max(0, list.length - 1))
  const item = list[safeIndex]
  if (!item) return null

  function removeCurrent() {
    const next = list.filter((x) => x.id !== item.id)
    if (item.url) URL.revokeObjectURL(item.url)
    if (next.length === 0) {
      onCancel()
      return
    }
    setList(next)
    setIndex(Math.max(0, safeIndex - 1))
  }

  function send() {
    onSend(list.map((x) => ({ ...x, caption: captions[x.id] || '' })))
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={onCancel} aria-label="Cancel" className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center"><X size={20} className="text-white" /></button>
        <span className="text-white/80 text-sm">{list.length > 1 ? `${safeIndex + 1} of ${list.length}` : ''}</span>
        <button onClick={removeCurrent} aria-label="Remove this one" className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center"><Trash2 size={18} className="text-white" /></button>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center px-3">
        {item.kind === 'image' ? (
          <img src={item.url} alt="" className="max-w-full max-h-full object-contain" />
        ) : item.kind === 'video' ? (
          <video src={item.url} controls playsInline className="max-w-full max-h-full" />
        ) : (
          <div className="flex flex-col items-center gap-3 text-white">
            <span className="w-24 h-24 rounded-2xl bg-white/15 flex items-center justify-center"><FileText size={44} /></span>
            <p className="text-sm font-medium text-center break-all px-6">{item.file.name}</p>
            <p className="text-xs text-white/60">{sizeText(item.file.size)}</p>
          </div>
        )}
      </div>

      {list.length > 1 ? (
        <div className="flex gap-2 px-3 py-2 overflow-x-auto">
          {list.map((x, i) => (
            <button
              key={x.id}
              onClick={() => setIndex(i)}
              className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 ${i === safeIndex ? 'border-brand-purple' : 'border-transparent opacity-70'} bg-white/10 flex items-center justify-center`}
            >
              {x.kind === 'image' ? <img src={x.url} alt="" className="w-full h-full object-cover" /> : <FileText size={20} className="text-white" />}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex items-center gap-2 px-3 py-3">
        {item.kind === 'file' ? (
          <div className="flex-1 text-white/60 text-sm px-4">Send this document</div>
        ) : (
          <input
            value={captions[item.id] || ''}
            onChange={(e) => setCaptions((c) => ({ ...c, [item.id]: e.target.value }))}
            placeholder="Add a caption…"
            className="flex-1 min-w-0 bg-white/15 text-white placeholder-white/50 rounded-full px-4 py-2.5 text-sm outline-none"
          />
        )}
        <button onClick={send} aria-label="Send" className="w-11 h-11 rounded-full bg-brand-purple flex items-center justify-center shrink-0"><Send size={18} className="text-white" /></button>
      </div>
    </div>
  )
}
