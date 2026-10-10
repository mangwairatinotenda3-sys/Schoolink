import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { X, Trash2, Eye, Pause } from 'lucide-react'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { canManageStaff } from '../lib/permissions.js'
import ReportButton from '../components/ReportButton.jsx'
import VerifiedBadge from '../components/VerifiedBadge.jsx'
import { backgroundFor, canViewStatus, audienceLabel, timeAgo, timeLeft } from '../lib/statusUtils.js'

const TICK_MS = 50
const STEP = 0.8 // 100 / 0.8 * 50ms = ~6 seconds per status

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
  const [reportOpen, setReportOpen] = useState(false)
  const [viewers, setViewers] = useState([])
  const [showViewers, setShowViewers] = useState(false)

  const current = statuses[index]
  const holding = paused || showViewers || reportOpen

  useEffect(() => { loadStatuses() }, [userId])

  // Progress bar ticks while nothing is holding it.
  useEffect(() => {
    if (holding || !statuses.length) return
    const id = setInterval(() => setProgress((p) => Math.min(100, p + STEP)), TICK_MS)
    return () => clearInterval(id)
  }, [holding, statuses.length, index])

  // Move on when the bar fills.
  useEffect(() => {
    if (progress < 100) return
    if (index < statuses.length - 1) setIndex((i) => i + 1)
    else navigate('/home')
  }, [progress])

  useEffect(() => { setProgress(0) }, [index])

  // Audience guard + record the view.
  useEffect(() => {
    if (!current || !profile) return
    if (!canViewStatus(current, profile, user.id)) {
      navigate('/home')
      return
    }
    if (current.user_id !== user.id) {
      supabase.from('status_views').upsert(
        { status_id: current.id, viewer_id: user.id },
        { onConflict: 'status_id,viewer_id' }
      )
    }
  }, [current?.id, profile?.school_id])

  // Owner sees who viewed each status.
  useEffect(() => {
    setViewers([])
    if (!current || current.user_id !== user.id) return
    supabase
      .from('status_views')
      .select('viewer_id, viewed_at, profiles!inner(full_name, role)')
      .eq('status_id', current.id)
      .then(({ data }) => setViewers(data || []))
  }, [current?.id])

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
    setIndex(0)

    const { data: profileData } = await supabase
      .from('profiles')
      .select('full_name, avatar_url, role, school_id')
      .eq('id', userId)
      .maybeSingle()
    setPerson(profileData)
    setLoading(false)
  }

  async function handleDelete(statusId) {
    if (!window.confirm('Delete this status update?')) return
    await supabase.from('statuses').delete().eq('id', statusId)
    const next = statuses.filter((s) => s.id !== statusId)
    if (!next.length) { navigate('/home'); return }
    setStatuses(next)
    setIndex((i) => Math.min(i, next.length - 1))
    setProgress(0)
  }

  const isOwner = current?.user_id === user.id
  const canModerate = canManageStaff(profile) && person?.school_id === profile?.school_id
  const background = backgroundFor(current?.bg_color || 'theme')

  if (loading) {
    return (
      <div className="app-shell flex-1 flex items-center justify-center text-white/70" style={{ background: backgroundFor('theme') }}>
        Loading…
      </div>
    )
  }

  if (!current) {
    return (
      <div className="app-shell flex-1 flex flex-col items-center justify-center text-white/80 gap-3" style={{ background: backgroundFor('theme') }}>
        <p>No active updates.</p>
        <button onClick={() => navigate('/home')} className="bg-white/20 rounded-full px-4 py-1.5 text-sm text-white">Go back</button>
      </div>
    )
  }

  const hasImage = !!current.image_url

  return (
    <div
      className="app-shell text-white select-none"
      style={{ background }}
      onMouseDown={() => setPaused(true)}
      onMouseUp={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
    >
      <div className="flex gap-1 px-3 pt-3 z-20">
        {statuses.map((s, i) => (
          <div key={s.id} className="flex-1 h-1 rounded-full bg-white/30 overflow-hidden">
            <div className="h-full bg-white" style={{ width: i < index ? '100%' : i === index ? `${progress}%` : '0%' }} />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between px-4 py-3 z-20 bg-gradient-to-b from-black/30 to-transparent">
        <div className="flex items-center gap-2 min-w-0">
          {person?.avatar_url ? (
            <img src={person.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
          ) : (
            <span className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">🙂</span>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium flex items-center gap-2">
              <span className="truncate">{person?.full_name}</span>
              <VerifiedBadge userId={userId} size={14} />
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/25 shrink-0">{audienceLabel(current.audience)}</span>
            </p>
            <p className="text-xs text-white/70">{timeAgo(current.created_at)} • {timeLeft(current.created_at)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {isOwner ? (
            <button onClick={() => setShowViewers(!showViewers)} className="flex items-center gap-1 text-xs">
              <Eye size={16} /> {viewers.length}
            </button>
          ) : null}
          {isOwner || canModerate ? (
            <button onClick={() => handleDelete(current.id)}><Trash2 size={18} className="text-white/80" /></button>
          ) : null}
          {!isOwner ? (
            <ReportButton
              contentType="status"
              contentId={current.id}
              size={18}
              className="text-white/80"
              onOpenChange={setReportOpen}
            />
          ) : null}
          <button onClick={() => navigate('/home')}><X size={22} /></button>
        </div>
      </div>

      <div className="flex-1 relative flex items-center justify-center px-6 min-h-0">
        <div className="absolute inset-0 flex z-10">
          <div className="flex-1" onClick={() => { setIndex((i) => Math.max(0, i - 1)); setProgress(0) }} />
          <div className="flex-[2]" onClick={() => { if (index < statuses.length - 1) setIndex((i) => i + 1); else navigate('/home') }} />
        </div>
        {hasImage ? (
          <img src={current.image_url} alt="" className="max-w-full max-h-full rounded-lg object-contain z-0" />
        ) : current.content ? (
          <p className="text-center text-2xl font-semibold leading-snug break-words z-0">{current.content}</p>
        ) : null}
        {paused ? <Pause className="absolute z-20 opacity-60" /> : null}
      </div>

      {hasImage && current.content ? (
        <p className="text-center px-6 py-5 text-lg z-20 bg-gradient-to-t from-black/40 to-transparent">{current.content}</p>
      ) : null}

      {showViewers ? (
        <div className="absolute bottom-0 left-0 right-0 bg-white text-gray-800 rounded-t-2xl p-4 max-h-[40vh] overflow-y-auto z-30 shadow-2xl"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-3">
            <p className="font-medium">Viewed by {viewers.length}</p>
            <button onClick={() => setShowViewers(false)}><X size={18} /></button>
          </div>
          {viewers.length === 0 ? <p className="text-sm text-gray-400">No views yet.</p> : null}
          {viewers.map((v) => (
            <div key={v.viewer_id} className="flex justify-between py-2 text-sm">
              <span>{v.profiles.full_name} • {v.profiles.role}</span>
              <span className="text-gray-400">{timeAgo(v.viewed_at)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
        }
