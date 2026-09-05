import { useState } from 'react'
import { Pin, Archive, BellOff, MoreVertical } from 'lucide-react'
import { supabase } from '../lib/supabaseClient.js'

export default function ChatSettingsMenu({ userId, partnerId, settings, onChange }) {
  const [open, setOpen] = useState(false)

  async function toggle(key) {
    const next = { ...settings, [key]: !settings[key] }
    onChange(next)
    setOpen(false)
    await supabase
      .from('chat_settings')
      .upsert({ user_id: userId, partner_id: partnerId, ...next })
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)}>
        <MoreVertical size={18} className="text-gray-400" />
      </button>
      {open ? (
        <div className="absolute right-0 top-8 bg-white border border-gray-100 rounded-lg shadow-lg z-10 w-40">
          <button onClick={() => toggle('pinned')} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm">
            <Pin size={14} /> {settings.pinned ? 'Unpin' : 'Pin'} chat
          </button>
          <button onClick={() => toggle('archived')} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm">
            <Archive size={14} /> {settings.archived ? 'Unarchive' : 'Archive'}
          </button>
          <button onClick={() => toggle('muted')} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm">
            <BellOff size={14} /> {settings.muted ? 'Unmute' : 'Mute'}
          </button>
        </div>
      ) : null}
    </div>
  )
    }
