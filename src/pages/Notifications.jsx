import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCheck, MoreVertical, X, Trash2, Settings, ListChecks, BellOff, Loader2, MailOpen, Mail, User, ExternalLink, RefreshCw, ArrowDown } from 'lucide-react'
import BottomNav from '../components/BottomNav.jsx'
import NotificationRow from '../components/NotificationRow.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import {
  FILTERS, groupNotifications, inFilter, actorsOf, describe, pathFor, sectionOf, postThumb, announceNotificationChange,
} from '../lib/notificationUtils.js'

const PAGE = 40
const UNDO_MS = 6000

const EMPTY = {
  all: ['No notifications yet', 'Likes, comments, follows and messages will show up here.'],
  unread: ["You're all caught up", 'Nothing new to read right now.'],
  posts: ['Nothing on your posts', 'Likes and comments on your posts will appear here.'],
  mentions: ['No mentions', 'When someone mentions you, you will see it here.'],
  people: ['No new followers', 'New followers will appear here.'],
  messages: ['No message alerts', 'New message alerts will appear here.'],
  school: ['No school updates', 'Approvals and school news will appear here.'],
}

function Sheet({ onClose, children }) {
  return (
    <div className="absolute inset-0 z-40 flex items-end bg-black/45" style={{ animation: 'sl-fade 160ms ease-out' }} onClick={onClose}>
      <div className="bg-white w-full rounded-t-3xl pt-2 pb-8 px-2 max-h-[80%] overflow-y-auto" style={{ animation: 'sl-sheet-up 220ms cubic-bezier(.2,.8,.2,1)' }} onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-2" />
        {children}
      </div>
    </div>
  )
}

