import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { X, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

function timeAgo(dateString) {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
  const hours = Math.floor(seconds / 3600)
  if (hours < 1) return `${Math.floor(seconds / 60)}m ago`
  return `${hours}h ago`
}

export default function StatusViewer() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [statuses, setStatuses] = useState([])
  const [person, setPerson] = useState(null)
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStatuses()
  }, [userId])

  async function loadStatuses() {
    setLoading(true)
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data } = await supabase
      .from('statuses')
      .select('*')
      .eq('user_id', userId)
      .gt('created_at', cutoff)
      .order('created_at', { ascending: true })
    setStatuses(data ?? [])

    const { data: profileData } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', userId)
      .maybeSingle()
    setPerson(profileData)
    setLoading(false)
  }

  async function handleDelete(statusId) {
    if (!window.confirm('Delete this update?')) return
    await supabase.from('statuses').delete().eq('id', statusId)
    const next = statuses.filter((s) => s.id !== statusId)
    if (next.length === 0) {
      navigate('/home')
      return
    }
    setStatuses(next)
    setIndex((i) => Math.min(i, next.length - 1))
  }

  const current = statuses[index]

  if (loading) {
    return (
      <div className="app-shell bg-black">
        <div className="flex-1 flex items-center justify-center text-white/60">Loading…</div>
      </div>
    )
  }

  if (!current) {
    return (
      <div className="app-shell bg-black">
        <div className="flex-1 flex flex-col items-center justify-center text-white/60 gap-3">
          <p>No active updates.</p>
          <button onClick={() => navigate('/home')} className="text-brand-purple">Go back</button>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell bg-black text-white">
      <div className="flex gap-1 px-3 pt-3">
        {statuses.map((s, i) => (
          <div key={s.id} className="flex-1 h-1 rounded-full bg-white/30 overflow-hidden">
            <div className={`h-full bg-white ${i <= index ? 'w-full' : 'w-0'}`} />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          {person?.avatar_url ? (
            <img src={person.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
          ) : (
            <span className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">🙂</span>
          )}
          <div>
            <p className="text-sm font-medium">{person?.full_name || 'Schoolink member'}</p>
            <p className="text-xs text-white/50">{timeAgo(current.created_at)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {current.user_id === user.id ? (
            <button onClick={() => handleDelete(current.id)}>
              <Trash2 size={18} className="text-white/70" />
            </button>
          ) : null}
          <button onClick={() => navigate('/home')}>
            <X size={22} />
          </button>
        </div>
      </div>

      <div
        className="flex-1 flex items-center justify-center px-6"
        onClick={() => setIndex((i) => (i < statuses.length - 1 ? i + 1 : i))}
      >
        {current.image_url ? (
          <img src={current.image_url} alt="" className="max-w-full max-h-[60vh] rounded-lg object-contain" />
        ) : null}
      </div>

      {current.content ? <p className="text-center px-6 pb-8 text-lg">{current.content}</p> : null}
    </div>
  )
}
