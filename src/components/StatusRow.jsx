import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { canViewStatus } from '../lib/statusUtils.js'

// Unseen = ring in the site theme colour. Seen = muted grey ring.
const RING_UNSEEN = 'ring-2 ring-brand-purple ring-offset-2 ring-offset-[color:var(--shell-bg)]'
const RING_SEEN = 'ring-2 ring-[color:var(--text-muted)] ring-offset-2 ring-offset-[color:var(--shell-bg)]'

export default function StatusRow() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [people, setPeople] = useState([])
  const [hasMyStatus, setHasMyStatus] = useState(false)

  useEffect(() => {
    if (!user) return
    loadStatuses()
  }, [user?.id, profile?.school_id, profile?.role])

  async function loadStatuses() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data } = await supabase
      .from('statuses')
      .select('id, user_id, created_at, audience, school_id')
      .gt('created_at', cutoff)
      .order('created_at', { ascending: false })

    const visible = (data ?? []).filter((s) => canViewStatus(s, profile, user.id))
    setHasMyStatus(visible.some((s) => s.user_id === user.id))

    // Which of these has the current user already viewed?
    let seenIds = new Set()
    const othersStatuses = visible.filter((s) => s.user_id !== user.id)
    if (othersStatuses.length) {
      const { data: views } = await supabase
        .from('status_views')
        .select('status_id')
        .eq('viewer_id', user.id)
        .in('status_id', othersStatuses.map((s) => s.id))
      seenIds = new Set((views ?? []).map((v) => v.status_id))
    }

    // Group by person: latest time + whether everything of theirs is seen.
    const byUser = new Map()
    for (const s of othersStatuses) {
      const entry = byUser.get(s.user_id) || { id: s.user_id, latest: s.created_at, allSeen: true }
      if (!seenIds.has(s.id)) entry.allSeen = false
      if (s.created_at > entry.latest) entry.latest = s.created_at
      byUser.set(s.user_id, entry)
    }

    if (byUser.size === 0) {
      setPeople([])
      return
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', [...byUser.keys()])

    const list = (profiles ?? []).map((p) => ({ ...p, ...byUser.get(p.id) }))
    // Unseen first, then newest first.
    list.sort((a, b) => Number(a.allSeen) - Number(b.allSeen) || (a.latest < b.latest ? 1 : -1))
    setPeople(list)
  }

  return (
    <div className="flex gap-4 px-4 py-3 overflow-x-auto border-b border-gray-100">
      <div className="flex flex-col items-center gap-1 shrink-0">
        <span className="relative">
          <button onClick={() => navigate(hasMyStatus ? `/statuses/${user.id}` : '/statuses/create')}>
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className={`w-12 h-12 rounded-full object-cover ${hasMyStatus ? RING_UNSEEN : ''}`} />
            ) : (
              <span className={`w-12 h-12 rounded-full bg-brand-light flex items-center justify-center text-lg ${hasMyStatus ? RING_UNSEEN : ''}`}>🙂</span>
            )}
          </button>
          <button
            onClick={() => navigate('/statuses/create')}
            aria-label="Add status"
            className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-brand-purple flex items-center justify-center border-2 border-[color:var(--shell-bg)]"
          >
            <Plus size={10} className="text-white" />
          </button>
        </span>
        <span className="text-[10px] text-gray-500">My Status</span>
      </div>

      {people.map((p) => (
        <button key={p.id} onClick={() => navigate(`/statuses/${p.id}`)} className="flex flex-col items-center gap-1 shrink-0">
          {p.avatar_url ? (
            <img src={p.avatar_url} alt="" className={`w-12 h-12 rounded-full object-cover ${p.allSeen ? RING_SEEN : RING_UNSEEN}`} />
          ) : (
            <span className={`w-12 h-12 rounded-full bg-brand-light flex items-center justify-center text-lg ${p.allSeen ? RING_SEEN : RING_UNSEEN}`}>🙂</span>
          )}
          <span className={`text-[10px] max-w-[52px] truncate ${p.allSeen ? 'text-gray-400' : 'text-gray-600 font-medium'}`}>
            {p.full_name?.split(' ')[0] || 'Member'}
          </span>
        </button>
      ))}
    </div>
  )
  }