function SheetAction({ icon: Icon, label, onClick, danger = false }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-left text-[15px] active:bg-gray-100 ${danger ? 'text-red-500' : ''}`}>
      <Icon size={20} className={danger ? '' : 'text-gray-500'} /> {label}
    </button>
  )
}

function Skeleton() {
  return (
    <div>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="flex items-start gap-3 px-4 py-3 animate-pulse">
          <span className="w-[52px] h-[52px] rounded-full bg-gray-200 shrink-0" />
          <div className="flex-1 pt-1.5 space-y-2">
            <div className="h-3 bg-gray-200 rounded w-11/12" />
            <div className="h-3 bg-gray-200 rounded w-2/3" />
            <div className="h-2.5 bg-gray-100 rounded w-10" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Notifications() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isGuest = !!user?.is_anonymous

  const [items, setItems] = useState([])
  const [profiles, setProfiles] = useState(() => new Map())
  const [posts, setPosts] = useState(() => new Map())
  const [following, setFollowing] = useState(() => new Set())
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [failed, setFailed] = useState(false)
  const [filter, setFilter] = useState('all')
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState(() => new Set())
  const [sheet, setSheet] = useState(null)
  const [snack, setSnack] = useState(null)
  const [pullY, setPullY] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const scrollRef = useRef(null)
  const sentinelRef = useRef(null)
  const pending = useRef(null)
  const pull = useRef({ x: 0, y: 0, active: false })
  const flashTimer = useRef(null)
  const profilesRef = useRef(profiles)
  const postsRef = useRef(posts)
  const itemsRef = useRef(items)
  const commitRef = useRef(() => {})
  profilesRef.current = profiles
  postsRef.current = posts
  itemsRef.current = items

  // ---------- Loading ----------
  async function enrich(rows) {
    const actorIds = [...new Set(rows.map((r) => r.actor_id).filter(Boolean))].filter((id) => !profilesRef.current.has(id))
    const postIds = [...new Set(rows.map((r) => r.post_id).filter(Boolean))].filter((id) => !postsRef.current.has(id))

    if (actorIds.length) {
      const { data } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', actorIds)
      setProfiles((prev) => {
        const next = new Map(prev)
        ;(data ?? []).forEach((p) => next.set(p.id, p))
        return next
      })
    }
    if (postIds.length) {
      let res = await supabase.from('posts').select('id, content, image_url, image_urls').in('id', postIds)
      if (res.error) res = await supabase.from('posts').select('id, content').in('id', postIds)
      setPosts((prev) => {
        const next = new Map(prev)
        ;(res.data ?? []).forEach((p) => next.set(p.id, p))
        return next
      })
    }
    const followerIds = [...new Set(rows.filter((r) => r.type === 'follow' && r.actor_id).map((r) => r.actor_id))]
    if (followerIds.length) {
      const { data } = await supabase.from('follows').select('followed_id').eq('follower_id', user.id).in('followed_id', followerIds)
      setFollowing((prev) => new Set([...prev, ...(data ?? []).map((f) => f.followed_id)]))
    }
  }

  function withoutPending(rows) {
    const p = pending.current
    if (!p) return rows
    if (p.mode === 'ids') return rows.filter((r) => !p.ids.includes(r.id))
    return rows.filter((r) => !(r.created_at <= p.before && (p.mode === 'all' || r.read)))
  }

  const loadFirst = useCallback(async (keep = false) => {
    if (!user || isGuest) { setLoading(false); return }
    if (!keep) setLoading(true)
    setFailed(false)
    const size = keep ? Math.max(PAGE, itemsRef.current.length) : PAGE
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', user.id)
      .order('created_at', { ascending: false })
      .range(0, size - 1)
    if (error) {
      if (!keep) setFailed(true)
      setLoading(false)
      return
    }
    const rows = withoutPending(data ?? [])
    setItems(rows)
    setHasMore((data ?? []).length === size)
    setLoading(false)
    enrich(rows)
  }, [user?.id, isGuest])

  useEffect(() => { loadFirst() }, [loadFirst])

  async function loadMore() {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    const from = itemsRef.current.length
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', user.id)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1)
    setLoadingMore(false)
    if (error) return
    const rows = withoutPending(data ?? [])
    setItems((prev) => {
      const have = new Set(prev.map((r) => r.id))
      return [...prev, ...rows.filter((r) => !have.has(r.id))]
    })
    setHasMore((data ?? []).length === PAGE)
    enrich(rows)
  }

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore) return undefined
    const io = new IntersectionObserver((entries) => { if (entries[0].isIntersecting) loadMore() }, { root: scrollRef.current, rootMargin: '300px' })
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, items.length, loadingMore])

  // Live: new ones slide in, reads and removals made on another device follow along.
  useEffect(() => {
    if (!user || isGuest) return undefined
    const channel = supabase
      .channel(`notif-page-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${user.id}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const row = { ...payload.new, _fresh: true }
          if (pending.current?.mode === 'ids' && pending.current.ids.includes(row.id)) return
          setItems((prev) => (prev.some((r) => r.id === row.id) ? prev : [row, ...prev]))
          enrich([row])
          setTimeout(() => setItems((prev) => prev.map((r) => (r.id === row.id ? { ...r, _fresh: false } : r))), 2500)
        } else if (payload.eventType === 'UPDATE') {
          setItems((prev) => prev.map((r) => (r.id === payload.new.id ? { ...r, ...payload.new } : r)))
        } else if (payload.eventType === 'DELETE' && payload.old?.id) {
          setItems((prev) => prev.filter((r) => r.id !== payload.old.id))
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notifications' }, (payload) => {
        if (payload.old?.id) setItems((prev) => prev.filter((r) => r.id !== payload.old.id))
      })
      .subscribe()
    const onVisible = () => { if (document.visibilityState === 'visible') loadFirst(true) }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [user?.id, isGuest])

  // ---------- Reading ----------
  async function setRead(rows, read) {
    const ids = rows.filter((r) => !!r.read !== read).map((r) => r.id)
    if (!ids.length) return
    setItems((prev) => prev.map((r) => (ids.includes(r.id) ? { ...r, read } : r)))
    const { error } = await supabase.from('notifications').update({ read }).in('id', ids)
    if (error) { flash("Couldn't update. Try again."); loadFirst(true) }
    announceNotificationChange()
  }

  async function markAllRead() {
    setSheet(null)
    if (!items.some((r) => !r.read)) return
    setItems((prev) => prev.map((r) => ({ ...r, read: true })))
    const { error } = await supabase.from('notifications').update({ read: true }).eq('recipient_id', user.id).eq('read', false)
    if (error) { flash("Couldn't update. Try again."); loadFirst(true) }
    else flash('All marked as read')
    announceNotificationChange()
  }

  // ---------- Removing (with a few seconds to undo) ----------
  function flash(text) {
    setSnack({ text })
    clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setSnack((s) => (s && !s.undo ? null : s)), 2200)
  }

  async function commitPending() {
    const p = pending.current
    if (!p) return
    clearTimeout(p.timer)
    pending.current = null
    setSnack((s) => (s && s.undo ? null : s))
    let q = supabase.from('notifications').delete().eq('recipient_id', user.id)
    if (p.mode === 'ids') q = q.in('id', p.ids)
    else {
      q = q.lte('created_at', p.before)
      if (p.mode === 'read') q = q.eq('read', true)
    }
    const { error } = await q
    if (error) { flash("Couldn't remove. Try again."); loadFirst(true) }
    announceNotificationChange()
  }
  commitRef.current = commitPending

  function removeRows(rows, mode, label) {
    if (!rows.length) return
    commitPending()
    const ids = rows.map((r) => r.id)
    const prevHasMore = hasMore
    setItems((prev) => prev.filter((r) => !ids.includes(r.id)))
    if (mode !== 'ids') setHasMore(false)
    pending.current = {
      mode, ids, rows, prevHasMore,
      before: [new Date().toISOString(), ...rows.map((r) => r.created_at)].sort().pop(),
      timer: setTimeout(() => commitRef.current(), UNDO_MS),
    }
    setSnack({ text: label, undo: true })
    announceNotificationChange()
  }

  function undo() {
    const p = pending.current
    if (!p) return
    clearTimeout(p.timer)
    pending.current = null
    setItems((prev) => {
      const have = new Set(prev.map((r) => r.id))
      return [...prev, ...p.rows.filter((r) => !have.has(r.id))].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    })
    setHasMore(p.prevHasMore)
    setSnack(null)
    announceNotificationChange()
  }

  // Leaving the page makes any pending removal final.
  useEffect(() => {
    const flush = () => commitRef.current()
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      commitRef.current()
    }
  }, [])

  // ---------- Following back ----------
  async function toggleFollow(personId) {
    const was = following.has(personId)
    setFollowing((prev) => {
      const next = new Set(prev)
      if (was) next.delete(personId)
      else next.add(personId)
      return next
    })
    const { error } = was
      ? await supabase.from('follows').delete().eq('follower_id', user.id).eq('followed_id', personId)
      : await supabase.from('follows').insert({ follower_id: user.id, followed_id: personId })
    if (error) {
      setFollowing((prev) => {
        const next = new Set(prev)
        if (was) next.add(personId)
        else next.delete(personId)
        return next
      })
      flash("Couldn't update. Try again.")
    }
  }

  // ---------- What is shown ----------
  const groups = useMemo(() => groupNotifications(items), [items])
  const counts = useMemo(() => {
    const c = {}
    FILTERS.forEach((f) => { c[f.key] = groups.filter((g) => inFilter(g, f.key)).length })
    return c
  }, [groups])
  const visible = useMemo(() => groups.filter((g) => inFilter(g, filter)), [groups, filter])
  const unreadTotal = items.filter((r) => !r.read).length
  const hasRead = items.some((r) => r.read)
  const chips = FILTERS.filter((f) => f.key === 'all' || f.key === 'unread' || counts[f.key] > 0 || filter === f.key)

  useEffect(() => {
    if (filter !== 'all' && filter !== 'unread' && counts[filter] === 0 && !loading) setFilter('all')
  }, [counts, filter, loading])

  function openGroup(g) {
    setRead(g.rows, true)
    const path = pathFor(g)
    if (path) navigate(path)
  }

  // ---------- Selecting ----------
  function startSelect(g) {
    setSelectMode(true)
    setSelected(new Set(g ? [g.key] : []))
  }
  function toggleSelect(g) {
    const next = new Set(selected)
    if (next.has(g.key)) next.delete(g.key)
    else next.add(g.key)
    setSelected(next)
    if (next.size === 0) setSelectMode(false)
  }
  function stopSelect() {
    setSelectMode(false)
    setSelected(new Set())
  }
  const selectedGroups = visible.filter((g) => selected.has(g.key))
  const selectedRows = selectedGroups.flatMap((g) => g.rows)

  // ---------- Pull to refresh ----------
  async function doRefresh() {
    setRefreshing(true)
    await loadFirst(true)
    setRefreshing(false)
  }
  function onTouchStart(e) {
    if ((scrollRef.current?.scrollTop || 0) <= 0 && !refreshing) pull.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, active: true }
  }
  function onTouchMove(e) {
    if (!pull.current.active) return
    const d = e.touches[0].clientY - pull.current.y
    if (Math.abs(e.touches[0].clientX - pull.current.x) > Math.abs(d)) { pull.current.active = false; setPullY(0); return }
    if (d > 0 && (scrollRef.current?.scrollTop || 0) <= 0) setPullY(Math.min(80, d * 0.45))
    else { pull.current.active = false; setPullY(0) }
  }
  function onTouchEnd() {
    const go = pullY >= 52
    pull.current.active = false
    setPullY(0)
    if (go) doRefresh()
  }

  const [emptyTitle, emptySub] = EMPTY[filter] || EMPTY.all
  let lastSection = null

  return (
    <div className="app-shell relative">
      <style>{`
        @keyframes sl-fade{from{opacity:0}to{opacity:1}}
        @keyframes sl-sheet-up{from{transform:translateY(100%)}to{transform:none}}
        @keyframes sl-snack{from{transform:translateY(16px);opacity:0}to{transform:none;opacity:1}}
        @keyframes sl-notif-in{0%{background-color:rgba(108,76,224,.25)}100%{background-color:transparent}}
        .sl-notif-fresh{animation:sl-notif-in 1.8s ease-out}
      `}</style>

      {/* Header */}
      {selectMode ? (
        <div className="bg-white px-4 pt-4 pb-3 flex items-center gap-3 border-b border-gray-100">
          <button onClick={stopSelect} aria-label="Cancel selection" className="w-9 h-9 -ml-2 rounded-full flex items-center justify-center"><X size={22} /></button>
          <p className="font-semibold text-lg flex-1">{selected.size} selected</p>
          <button onClick={() => setSelected(new Set(visible.map((g) => g.key)))} className="text-sm text-brand-purple font-medium px-1">All</button>
          <button onClick={() => { setRead(selectedRows, true); stopSelect() }} disabled={!selectedGroups.some((g) => g.unread)} aria-label="Mark as read" className="w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-30"><MailOpen size={20} /></button>
          <button onClick={() => { removeRows(selectedRows, 'ids', `Removed ${selectedGroups.length} notification${selectedGroups.length > 1 ? 's' : ''}`); stopSelect() }} disabled={!selected.size} aria-label="Remove" className="w-9 h-9 rounded-full flex items-center justify-center text-red-500 disabled:opacity-30"><Trash2 size={20} /></button>
        </div>
      ) : (
        <div className="bg-white px-4 pt-4 pb-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold">Notifications</h1>
              {unreadTotal > 0 ? <span className="bg-brand-purple text-white text-xs font-semibold rounded-full px-2 py-0.5">{unreadTotal > 99 ? '99+' : unreadTotal}</span> : null}
            </div>
            <div className="flex items-center -mr-2">
              <button onClick={markAllRead} disabled={unreadTotal === 0} aria-label="Mark all as read" className="w-10 h-10 rounded-full flex items-center justify-center text-gray-600 disabled:opacity-30"><CheckCheck size={21} /></button>
              <button onClick={() => setSheet({ type: 'menu' })} aria-label="More" className="w-10 h-10 rounded-full flex items-center justify-center text-gray-600"><MoreVertical size={21} /></button>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto py-2.5 -mx-4 px-4" style={{ scrollbarWidth: 'none' }}>
            {chips.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium flex items-center gap-1.5 ${filter === f.key ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-600'}`}
              >
                {f.label}
                {f.key !== 'all' && counts[f.key] > 0 ? <span className={`text-[11px] ${filter === f.key ? 'text-white/80' : 'text-gray-400'}`}>{counts[f.key]}</span> : null}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* List */}
      <div className="screen-scroll relative" ref={scrollRef} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} style={{ overscrollBehaviorY: 'contain' }}>
        <div className="absolute left-0 right-0 flex justify-center pointer-events-none z-10" style={{ top: 6, opacity: refreshing ? 1 : pullY / 60, transform: `translateY(${refreshing ? 8 : pullY - 24}px)` }}>
          <span className="w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center text-brand-purple">
            {refreshing ? <Loader2 size={18} className="animate-spin" /> : <ArrowDown size={18} style={{ transform: `rotate(${pullY >= 52 ? 180 : 0}deg)`, transition: 'transform 150ms' }} />}
          </span>
        </div>

        <div style={{ transform: `translateY(${refreshing ? 36 : pullY}px)`, transition: pullY ? 'none' : 'transform 200ms ease' }}>
          {isGuest ? (
            <div className="flex flex-col items-center text-center px-10 pt-20">
              <span className="w-20 h-20 rounded-full bg-brand-light flex items-center justify-center mb-4"><BellOff size={34} className="text-brand-purple" /></span>
              <p className="font-semibold text-lg">Notifications need an account</p>
              <p className="text-sm text-gray-400 mt-1">Create an account to get likes, comments, follows and messages here.</p>
            </div>
          ) : loading ? (
            <Skeleton />
          ) : failed ? (
            <div className="flex flex-col items-center text-center px-10 pt-20">
              <span className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4"><RefreshCw size={30} className="text-gray-400" /></span>
              <p className="font-semibold text-lg">Couldn't load notifications</p>
              <p className="text-sm text-gray-400 mt-1">Check your connection and try again.</p>
              <button onClick={() => loadFirst()} className="mt-5 bg-brand-purple text-white text-sm font-medium rounded-full px-6 py-2.5">Try again</button>
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center text-center px-10 pt-20">
              <span className="w-20 h-20 rounded-full bg-brand-light flex items-center justify-center mb-4">
                {filter === 'unread' ? <CheckCheck size={34} className="text-brand-purple" /> : <BellOff size={34} className="text-brand-purple" />}
              </span>
              <p className="font-semibold text-lg">{emptyTitle}</p>
              <p className="text-sm text-gray-400 mt-1">{emptySub}</p>
              {filter !== 'all' && items.length > 0 ? <button onClick={() => setFilter('all')} className="mt-5 bg-gray-100 text-gray-700 text-sm font-medium rounded-full px-6 py-2.5">Show all</button> : null}
            </div>
          ) : (
            <div>
              {visible.map((g) => {
                const section = sectionOf(g.created_at)
                const header = section !== lastSection ? section : null
                lastSection = section
                const actors = actorsOf(g, profiles)
                const { lead, action } = describe(g, actors)
                const post = g.post_id ? posts.get(g.post_id) : null
                const snippet = post?.content ? post.content.replace(/\s+/g, ' ').trim().slice(0, 80) : ''
                return (
                  <div key={g.key}>
                    {header ? <p className="px-4 pt-4 pb-1.5 text-[13px] font-semibold text-gray-500">{header}</p> : null}
                    <NotificationRow
                      group={g}
                      actors={actors}
                      lead={lead}
                      action={action}
                      snippet={['like', 'comment', 'reply'].includes(g.type) ? snippet : ''}
                      thumb={postThumb(post)}
                      selecting={selectMode}
                      selected={selected.has(g.key)}
                      following={following.has(actors[0]?.id)}
                      onOpen={openGroup}
                      onSelect={toggleSelect}
                      onLongPress={() => (selectMode ? toggleSelect(g) : startSelect(g))}
                      onRemove={(grp) => removeRows(grp.rows, 'ids', grp.rows.length > 1 ? `Removed ${grp.rows.length} notifications` : 'Notification removed')}
                      onToggleRead={(grp) => setRead(grp.rows, grp.unread ? true : false)}
                      onMore={(grp) => setSheet({ type: 'row', group: grp })}
                      onFollow={toggleFollow}
                    />
                  </div>
                )
              })}
              {hasMore ? (
                <div ref={sentinelRef} className="py-6 flex justify-center text-gray-300"><Loader2 size={20} className="animate-spin" /></div>
              ) : (
                <p className="text-center text-xs text-gray-300 py-6">You're all caught up</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Undo / message bar */}
      {snack ? (
        <div className="absolute left-3 right-3 z-30 bg-gray-900 text-white rounded-xl px-4 py-3 flex items-center justify-between shadow-lg" style={{ bottom: 80, animation: 'sl-snack 200ms ease-out' }}>
          <span className="text-sm">{snack.text}</span>
          {snack.undo ? <button onClick={undo} className="text-sm font-semibold text-purple-300 pl-4">Undo</button> : null}
        </div>
      ) : null}

      {/* One notification */}
      {sheet?.type === 'row' ? (() => {
        const g = sheet.group
        const actors = actorsOf(g, profiles)
        const { lead, action } = describe(g, actors)
        const path = pathFor(g)
        const person = actors.length === 1 ? actors[0] : null
        return (
          <Sheet onClose={() => setSheet(null)}>
            <p className="px-4 py-2 text-sm text-gray-500 line-clamp-2"><span className="font-semibold text-gray-700">{lead}</span>{action}</p>
            <SheetAction icon={g.unread ? MailOpen : Mail} label={g.unread ? 'Mark as read' : 'Mark as unread'} onClick={() => { setRead(g.rows, g.unread); setSheet(null) }} />
            {path ? <SheetAction icon={ExternalLink} label="Open" onClick={() => { setSheet(null); openGroup(g) }} /> : null}
            {person?.id ? <SheetAction icon={User} label={`View ${person.name.split(' ')[0]}'s profile`} onClick={() => { setSheet(null); navigate(`/users/${person.id}`) }} /> : null}
            <SheetAction icon={ListChecks} label="Select several" onClick={() => { setSheet(null); startSelect(g) }} />
            <SheetAction icon={Trash2} danger label={g.rows.length > 1 ? `Remove these ${g.rows.length}` : 'Remove this notification'} onClick={() => { setSheet(null); removeRows(g.rows, 'ids', g.rows.length > 1 ? `Removed ${g.rows.length} notifications` : 'Notification removed') }} />
          </Sheet>
        )
      })() : null}

      {/* Menu */}
      {sheet?.type === 'menu' ? (
        <Sheet onClose={() => setSheet(null)}>
          <SheetAction icon={ListChecks} label="Select notifications" onClick={() => { setSheet(null); startSelect(null) }} />
          <SheetAction icon={CheckCheck} label="Mark all as read" onClick={markAllRead} />
          {hasRead ? <SheetAction icon={Trash2} label="Clear read notifications" onClick={() => { setSheet(null); removeRows(items.filter((r) => r.read), 'read', 'Cleared read notifications') }} /> : null}
          {items.length > 0 ? <SheetAction icon={Trash2} danger label="Clear all notifications" onClick={() => setSheet({ type: 'clear' })} /> : null}
          <SheetAction icon={Settings} label="Notification settings" onClick={() => { setSheet(null); navigate('/settings/notifications') }} />
        </Sheet>
      ) : null}

      {/* Clear all */}
      {sheet?.type === 'clear' ? (
        <Sheet onClose={() => setSheet(null)}>
          <p className="font-semibold text-lg px-4 pt-2">Clear all notifications?</p>
          <p className="text-sm text-gray-500 px-4 mt-1">This removes everything from your list. You will have a few seconds to undo.</p>
          <button onClick={() => { setSheet(null); removeRows(items, 'all', 'All notifications cleared') }} className="w-[calc(100%-16px)] mx-2 mt-5 bg-red-500 text-white font-semibold py-3.5 rounded-full">Clear all</button>
          <button onClick={() => setSheet(null)} className="w-full mt-1 py-3.5 text-gray-600 font-medium">Cancel</button>
        </Sheet>
      ) : null}

      <BottomNav />
    </div>
  )
    }
