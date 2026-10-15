import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Play } from 'lucide-react'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { loadStatusFeed } from '../lib/statusFeed.js'
import { backgroundFor, fontFor, mediaOf, statusKind } from '../lib/statusUtils.js'
import StatusRing from './StatusRing.jsx'

// What the card shows behind the name: the photo, a video frame, or the text on its colour.
function Preview({ status }) {
  const kind = statusKind(status)
  const { url } = mediaOf(status)
  if (kind === 'image') return <img src={url} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
  if (kind === 'video') {
    return status.thumb_url ? (
      <img src={status.thumb_url} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
    ) : (
      <video src={`${url}#t=0.1`} muted playsInline preload="metadata" className="absolute inset-0 w-full h-full object-cover" />
    )
  }
  return (
    <div className="absolute inset-0 flex items-center justify-center px-4" style={{ background: backgroundFor(status.bg_color) }}>
      <p className="text-white text-center text-sm leading-snug line-clamp-6 break-words" style={fontFor(status.font_style)}>{status.content}</p>
    </div>
  )
}

function Tile({ onOpen, status, seen, children, dim }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      className={`relative shrink-0 w-[150px] h-[250px] rounded-3xl overflow-hidden bg-neutral-800 text-white active:scale-[0.98] transition ${dim || seen ? 'opacity-75' : ''}`}
      style={{ scrollSnapAlign: 'start' }}
    >
      {status ? <Preview status={status} /> : null}
      <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/45 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent" />
      {status && statusKind(status) === 'video' ? (
        <span className="absolute top-3 right-3 w-6 h-6 rounded-full bg-black/45 flex items-center justify-center"><Play size={11} fill="currentColor" className="ml-0.5" /></span>
      ) : null}
      {children}
    </div>
  )
}

export default function StatusRow() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [feed, setFeed] = useState(null)
  const [showMuted, setShowMuted] = useState(false)
  const timer = useRef(null)

  async function refresh() {
    if (!user) return
    try {
      setFeed(await loadStatusFeed(user, profile))
    } catch {
      setFeed((f) => f || { mine: [], people: [], seen: new Set() })
    }
  }

  useEffect(() => {
    refresh()
  }, [user?.id, profile?.school_id, profile?.role])

  // Stay fresh: when new updates are posted or removed, and when you come back to the app.
  useEffect(() => {
    if (!user) return undefined
    const later = () => {
      clearTimeout(timer.current)
      timer.current = setTimeout(refresh, 700)
    }
    const channel = supabase
      .channel(`status-feed-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'statuses' }, later)
      .subscribe()
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', refresh)
    return () => {
      clearTimeout(timer.current)
      supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', refresh)
    }
  }, [user?.id, profile?.school_id])

  if (!user) return null
  const isGuest = !!user.is_anonymous
  const mine = feed?.mine ?? []
  const myLatest = mine[mine.length - 1]
  const people = (feed?.people ?? []).filter((p) => !p.muted)
  const mutedPeople = (feed?.people ?? []).filter((p) => p.muted)
  const queue = people.map((p) => p.id)

  function openPerson(p) {
    navigate(`/statuses/${p.id}`, { state: { queue } })
  }

  return (
    <section className="pt-3 pb-1">
      <div className="flex items-center justify-between px-4 mb-2">
        <h2 className="text-lg font-bold">Status</h2>
        {mutedPeople.length > 0 ? (
          <button onClick={() => setShowMuted((s) => !s)} className="text-xs text-gray-400">
            {showMuted ? 'Hide' : 'Muted'} ({mutedPeople.length})
          </button>
        ) : null}
      </div>

      <div className="flex gap-2.5 overflow-x-auto px-4 pb-2" style={{ scrollbarWidth: 'none', scrollSnapType: 'x proximity' }}>
        {!feed ? (
          <>
            {[0, 1, 2].map((i) => <div key={i} className="shrink-0 w-[150px] h-[250px] rounded-3xl bg-gray-200/60 animate-pulse" />)}
          </>
        ) : (
          <>
            {!isGuest ? (
              myLatest ? (
                <Tile status={myLatest} onOpen={() => navigate(`/statuses/${user.id}`)}>
                  <div className="absolute top-3 left-3">
                    <StatusRing src={profile?.avatar_url} name={profile?.full_name} size={44} flags={mine.map(() => false)}>
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate('/statuses/create') }}
                        aria-label="Add status"
                        className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-brand-purple border-2 border-neutral-900 flex items-center justify-center"
                      >
                        <Plus size={11} className="text-white" strokeWidth={3} />
                      </button>
                    </StatusRing>
                  </div>
                  <p className="absolute bottom-3 left-3 right-3 font-semibold text-sm truncate">My status</p>
                </Tile>
              ) : (
                <Tile onOpen={() => navigate('/statuses/create')}>
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg, var(--brand-purple), #241B4E)' }} />
                  <div className="absolute inset-x-0 top-10 flex justify-center">
                    <StatusRing src={profile?.avatar_url} name={profile?.full_name} size={72} flags={[]}>
                      <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white flex items-center justify-center shadow">
                        <Plus size={16} className="text-brand-purple" strokeWidth={3} />
                      </span>
                    </StatusRing>
                  </div>
                  <p className="absolute bottom-10 left-3 right-3 text-center text-xs text-white/80">Share a photo, video or text</p>
                  <p className="absolute bottom-3 left-3 right-3 text-center font-semibold text-sm">Add status</p>
                </Tile>
              )
            ) : null}

            {people.map((p) => (
              <Tile key={p.id} status={p.latest} seen={p.allSeen} onOpen={() => openPerson(p)}>
                <div className="absolute top-3 left-3">
                  <StatusRing src={p.avatar_url} name={p.full_name} size={44} flags={p.flags} />
                </div>
                <p className="absolute bottom-3 left-3 right-3 font-semibold text-sm truncate">{p.full_name}</p>
              </Tile>
            ))}

            {showMuted ? mutedPeople.map((p) => (
              <Tile key={p.id} status={p.latest} dim onOpen={() => navigate(`/statuses/${p.id}`, { state: { queue: [p.id] } })}>
                <div className="absolute top-3 left-3">
                  <StatusRing src={p.avatar_url} name={p.full_name} size={44} flags={p.flags} />
                </div>
                <p className="absolute bottom-3 left-3 right-3 font-semibold text-sm truncate">{p.full_name}</p>
                <span className="absolute bottom-9 left-3 text-[10px] bg-black/50 rounded-full px-2 py-0.5">Muted</span>
              </Tile>
            )) : null}

            {!isGuest && people.length === 0 && myLatest ? (
              <div className="shrink-0 w-[150px] h-[250px] rounded-3xl border border-dashed border-gray-300 flex items-center justify-center text-center px-4 text-xs text-gray-400">
                Updates from people in your school will show up here.
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  )
}
