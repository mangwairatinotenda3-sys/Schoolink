import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function StarredMessages() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStarred()
  }, [])

  async function loadStarred() {
    setLoading(true)
    const { data } = await supabase.from('starred_messages').select('*, messages(*)').eq('user_id', user.id).order('created_at', { ascending: false })
    setItems((data ?? []).filter((row) => row.messages))
    setLoading(false)
  }

  async function handleUnstar(messageId) {
    await supabase.from('starred_messages').delete().eq('user_id', user.id).eq('message_id', messageId)
    setItems((prev) => prev.filter((i) => i.message_id !== messageId))
  }

  return (
    <div className="app-shell">
      <BackHeader title="Starred Messages" />
      <div className="screen-scroll px-4 pt-3">
        {loading ? (
          <p className="text-center text-gray-400 mt-8">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-center text-gray-400 mt-8">No starred messages yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {items.map((row) => {
              const m = row.messages
              const partnerId = m.sender_id === user.id ? m.receiver_id : m.sender_id
              return (
                <div key={row.message_id} className="py-3">
                  <button onClick={() => navigate(`/chats/${partnerId}`)} className="text-left w-full">
                    <p className="text-sm">{m.content || (m.media_type === 'audio' ? '🎤 Voice message' : '📷 Photo')}</p>
                    <p className="text-xs text-gray-400 mt-1">{new Date(m.created_at).toLocaleString()}</p>
                  </button>
                  <button onClick={() => handleUnstar(m.id)} className="text-xs text-red-500 mt-1">Unstar</button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
