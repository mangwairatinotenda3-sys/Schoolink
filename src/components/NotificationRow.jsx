import { useRef, useState } from 'react'
import { MoreHorizontal, Check, Trash2, MailOpen, Mail } from 'lucide-react'
import { metaFor, shortTime } from '../lib/notificationUtils.js'

const TRIGGER = 96

function Avatar({ person, size, ring = true }) {
  const initial = (person?.name || '?').trim().slice(0, 1).toUpperCase()
  return (
    <span className={`rounded-full overflow-hidden bg-brand-light flex items-center justify-center shrink-0 ${ring ? 'ring-2 ring-white' : ''}`} style={{ width: size, height: size }}>
      {person?.avatar ? <img src={person.avatar} alt="" className="w-full h-full object-cover" /> : <span className="text-brand-purple font-semibold" style={{ fontSize: size * 0.4 }}>{initial}</span>}
    </span>
  )
}

// One notification. Swipe left to remove, swipe right to mark read or unread,
// press and hold to select several, tap the dots for more.
export default function NotificationRow({ group, actors, lead, action, snippet, thumb, selecting, selected, following, onOpen, onSelect, onLongPress, onRemove, onToggleRead, onMore, onFollow }) {
  const meta = metaFor(group.type)
  const Icon = meta.icon
  const wrapRef = useRef(null)
  const [dx, setDx] = useState(0)
  const [snap, setSnap] = useState(true)
  const [height, setHeight] = useState(null)
  const dxRef = useRef(0)
  const st = useRef({ id: null, x: 0, y: 0, lock: null, timer: null, suppress: false })

  const first = actors[0]
  const second = actors[1]
  const single = actors.length <= 1
  const showFollow = group.type === 'follow' && single && first?.id && onFollow

  function setOffset(v) {
    dxRef.current = v
    setDx(v)
  }

  function down(e) {
    if (e.target.closest('[data-noswipe]')) return
    clearTimeout(st.current.timer)
    st.current = {
      id: e.pointerId, x: e.clientX, y: e.clientY, lock: null, suppress: false,
      timer: setTimeout(() => {
        st.current.suppress = true
        st.current.lock = 'long'
        try { navigator.vibrate?.(12) } catch { /* ignore */ }
        onLongPress()
      }, 450),
    }
  }

  function move(e) {
    const s = st.current
    if (s.id !== e.pointerId || s.lock === 'long') return
    const mx = e.clientX - s.x
    const my = e.clientY - s.y
    if (!s.lock) {
      if (Math.abs(mx) > 10 && Math.abs(mx) > Math.abs(my)) {
        s.lock = 'x'
        clearTimeout(s.timer)
        if (!selecting) e.currentTarget.setPointerCapture?.(e.pointerId)
      } else if (Math.abs(my) > 10) {
        s.lock = 'y'
        clearTimeout(s.timer)
      }
    }
    if (s.lock === 'x' && !selecting) {
      s.suppress = true
      setSnap(false)
      const damp = Math.abs(mx) > 150 ? 150 + (Math.abs(mx) - 150) * 0.25 : Math.abs(mx)
      setOffset(mx < 0 ? -damp : damp)
    }
  }

  function finish(cancelled) {
    const s = st.current
    clearTimeout(s.timer)
    if (s.lock === 'x' && !selecting) {
      const v = dxRef.current
      setSnap(true)
      if (!cancelled && v <= -TRIGGER) {
        const el = wrapRef.current
        setOffset(-(el?.offsetWidth || 400))
        setTimeout(() => {
          setHeight(el?.offsetHeight || 0)
          requestAnimationFrame(() => requestAnimationFrame(() => setHeight(0)))
          setTimeout(() => onRemove(group), 200)
        }, 150)
        s.id = null
        return
      }
      if (!cancelled && v >= TRIGGER) {
        try { navigator.vibrate?.(8) } catch { /* ignore */ }
        onToggleRead(group)
      }
      setOffset(0)
    }
    s.id = null
    // let the click that follows a drag or hold be ignored once
    setTimeout(() => { st.current.suppress = false }, 0)
  }

  function click() {
    if (st.current.suppress) return
    if (selecting) onSelect(group)
    else onOpen(group)
  }

  const progressRight = Math.min(1, Math.max(0, dx / TRIGGER))
  const progressLeft = Math.min(1, Math.max(0, -dx / TRIGGER))

  return (
    <div ref={wrapRef} className="relative overflow-hidden" style={{ height: height == null ? 'auto' : height, transition: height == null ? 'none' : 'height 200ms ease' }}>
      {/* What the swipe will do */}
      <div className="absolute inset-0 flex items-center justify-between text-white">
        <div className="h-full flex items-center pl-6 bg-brand-purple" style={{ width: Math.max(0, dx), opacity: 0.35 + progressRight * 0.65 }}>
          <span className="flex items-center gap-2 text-sm font-medium" style={{ transform: `scale(${0.8 + progressRight * 0.2})` }}>
            {group.unread ? <MailOpen size={20} /> : <Mail size={20} />}
            {progressRight > 0.6 ? (group.unread ? 'Read' : 'Unread') : null}
          </span>
        </div>
        <div className="h-full flex items-center justify-end pr-6 bg-red-500" style={{ width: Math.max(0, -dx), opacity: 0.35 + progressLeft * 0.65 }}>
          <span className="flex items-center gap-2 text-sm font-medium" style={{ transform: `scale(${0.8 + progressLeft * 0.2})` }}>
            {progressLeft > 0.6 ? 'Remove' : null}
            <Trash2 size={20} />
          </span>
        </div>
      </div>

      <div
        role="button"
        tabIndex={0}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={() => finish(false)}
        onPointerCancel={() => finish(true)}
        onContextMenu={(e) => e.preventDefault()}
        onClick={click}
        onKeyDown={(e) => { if (e.key === 'Enter') click() }}
        className={`relative bg-white flex items-start gap-3 px-4 py-3 select-none ${group.fresh ? 'sl-notif-fresh' : ''}`}
        style={{ transform: `translateX(${dx}px)`, transition: snap ? 'transform 220ms cubic-bezier(.2,.8,.2,1)' : 'none', touchAction: 'pan-y', WebkitTouchCallout: 'none' }}
      >
        {group.unread ? <span className="absolute inset-0 bg-brand-purple/[0.07] pointer-events-none" /> : null}

        {/* Selection checkbox slides in */}
        <span
          className="shrink-0 self-center overflow-hidden transition-all duration-200"
          style={{ width: selecting ? 26 : 0, opacity: selecting ? 1 : 0, marginRight: selecting ? 0 : -12 }}
        >
          <span className={`w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center ${selected ? 'bg-brand-purple border-brand-purple' : 'border-gray-300'}`}>
            {selected ? <Check size={14} className="text-white" strokeWidth={3} /> : null}
          </span>
        </span>

        {/* Who it is from, with the kind of notification in the corner */}
        <span className="relative shrink-0" style={{ width: 52, height: 52 }}>
          {group.type === 'approval' || actors.length === 0 ? (
            <span className={`w-[52px] h-[52px] rounded-full flex items-center justify-center text-white ${meta.bg}`}><Icon size={22} /></span>
          ) : single ? (
            <Avatar person={first} size={52} ring={false} />
          ) : (
            <>
              <span className="absolute top-0 left-0"><Avatar person={first} size={36} /></span>
              <span className="absolute bottom-0 right-0"><Avatar person={second} size={36} /></span>
            </>
          )}
          {group.type !== 'approval' && actors.length > 0 ? (
            <span className={`absolute -bottom-0.5 -right-0.5 w-[22px] h-[22px] rounded-full flex items-center justify-center text-white ring-2 ring-white ${meta.bg}`}>
              <Icon size={12} fill={group.type === 'like' ? 'currentColor' : 'none'} />
            </span>
          ) : null}
        </span>

        <div className="min-w-0 flex-1 pt-0.5">
          <p className={`text-[14px] leading-snug line-clamp-3 ${group.unread ? 'text-gray-900' : 'text-gray-600'}`}>
            {lead ? <span className="font-semibold">{lead}</span> : null}
            <span>{action}</span>
          </p>
          {snippet ? <p className="text-[13px] text-gray-400 truncate mt-0.5">“{snippet}”</p> : null}
          <p className={`text-xs mt-1 flex items-center gap-1.5 ${group.unread ? 'text-brand-purple font-medium' : 'text-gray-400'}`}>
            {group.unread ? <span className="w-2 h-2 rounded-full bg-brand-purple" /> : null}
            {shortTime(group.created_at)}
          </p>
        </div>

        {showFollow ? (
          <button
            data-noswipe
            onClick={(e) => { e.stopPropagation(); onFollow(first.id) }}
            className={`shrink-0 self-center text-xs font-semibold rounded-full px-3.5 py-1.5 ${following ? 'bg-gray-100 text-gray-600' : 'bg-brand-purple text-white'}`}
          >
            {following ? 'Following' : 'Follow back'}
          </button>
        ) : thumb ? (
          <img src={thumb} alt="" loading="lazy" className="shrink-0 self-center w-12 h-12 rounded-lg object-cover bg-gray-100" />
        ) : null}

        {!selecting ? (
          <button data-noswipe onClick={(e) => { e.stopPropagation(); onMore(group) }} aria-label="More options" className="shrink-0 -mr-2 w-8 h-8 rounded-full flex items-center justify-center text-gray-400 active:bg-gray-100">
            <MoreHorizontal size={18} />
          </button>
        ) : null}
      </div>
    </div>
  )
  }
