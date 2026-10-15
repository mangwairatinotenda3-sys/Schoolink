import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { X, Trash2, Eye, MoreVertical, Volume2, VolumeX, Send, BellOff, Bell, Loader2, Plus, Heart } from 'lucide-react'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { canManageStaff } from '../lib/permissions.js'
import ReportButton from '../components/ReportButton.jsx'
import VerifiedBadge from '../components/VerifiedBadge.jsx'
import { loadStatusFeed } from '../lib/statusFeed.js'
import {
  STATUS_REACTIONS, backgroundFor, fontFor, formatStatusTime, mediaOf, readingMs, statusKind, timeAgo, timeLeft, audienceLabel,
} from '../lib/statusUtils.js'

const IMAGE_MS = 6000

function Avatar({ src, name, size = 36 }) {
  return src ? (
    <img src={src} alt="" className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />
  ) : (
    <span className="rounded-full bg-white/20 flex items-center justify-center shrink-0 font-semibold" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {(name || '?').slice(0, 1).toUpperCase()}
    </span>
  )
}

export default function StatusViewer() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, profile, loading: authLoading } = useAuth()

  const [loading, setLoading] = useState(true)
  const [person, setPerson] = useState(null)
  const [items, setItems] = useState([])
  const [queue, setQueue] = useState([])
  const [index, setIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [readyId, setReadyId] = useState(null)
  const [buffering, setBuffering] = useState(false)
  const [videoMuted, setVideoMuted] = useState(false)
  const [pressing, setPressing] = useState(false)
  const [dragY, setDragY] = useState(0)
  const [sheet, setSheet] = useState(null)
  const [reportOpen, setReportOpen] = useState(false)
  const [replyFocus, setReplyFocus] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [showReactions, setShowReactions] = useState(false)
  const [myReaction, setMyReaction] = useState(null)
  const [viewers, setViewers] = useState([])
  const [reactionMap, setReactionMap] = useState({})
  const [floats, setFloats] = useState([])
  const [toast, setToast] = useState('')
  const [sending, setSending] = useState(false)

  const videoRef = useRef(null)
  const replyRef = useRef(null)
  const elapsedRef = useRef(0)
  const press = useRef({ active: false, x: 0, y: 0, timer: null, held: false, moved: false })
  const goNextRef = useRef(() => {})

  const current = items[index]
  const kind = current ? statusKind(current) : null
  const { url: mediaUrl } = current ? mediaOf(current) : { url: null }
  const isOwner = !!current && current.user_id === user?.id
  const isGuest = !!user?.is_anonymous
  const canModerate = !!person && canManageStaff(profile) && person.school_id === profile?.school_id
  const ready = kind === 'text' || (!!current && readyId === current.id)
  const paused = pressing || !!sheet || reportOpen || replyFocus || showReactions || !ready || loading

  // ---- Load this person's updates (and who is next in line) ----
  useEffect(() => {
    if (authLoading || !user) return undefined
    let cancelled = false
    async function load() {
      setLoading(true)
      setSheet(null)
      setReplyText('')
      setShowReactions(false)
      const feed = await loadStatusFeed(user, profile)
      if (cancelled) return
      let list
      let info
      let order = []
      if (userId === user.id) {
        list = feed.mine
        info = { id: user.id, full_name: profile?.full_name || 'You', avatar_url: profile?.avatar_url, role: profile?.role, school_id: profile?.school_id, muted: false }
      } else {
        const entry = feed.people.find((p) => p.id === userId)
        list = entry?.items ?? []
        info = entry || null
        order = location.state?.queue || feed.people.filter((p) => !p.muted).map((p) => p.id)
        if (!order.includes(userId)) order = [userId, ...order]
      }
      setItems(list)
      setPerson(info)
      setQueue(order)
      const firstUnseen = list.findIndex((s) => !feed.seen.has(s.id) && s.user_id !== user.id)
      setIndex(firstUnseen > 0 ? firstUnseen : 0)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [userId, authLoading, user?.id, profile?.school_id, profile?.role])

  // ---- Per-update reset ----
  useEffect(() => {
    elapsedRef.current = 0
    setProgress(0)
    setBuffering(false)
    setMyReaction(null)
    setReplyText('')
  }, [current?.id])

  // Record that you saw it (only for other people's updates).
  useEffect(() => {
    if (!current || !user || current.user_id === user.id || isGuest) return
    supabase.from('status_views').upsert({ status_id: current.id, viewer_id: user.id }, { onConflict: 'status_id,viewer_id' })
  }, [current?.id])

  // Get the next picture ready so it appears instantly.
  useEffect(() => {
    const next = items[index + 1]
    if (next && statusKind(next) === 'image') {
      const img = new Image()
      img.src = mediaOf(next).url
    }
  }, [index, items])

  // Owner: who viewed and who reacted. Viewer: what you reacted with.
  useEffect(() => {
    setViewers([])
    setReactionMap({})
    if (!current || !user) return
    if (current.user_id === user.id) {
      supabase
        .from('status_views')
        .select('viewer_id, viewed_at, profiles!inner(full_name, role, avatar_url)')
        .eq('status_id', current.id)
        .order('viewed_at', { ascending: false })
        .then(({ data }) => setViewers(data || []))
      supabase
        .from('status_reactions')
        .select('user_id, emoji')
        .eq('status_id', current.id)
        .then(({ data }) => setReactionMap(Object.fromEntries((data || []).map((r) => [r.user_id, r.emoji]))))
    } else {
      supabase
        .from('status_reactions')
        .select('emoji')
        .eq('status_id', current.id)
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => setMyReaction(data?.emoji || null))
    }
  }, [current?.id])

  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(''), 2200)
    return () => clearTimeout(t)
  }, [toast])

  // ---- Playback: photos and text count up on a timer; videos follow the video ----
  const textMs = readingMs(current?.content)
  useEffect(() => {
    if (!current || kind === 'video' || paused) return undefined
    const total = kind === 'text' ? textMs : IMAGE_MS
    let raf
    let last = performance.now()
    const tick = (now) => {
      elapsedRef.current += now - last
      last = now
      const p = Math.min(1, elapsedRef.current / total)
      setProgress(p)
      if (p >= 1) {
        goNextRef.current()
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [current?.id, kind, paused, textMs])

  useEffect(() => {
    const v = videoRef.current
    if (!v || kind !== 'video') return
    if (paused) {
      v.pause()
    } else {
      v.play().catch(() => {
        v.muted = true
        setVideoMuted(true)
        v.play().catch(() => {})
      })
    }
  }, [paused, current?.id, kind])

  // ---- Moving around ----
  function close() {
    navigate('/home', { replace: true })
  }

  function personAt(offset) {
    const i = queue.indexOf(userId)
    return i === -1 ? null : queue[i + offset] || null
  }

  function goNextPerson() {
    const next = personAt(1)
    if (next) navigate(`/statuses/${next}`, { replace: true, state: { queue } })
    else close()
  }

  function goPrevPerson() {
    const prev = personAt(-1)
    if (prev) navigate(`/statuses/${prev}`, { replace: true, state: { queue } })
  }

  function goNext() {
    if (index < items.length - 1) setIndex(index + 1)
    else goNextPerson()
  }
  goNextRef.current = goNext

  function goPrev() {
    if (index > 0) {
      setIndex(index - 1)
    } else {
      elapsedRef.current = 0
      setProgress(0)
      if (videoRef.current) videoRef.current.currentTime = 0
    }
  }

  // ---- Touch: tap sides, hold to pause, swipe down to close, swipe up for replies/views ----
  function onDown(e) {
    clearTimeout(press.current.timer)
    press.current = {
      active: true,
      x: e.clientX,
      y: e.clientY,
      held: false,
      moved: false,
      timer: setTimeout(() => {
        press.current.held = true
        setPressing(true)
      }, 220),
    }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  function onMove(e) {
    if (!press.current.active) return
    const dx = e.clientX - press.current.x
    const dy = e.clientY - press.current.y
    if (!press.current.moved && (Math.abs(dx) > 12 || Math.abs(dy) > 12)) {
      press.current.moved = true
      clearTimeout(press.current.timer)
    }
    if (press.current.moved && dy > 0 && Math.abs(dy) > Math.abs(dx)) setDragY(dy)
  }

  function onUp(e) {
    if (!press.current.active) return
    clearTimeout(press.current.timer)
    const { x, y, held, moved } = press.current
    const dx = e.clientX - x
    const dy = e.clientY - y
    setPressing(false)
    setDragY(0)
    press.current = { active: false, x: 0, y: 0, timer: null, held: false, moved: false }

    if (moved) {
      if (Math.abs(dy) > Math.abs(dx)) {
        if (dy > 110) close()
        else if (dy < -70) {
          if (isOwner) setSheet('viewers')
          else if (!isGuest) replyRef.current?.focus()
        }
      } else if (dx < -80) goNextPerson()
      else if (dx > 80) goPrevPerson()
      return
    }
    if (held) return
    if (replyFocus || showReactions) {
      replyRef.current?.blur()
      setShowReactions(false)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    if ((e.clientX - rect.left) / rect.width < 0.3) goPrev()
    else goNext()
    }

  const stop = (e) => e.stopPropagation()

  // ---- Actions ----
  async function handleDelete() {
    if (!current) return
    if (!window.confirm('Delete this update?')) return
    setSheet(null)
    await supabase.from('statuses').delete().eq('id', current.id)
    const rest = items.filter((s) => s.id !== current.id)
    if (!rest.length) {
      if (isOwner) close()
      else goNextPerson()
      return
    }
    setItems(rest)
    setIndex((i) => Math.min(i, rest.length - 1))
  }

  async function toggleMuteUser() {
    setSheet(null)
    if (!person || !user) return
    if (person.muted) {
      await supabase.from('status_mutes').delete().eq('user_id', user.id).eq('muted_user_id', userId)
      setPerson({ ...person, muted: false })
      setToast('Updates unmuted')
    } else {
      await supabase.from('status_mutes').upsert({ user_id: user.id, muted_user_id: userId }, { onConflict: 'user_id,muted_user_id' })
      setPerson({ ...person, muted: true })
      setToast(`Muted ${person.full_name?.split(' ')[0] || 'updates'}`)
      setTimeout(goNextPerson, 700)
    }
  }

  function snippetOf(status) {
    if (status.content) return status.content.slice(0, 60)
    return statusKind(status) === 'video' ? 'video' : statusKind(status) === 'image' ? 'photo' : ''
  }

  async function sendReply() {
    const text = replyText.trim()
    if (!text || sending || !current || isGuest) return
    setSending(true)
    const snippet = snippetOf(current)
    const body = `↩️ Replied to your status${snippet ? `: “${snippet}”` : ''}\n${text}`
    const { error } = await supabase.from('messages').insert({ sender_id: user.id, receiver_id: userId, content: body })
    setSending(false)
    if (error) {
      setToast("Couldn't send. Try again.")
      return
    }
    setReplyText('')
    replyRef.current?.blur()
    setToast('Reply sent')
  }

  async function react(emoji) {
    if (!current || isGuest) return
    setShowReactions(false)
    const had = myReaction
    if (had === emoji) {
      await supabase.from('status_reactions').delete().eq('status_id', current.id).eq('user_id', user.id)
      setMyReaction(null)
      return
    }
    setMyReaction(emoji)
    const id = `${Date.now()}-${Math.random()}`
    setFloats((f) => [...f, { id, emoji, left: 30 + Math.random() * 40 }])
    setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1400)
    const { error } = await supabase.from('status_reactions').upsert({ status_id: current.id, user_id: user.id, emoji }, { onConflict: 'status_id,user_id' })
    if (error) {
      setMyReaction(had)
      setToast("Couldn't react. Try again.")
      return
    }
    if (!had) {
      const snippet = snippetOf(current)
      await supabase.from('messages').insert({ sender_id: user.id, receiver_id: userId, content: `${emoji} Reacted to your status${snippet ? `: “${snippet}”` : ''}` })
    }
  }

  // ---- Screens before the viewer is ready ----
  const shell = 'fixed inset-0 z-50 text-white flex flex-col items-center justify-center gap-3'
  if (authLoading || loading) {
    return <div className={shell} style={{ background: backgroundFor('night') }}><Loader2 className="animate-spin" /></div>
  }
  if (!current) {
    return (
      <div className={shell} style={{ background: backgroundFor('night') }}>
        <p className="text-white/80">No active updates.</p>
        {userId === user?.id && !isGuest ? (
          <button onClick={() => navigate('/statuses/create', { replace: true })} className="bg-brand-purple rounded-full px-5 py-2 text-sm font-medium">Add a status</button>
        ) : null}
        <button onClick={close} className="bg-white/15 rounded-full px-5 py-2 text-sm">Go back</button>
      </div>
    )
  }

  const hideUi = pressing
  const reactionCount = Object.keys(reactionMap).length
  const background = kind === 'text' ? backgroundFor(current.bg_color) : '#000'
  const firstName = person?.full_name?.split(' ')[0] || 'them'

  return (
    <div className="fixed inset-0 z-50 bg-black select-none">
      <style>{'@keyframes sl-float{0%{transform:translateY(0) scale(.6);opacity:0}15%{opacity:1}100%{transform:translateY(-260px) scale(1.5);opacity:0}}'}</style>
      <div
        className="absolute inset-0 text-white overflow-hidden"
        style={{
          background,
          transform: dragY ? `translateY(${dragY}px) scale(${Math.max(0.85, 1 - dragY / 1500)})` : 'none',
          borderRadius: dragY ? 24 : 0,
          transition: dragY ? 'none' : 'transform 0.2s ease',
          touchAction: 'none',
        }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        {/* The update itself */}
        {kind === 'text' ? (
          <div className="absolute inset-0 flex items-center justify-center px-8">
            <p className={`text-center leading-snug break-words whitespace-pre-wrap ${current.content.length > 160 ? 'text-xl' : current.content.length > 70 ? 'text-2xl' : 'text-3xl'}`} style={fontFor(current.font_style)}>{current.content}</p>
          </div>
        ) : null}

        {kind === 'image' ? (
          <>
            <img src={mediaUrl} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-50" />
            <img src={mediaUrl} alt="" onLoad={() => setReadyId(current.id)} onError={() => setReadyId(current.id)} className="absolute inset-0 w-full h-full object-contain" draggable={false} />
          </>
        ) : null}

        {kind === 'video' ? (
          <video
            key={current.id}
            ref={videoRef}
            src={mediaUrl}
            poster={current.thumb_url || undefined}
            playsInline
            muted={videoMuted}
            preload="auto"
            className="absolute inset-0 w-full h-full object-contain"
            onCanPlay={() => { setReadyId(current.id); setBuffering(false) }}
            onWaiting={() => setBuffering(true)}
            onPlaying={() => setBuffering(false)}
            onTimeUpdate={(e) => { const v = e.currentTarget; if (v.duration) setProgress(v.currentTime / v.duration) }}
            onEnded={goNext}
            onError={() => setReadyId(current.id)}
          />
        ) : null}

        {(!ready || buffering) && kind !== 'text' ? (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><Loader2 size={34} className="animate-spin text-white/80" /></div>
        ) : null}

        {/* Reactions floating up */}
        {floats.map((f) => (
          <span key={f.id} className="absolute bottom-32 text-5xl pointer-events-none" style={{ left: `${f.left}%`, animation: 'sl-float 1.3s ease-out forwards' }}>{f.emoji}</span>
        ))}

        {/* Top: progress, who, actions */}
        <div className={`absolute inset-x-0 top-0 z-10 transition-opacity duration-150 ${hideUi ? 'opacity-0' : 'opacity-100'}`} style={{ paddingTop: 'max(8px, env(safe-area-inset-top))' }}>
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/55 to-transparent pointer-events-none" />
          <div className="relative flex gap-1 px-3 pt-2">
            {items.map((s, i) => (
              <div key={s.id} className="flex-1 h-[3px] rounded-full bg-white/30 overflow-hidden">
                <div className="h-full bg-white" style={{ width: i < index ? '100%' : i === index ? `${progress * 100}%` : '0%' }} />
              </div>
            ))}
          </div>
          <div className="relative flex items-center justify-between px-3 pt-3">
            <button onPointerDown={stop} onClick={() => (isOwner ? close() : navigate(`/users/${userId}`))} className="flex items-center gap-2 min-w-0 text-left">
              <Avatar src={person?.avatar_url} name={person?.full_name} size={38} />
              <span className="min-w-0">
                <span className="flex items-center gap-1 text-sm font-semibold">
                  <span className="truncate">{isOwner ? 'My status' : person?.full_name}</span>
                  {!isOwner ? <VerifiedBadge userId={userId} size={13} /> : null}
                </span>
                <span className="block text-xs text-white/75">{formatStatusTime(current.created_at)} · {audienceLabel(current.audience)}</span>
              </span>
            </button>
            <div className="flex items-center gap-1 shrink-0" onPointerDown={stop}>
              {kind === 'video' ? (
                <button onClick={() => setVideoMuted((m) => !m)} aria-label={videoMuted ? 'Unmute' : 'Mute'} className="w-10 h-10 flex items-center justify-center">{videoMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}</button>
              ) : null}
              {!isOwner ? (
                <ReportButton contentType="status" contentId={current.id} size={19} className="text-white/90" onOpenChange={setReportOpen} />
              ) : null}
              <button onClick={() => setSheet('menu')} aria-label="More" className="w-10 h-10 flex items-center justify-center"><MoreVertical size={20} /></button>
              <button onClick={close} aria-label="Close" className="w-10 h-10 flex items-center justify-center"><X size={23} /></button>
            </div>
          </div>
        </div>

        {/* Bottom: caption, then views (yours) or reply (theirs) */}
        <div className={`absolute inset-x-0 bottom-0 z-10 transition-opacity duration-150 ${hideUi ? 'opacity-0' : 'opacity-100'}`} style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
          <div className="relative px-4">
            {kind !== 'text' && current.content ? <p className="text-center text-base leading-snug pb-3 break-words whitespace-pre-wrap">{current.content}</p> : null}

            {isOwner ? (
              <button onPointerDown={stop} onClick={() => setSheet('viewers')} className="mx-auto flex items-center gap-3 bg-black/40 rounded-full px-5 py-2.5 text-sm">
                <span className="flex items-center gap-1.5"><Eye size={17} /> {viewers.length}</span>
                {reactionCount > 0 ? <span className="flex items-center gap-1.5"><Heart size={15} /> {reactionCount}</span> : null}
              </button>
            ) : !isGuest ? (
              <div onPointerDown={stop}>
                {showReactions || replyFocus ? (
                  <div className="flex justify-between bg-black/55 rounded-full px-3 py-2 mb-2">
                    {STATUS_REACTIONS.map((emoji) => (
                      <button key={emoji} onClick={() => react(emoji)} className={`text-2xl leading-none px-1 rounded-full ${myReaction === emoji ? 'bg-white/25' : ''}`}>{emoji}</button>
                    ))}
                  </div>
                ) : null}
                <div className="flex items-center gap-2">
                  <input
                    ref={replyRef}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onFocus={() => setReplyFocus(true)}
                    onBlur={() => setReplyFocus(false)}
                    onKeyDown={(e) => { if (e.key === 'Enter') sendReply() }}
                    placeholder={`Reply to ${firstName}…`}
                    className="flex-1 min-w-0 bg-black/45 border border-white/25 text-white placeholder-white/60 rounded-full px-4 py-3 text-sm outline-none"
                  />
                  {replyText.trim() ? (
                    <button onClick={sendReply} disabled={sending} aria-label="Send reply" className="w-11 h-11 rounded-full bg-brand-purple flex items-center justify-center shrink-0"><Send size={18} /></button>
                  ) : (
                    <button onClick={() => setShowReactions((s) => !s)} aria-label="React" className="w-11 h-11 rounded-full bg-black/45 border border-white/25 flex items-center justify-center shrink-0">
                      {myReaction ? <span className="text-xl">{myReaction}</span> : <Heart size={19} />}
                    </button>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {toast ? <div className="absolute top-24 left-1/2 -translate-x-1/2 z-30 bg-black/75 text-white text-xs rounded-full px-4 py-2 whitespace-nowrap pointer-events-none">{toast}</div> : null}

      {/* Menu */}
      {sheet === 'menu' ? (
        <div className="absolute inset-0 z-30 bg-black/50 flex items-end" onClick={() => setSheet(null)}>
          <div className="bg-neutral-900 text-white w-full rounded-t-3xl p-3 pb-8" onClick={stop}>
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-2" />
            {isOwner ? (
              <button onClick={() => navigate('/statuses/create', { replace: true })} className="w-full flex items-center gap-3 px-3 py-3.5 text-left text-sm"><Plus size={19} /> Add another update</button>
            ) : (
              <button onClick={toggleMuteUser} className="w-full flex items-center gap-3 px-3 py-3.5 text-left text-sm">
                {person?.muted ? <Bell size={19} /> : <BellOff size={19} />} {person?.muted ? `Unmute ${firstName}` : `Mute ${firstName}'s updates`}
              </button>
            )}
            {isOwner || canModerate ? (
              <button onClick={handleDelete} className="w-full flex items-center gap-3 px-3 py-3.5 text-left text-sm text-red-400"><Trash2 size={19} /> Delete this update</button>
            ) : null}
            <button onClick={() => setSheet(null)} className="w-full text-center text-sm text-white/60 pt-3">Cancel</button>
          </div>
        </div>
      ) : null}

      {/* Who saw it */}
      {sheet === 'viewers' ? (
        <div className="absolute inset-0 z-30 bg-black/50 flex items-end" onClick={() => setSheet(null)}>
          <div className="bg-neutral-900 text-white w-full rounded-t-3xl p-4 pb-8 max-h-[70vh] overflow-y-auto" onClick={stop}>
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-3" />
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="font-semibold flex items-center gap-2"><Eye size={18} /> Viewed by {viewers.length}</p>
              <button onClick={handleDelete} aria-label="Delete" className="text-red-400"><Trash2 size={18} /></button>
            </div>
            <p className="text-xs text-white/50 px-1 mb-2">{timeLeft(current.created_at)} before this update disappears.</p>
            {viewers.length === 0 ? <p className="text-sm text-white/50 px-1 py-6 text-center">No views yet.</p> : null}
            {viewers.map((v) => (
              <div key={v.viewer_id} className="flex items-center gap-3 py-2.5 px-1">
                <Avatar src={v.profiles?.avatar_url} name={v.profiles?.full_name} size={42} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{v.profiles?.full_name}</p>
                  <p className="text-xs text-white/50 truncate">{v.profiles?.role ? `${v.profiles.role} · ` : ''}{timeAgo(v.viewed_at)}</p>
                </div>
                {reactionMap[v.viewer_id] ? <span className="text-2xl">{reactionMap[v.viewer_id]}</span> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
      }
