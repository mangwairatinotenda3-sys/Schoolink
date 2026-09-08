import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function StatusRow() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [people, setPeople] = useState([])
  const [hasMyStatus, setHasMyStatus] = useState(false)

  useEffect(() => {
    if (!user) return
    loadStatuses()
  }, [user])

  async function loadStatuses() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data } = await supabase
      .from('statuses')
      .select('user_id, created_at')
      .gt('created_at', cutoff)
      .order('created_at', { ascending: false })

    const seen = new Set()
    const uniqueUserIds = []
    for (const row of data ?? []) {
      if (!seen.has(row.user_id)) {
        seen.add(row.user_id)
        uniqueUserIds.push(row.user_id)
      }
    }
    setHasMyStatus(seen.has(user.id))

    const otherIds = uniqueUserIds.filter((id) => id !== user.id)
    if (otherIds.length === 0) {
      setPeople([])
      return
    }
    const { data: profiles } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', otherIds)
    setPeople(profiles ?? [])
  }

  return (
    <div className="flex gap-4 px-4 py-3 overflow-x-auto border-b border-gray-100">
      <button onClick={() => navigate(hasMyStatus ? `/statuses/${user.id}` : '/statuses/create')} className="flex flex-col items-center gap-1 shrink-0">
        <span className="relative">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className={`w-12 h-12 rounded-full object-cover ${hasMyStatus ? 'ring-2 ring-brand-purple' : ''}`} />
          ) : (
            <span className="w-12 h-12 rounded-full bg-brand-light flex items-center justify-center text-lg">🙂</span>
          )}
          {!hasMyStatus ? (
            <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-brand-purple flex items-center justify-center border-2 border-white">
              <Plus size={9} className="text-white" />
            </span>
          ) : null}
        </span>
        <span className="text-[10px] text-gray-500">My Status</span>
      </button>

      {people.map((p) => (
        <button key={p.id} onClick={() => navigate(`/statuses/${p.id}`)} className="flex flex-col items-center gap-1 shrink-0">
          {p.avatar_url ? (
            <img src={p.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover ring-2 ring-brand-purple" />
          ) : (
            <span className="w-12 h-12 rounded-full bg-brand-light flex items-center justify-center text-lg ring-2 ring-brand-purple">🙂</span>
          )}
          <span className="text-[10px] text-gray-500 max-w-[52px] truncate">{p.full_name?.split(' ')[0] || 'Member'}</span>
        </button>
      ))}
    </div>
  )
}
