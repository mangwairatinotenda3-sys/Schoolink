import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabaseClient.js'

export default function CommunityMessageBubble({ message, isMine, onDeleted }) {
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

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} ${deleting ? 'opacity-40' : ''}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm relative ${
          isMine ? 'bg-brand-purple text-white rounded-br-sm' : 'bg-gray-100 text-brand-navy rounded-bl-sm'
        }`}
        onClick={() => isMine && setMenuOpen((m) => !m)}
      >
        {!isMine ? <p className="text-xs font-semibold mb-0.5 opacity-80">{message.sender_name}</p> : null}

        {message.media_url && message.media_type === 'image' ? (
          <img src={message.media_url} alt="" className="rounded-lg mb-1 max-h-64 object-cover" />
        ) : null}
        {message.media_url && message.media_type === 'video' ? (
          <video src={message.media_url} controls className="rounded-lg mb-1 max-h-64 w-full" />
        ) : null}

        {message.content ? <p>{message.content}</p> : null}

        {menuOpen ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleDelete()
            }}
            className="absolute -top-3 right-0 bg-white text-red-500 rounded-full p-1.5 shadow"
          >
            <Trash2 size={13} />
          </button>
        ) : null}
      </div>
    </div>
  )
    }
