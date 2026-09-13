import { useState } from 'react'
import { Trash2, Forward, Copy, FileText } from 'lucide-react'
import { supabase } from '../lib/supabaseClient.js'

export default function CommunityMessageBubble({ message, isMine, onDeleted, onForward }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setMenuOpen(false)
    if (!window.confirm('Delete this message?')) return
    setDeleting(true)
    const { error } = await supabase.from('community_messages').delete().eq('id', message.id)
    if (!error) onDeleted(message.id)
    setDeleting(false)
  }

  function handleCopy() {
    setMenuOpen(false)
    if (message.content) navigator.clipboard?.writeText(message.content)
  }

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} ${deleting ? 'opacity-40' : ''}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm relative ${isMine ? 'bg-brand-purple text-white rounded-br-sm' : 'bg-gray-100 text-brand-navy rounded-bl-sm'}`}
        onClick={() => setMenuOpen((m) => !m)}
      >
        {!isMine ? <p className="text-xs font-semibold mb-0.5 opacity-80">{message.sender_name}</p> : null}

        {message.media_url && message.media_type === 'image' ? <img src={message.media_url} alt="" className="rounded-lg mb-1 max-h-64 object-cover" /> : null}
        {message.media_url && message.media_type === 'video' ? <video src={message.media_url} controls className="rounded-lg mb-1 max-h-64 w-full" /> : null}
        {message.media_url && message.media_type === 'file' ? (
          <a href={message.media_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 mb-1" onClick={(e) => e.stopPropagation()}>
            <FileText size={16} /> <span className="underline">{message.content || 'Shared file'}</span>
          </a>
        ) : null}

        {message.content && message.media_type !== 'file' ? <p>{message.content}</p> : null}

        {menuOpen ? (
          <div className="absolute -top-3 right-0 bg-white text-gray-600 rounded-full shadow flex items-center gap-1 px-2 py-1">
            {message.content ? (
              <button onClick={(e) => { e.stopPropagation(); handleCopy() }}><Copy size={13} /></button>
            ) : null}
            <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onForward(message) }}><Forward size={13} /></button>
            {isMine ? <button onClick={(e) => { e.stopPropagation(); handleDelete() }} className="text-red-500"><Trash2 size={13} /></button> : null}
          </div>
        ) : null}
      </div>
    </div>
  )
        }
