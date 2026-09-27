import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { X, Trash2, Flag, Eye, Pause } from 'lucide-react'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

function timeAgo(dateString) {
  const s = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return `${h}h ago`
}

export default function StatusViewer() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [statuses, setStatuses] = useState([])
  const [person, setPerson] = useState(null)
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState(0)
  const [paused, setPaused] = useState(false)
  const [viewers, setViewers] = useState([])
  const [showViewers, setShowViewers] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => { loadStatuses() }, [userId])

  // Auto progress
  useEffect(() => {
    if (paused || showViewers) return
    timerRef.current = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          if (index < statuses.length - 1) {
            setIndex(i => i + 1)
            return 0
          } else {
            navigate('/home')
            return 100
          }
        }
        return p + 0.8
      })
    }, 50)
    return () => clearInterval(timerRef.current)
  }, [index, paused, showViewers])

  useEffect(() => { setProgress(0) }, [index])

  // Log view + check audience
  useEffect(() => {
    if (!statuses[index]) return
    const current = statuses[index]

    // Audience check
    if (current.audience!== 'public') {
      if (!profile?.school_id || profile.school_id!== current.school_id) {
        // if school_only, block
        if (current.audience === 'school_only' && profile?.school_id!== current.school_id) {
          navigate('/home'); return
        }
        if (current.audience === 'staff_only' &&!['headteacher','deputy_head','teacher','bursar','coach','librarian','ict_admin'].includes(profile?.role)) {
          navigate('/home'); return
        }
      }
    }

    supabase.from('status_views').upsert({
      status_id: current.id,
      viewer_id: user.id
    }, { onConflict: 'status_id,viewer_id' })

    // Load viewers if owner
    if (current.user_id === user.id) {
      supabase.from('status_views')
       .select('viewer_id, viewed_at, profiles!inner(full_name, role)')
       .eq('status_id', current.id)
       .then(({ data }) => setViewers(data || []))
    }
  }, [index, statuses])

  async function loadStatuses() {
    setLoading(true)
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data: muted } = await supabase.from('status_mutes').select('muted_id').eq('muter_id', user.id)
    const mutedIds = muted?.map(m => m.muted_id) || []
    if (mutedIds.includes(userId)) { navigate('/home'); return }

    const { data } = await supabase.from('statuses')
     .select('*')
     .eq('user_id', userId)
     .gt('created_at', cutoff)
     .order('created_at', { ascending: true })
    setStatuses(data?? [])

    const { data: profileData } = await supabase.from('profiles')
     .select('full_name, avatar_url, role, school_id')
     .eq('id', userId).maybeSingle()
    setPerson(profileData)
    setLoading(false)
  }

  async function handleDelete(statusId) {
    const reason = window.prompt('Delete reason? (optional for audit)')
    await supabase.from('statuses').delete().eq('id', statusId)
    const next = statuses.filter(s => s.id!== statusId)
    if (!next.length) { navigate('/home'); return }
    setStatuses(next)
    setIndex(i => Math.min(i, next.length - 1))
  }

  async function handleReport() {
    const reason = window.prompt('Report reason:')
    if (!reason) return
    await supabase.from('status_reports').insert({
      status_id: statuses[index].id,
      reporter_id: user.id,
      reason
    })
    alert('Reported to school admin.')
  }

  async function handleMute() {
    await supabase.from('status_mutes').insert({ muter_id: user.id, muted_id: userId })
    navigate('/home')
  }

  const current = statuses[index]
  const canModerate = ['headteacher','deputy_head'].includes(profile?.role) && person?.school_id === profile?.school_id
  const isOwner = current?.user_id === user.id

  if (loading) return <div className="app-shell bg-black flex-1 flex items-center justify-center text-white/60">Loading…</div>
  if (!current) return <div className="app-shell bg-black flex-1 flex flex-col items-center justify-center text-white/60 gap-3"><p>No active updates.</p><button onClick={() => navigate('/home')} className="text-brand-purple">Go back</button></div>

  return (
    <div className="app-shell bg-black text-white select-none"
      onMouseDown={() => setPaused(true)}
      onMouseUp={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
    >
      {/* Progress bars */}
      <div className="flex gap-1 px-3 pt-3">
        {statuses.map((s, i) => (
          <div key={s.id} className="flex-1 h-1 rounded-full bg-white/30 overflow-hidden">
            <div className="h-full bg-white transition-all" style={{ width: i < index? '100%' : i === index? `${progress}%` : '0%' }} />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          {person?.avatar_url? <img src={person.avatar_url} className="w-9 h-9 rounded-full object-cover" /> : <span className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">🙂</span>}
          <div>
            <p className="text-sm font-medium flex items-center gap-2">
              {person?.full_name}
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 uppercase">{person?.role}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${current.audience === 'public'? 'bg-green-500/20 text-green-300' : 'bg-amber-500/20 text-amber-300'}`}>
                {current.audience === 'public'? 'Public' : current.audience === 'school_only'? 'School Only' : 'Staff Only'}
              </span>
            </p>
            <p className="text-xs text-white/50">{timeAgo(current.created_at)} • Expires in {Math.max(0, 24 - Math.floor((Date.now() - new Date(current.created_at))/3600000))}h</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isOwner && <button onClick={() => setShowViewers(!showViewers)} className="flex items-center gap-1 text-xs"><Eye size={16}/> {viewers.length}</button>}
          {isOwner || canModerate? <button onClick={() => handleDelete(current.id)}><Trash2 size={18} className="text-white/70" /></button> : null}
          {!isOwner && <button onClick={handleReport}><Flag size={18} className="text-white/70" /></button>}
          <button onClick={() => navigate('/home')}><X size={22} /></button>
        </div>
      </div>

      {/* Image with tap zones */}
      <div className="flex-1 relative flex items-center justify-center px-6">
        <div className="absolute inset-0 flex z-10">
          <div className="flex-1" onClick={() => setIndex(i => Math.max(0, i - 1))} />
          <div className="flex-[2]" onClick={() => setIndex(i => i < statuses.length - 1? i + 1 : i)} />
        </div>
        {current.image_url && <img src={current.image_url} alt="" className="max-w-full max-h-[60vh] rounded-lg object-contain z-0" />}
        {paused && <Pause className="absolute z-20 opacity-50" />}
      </div>

      {current.content && <p className="text-center px-6 pb-6 text-lg z-20">{current.content}</p>}

      {/* Viewers Sheet */}
      {showViewers && (
        <div className="absolute bottom-0 left-0 right-0 bg-zinc-900 rounded-t-2xl p-4 max-h-[40vh] overflow-y-auto z-30">
          <div className="flex justify-between items-center mb-3"><p className="font-medium">Viewed by {viewers.length}</p><button onClick={() => setShowViewers(false)}><X size={18}/></button></div>
          {viewers.map(v => <div key={v.viewer_id} className="flex justify-between py-2 text-sm"><span>{v.profiles.full_name} • {v.profiles.role}</span><span className="text-white/50">{timeAgo(v.viewed_at)}</span></div>)}
        </div>
      )}

      {/* Footer actions for non-owner */}
      {!isOwner && <div className="p-3 flex justify-between text-xs text-white/50"><button onClick={handleMute}>Mute updates</button><button onClick={() => navigate(`/chat/${userId}`)}>Reply in chat</button></div>}
    </div>
  )
    }
