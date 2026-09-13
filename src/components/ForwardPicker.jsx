import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function ForwardPicker({ onClose, onSend }) {
  const { user } = useAuth()
  const [people, setPeople] = useState([])

  useEffect(() => {
    loadPeople()
  }, [])

  async function loadPeople() {
    const { data: followingRows } = await supabase.from('follows').select('followed_id').eq('follower_id', user.id)
    const ids = (followingRows ?? []).map((r) => r.followed_id)
    if (ids.length === 0) return
    const { data } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', ids)
    setPeople(data ?? [])
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-50" onClick={onClose}>
      <div className="bg-white rounded-t-2xl w-full max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <p className="font-semibold text-sm">Forward to…</p>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <div className="overflow-y-auto px-4 py-2">
          {people.length === 0 ? (
            <p className="text-center text-gray-400 py-6">Follow people to forward messages to them.</p>
          ) : (
            people.map((p) => (
              <button key={p.id} onClick={() => onSend(p.id)} className="w-full flex items-center gap-3 py-3 text-left border-b border-gray-50 last:border-0">
                {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" /> : <span className="w-9 h-9 rounded-full bg-brand-light flex items-center justify-center">🙂</span>}
                <p className="text-sm font-medium">{p.full_name || 'Schoolink member'}</p>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
