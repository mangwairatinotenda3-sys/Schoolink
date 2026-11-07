import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Play } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { loadStatusFeed } from '../lib/statusFeed.js'
import { backgroundFor, fontFor, mediaOf, statusKind } from '../lib/statusUtils.js'
import StatusRing from './StatusRing.jsx'

// Compact cards: small enough to see several at once, large enough to read the name.
const TILE = 'relative shrink-0 w-[112px] h-[176px] rounded-2xl overflow-hidden bg-neutral-800 text-white'

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
    <div className="absolute inset-0 flex items-center justify-center px-3" style={{ background: backgroundFor(status.bg_color) }}>
      <p className="text-white text-center text-[12px] leading-snug line-clamp-5 break-words" style={fontFor(status.font_style)}>{status.content}</p>
    </div>
  )
}

function Tile({ onOpen, status, seen, children, dim }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
      className={`${TILE} active:scale-[0.98] transition ${dim || seen ? 'opacity-70' : ''}`}
      style={{ scrollSnapAlign: 'start' }}
    >
      {status ? <Preview status={status} /> : null}
      <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black/40 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/65 to-transparent" />
      {status && statusKind(status) === 'video' ? (
        <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-black/45 flex items-center justify-center"><Play size={9} fill="currentColor" className="ml-0.5" /></span>
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

  // No live channel here. A table-wide subscription would send every status change to every user,
  // which uses up the free realtime quota. Instead the row refreshes when you come back to the app,
  // and every 2 minutes while it is open.
  useEffect(() => {
    if (!user) return undefined
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', refresh)
    const poll = setInterval(refresh, 120000)
    return () => {
      clearInterval(poll)
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
      <div className="flex items-center justify-between px-4 mb-2.5">
        <h2 className="text-[15px] font-semibold tracking-tight text-brand-navy">Updates</h2>
        {mutedPeople.length > 0 ? (
          <button onClick={() => setShowMuted((s) => !s)} className="text-[12px] font-medium text-gray-400">
            {showMuted ? 'Hide' : 'Muted'} ({mutedPeople.length})
          </button>
        ) : null}
      </div>

      <div className="flex gap-2 overflow-x-auto px-4 pb-2" style={{ scrollbarWidth: 'none', scrollSnapType: 'x proximity' }}>
        {!feed ? (
          <>
            {[0, 1, 2].map((i) => <div key={i} className={`${TILE} bg-gray-200/70`} />)}
          </>
        ) : (
          <>
            {!isGuest ? (
              myLatest ? (
                <Tile status={myLatest} onOpen={() => navigate(`/statuses/${user.id}`)}>
                  <div className="absolute top-2.5 left-2.5">
                    <StatusRing src={profile?.avatar_url} name={profile?.full_name} size={36} flags={mine.map(() => false)}>
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate('/statuses/create') }}
                        aria-label="Add update"
                        className="absolute -bottom-1 -right-1 w-[18px] h-[18px] rounded-full bg-brand-purple border-2 border-neutral-900 flex items-center justify-center"
                      >
                        <Plus size={10} className="text-white" strokeWidth={3} />
                      </button>
                    </StatusRing>
                  </div>
                  <p className="absolute bottom-2.5 left-2.5 right-2.5 font-semibold text-[12px] truncate">My update</p>
                </Tile>
              ) : (
                <Tile onOpen={() => navigate('/statuses/create')}>
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg, var(--brand-purple), #241B4E)' }} />
                  <div className="absolute inset-x-0 top-7 flex justify-center">
                    <StatusRing src={profile?.avatar_url} name={profile?.full_name} size={56} flags={[]}>
                      <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white flex items-center justify-center">
                        <Plus size={12} className="text-brand-purple" strokeWidth={3} />
                      </span>
                    </StatusRing>
                  </div>
                  <p className="absolute bottom-8 left-2.5 right-2.5 text-center text-[10px] leading-snug text-white/80">Share a photo, video or text</p>
                  <p className="absolute bottom-2.5 left-2.5 right-2.5 text-center font-semibold text-[12px]">Add update</p>
                </Tile>
              )
            ) : null}

             {(feed?.schools ?? []).map((s) => (
              <Tile
                key={`school-${s.id}`}
                status={s.latest}
                seen={s.allSeen}
                onOpen={() => navigate(`/schools/${s.id}`, { state: { openUpdates: true } })}
              >
                <div className="absolute top-2.5 left-2.5">
                  <StatusRing src={s.logo_url} name={s.name} size={36} flags={s.flags} />
                </div>
                <p className="absolute bottom-2.5 left-2.5 right-2.5 font-semibold text-[12px] truncate">{s.name}</p>
              </Tile>
            ))}

            {people.map((p) => (
              <Tile key={p.id} status={p.latest} seen={p.allSeen} onOpen={() => openPerson(p)}>
                <div className="absolute top-2.5 left-2.5">
                  <StatusRing src={p.avatar_url} name={p.full_name} size={36} flags={p.flags} />
                </div>
                <p className="absolute bottom-2.5 left-2.5 right-2.5 font-semibold text-[12px] truncate">{p.full_name}</p>
              </Tile>
            ))}

            {showMuted ? mutedPeople.map((p) => (
              <Tile key={p.id} status={p.latest} dim onOpen={() => navigate(`/statuses/${p.id}`, { state: { queue: [p.id] } })}>
                <div className="absolute top-2.5 left-2.5">
                  <StatusRing src={p.avatar_url} name={p.full_name} size={36} flags={p.flags} />
                </div>
                <p className="absolute bottom-2.5 left-2.5 right-2.5 font-semibold text-[12px] truncate">{p.full_name}</p>
                <span className="absolute bottom-8 left-2.5 text-[10px] bg-black/50 rounded-full px-1.5 py-0.5">Muted</span>
              </Tile>
            )) : null}

            {!isGuest && people.length === 0 && myLatest ? (
              <div className={`${TILE} border border-dashed border-gray-300 bg-transparent text-gray-400 flex items-center justify-center text-center px-3 text-[11px] leading-snug`}>
                Updates from people in your school will show up here.
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  )
  }
