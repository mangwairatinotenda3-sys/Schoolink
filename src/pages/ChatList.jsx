import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, MessageSquarePlus, Pin, PinOff, Archive, ArchiveRestore, Users, Search, X, BellOff, Bell, Check, CheckCheck, ChevronLeft, MessageCircle, Info } from 'lucide-react'
import BottomNav from '../components/BottomNav.jsx'
import AvatarViewer from '../components/AvatarViewer.jsx'
import BottomSheet, { SheetAction } from '../components/BottomSheet.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useIsOnline } from '../lib/presence.jsx'

const FILTERS = ['All', 'Unread', 'Direct', 'Groups']

function timeLabel(dateString) {
  if (!dateString) return ''
  const d = new Date(dateString)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const days = Math.floor((startOfToday - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000)
  if (days <= 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (days === 1) return 'Yesterday'
  if (days < 7) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function previewOf(m) {
  if (m.deleted_at) return '🚫 Message deleted'
  if (m.media_type === 'image') return m.content ? `📷 ${m.content}` : '📷 Photo'
  if (m.media_type === 'video') return '🎥 Video'
  if (m.media_type === 'audio') return '🎤 Voice message'
  if (m.media_type === 'file') return `📎 ${m.content || 'File'}`
  return m.content || '📷 Media'
}

function Avatar({ item, onTap }) {
  const isOnline = useIsOnline(item.type === 'direct' ? item.id : null)
  return (
    <button onClick={(e) => { e.stopPropagation(); onTap(item.avatarUrl) }} aria-label={`${item.name} photo`} className="relative shrink-0">
      {item.avatarUrl ? (
        <img src={item.avatarUrl} alt="" className="w-[52px] h-[52px] rounded-full object-cover" />
      ) : item.type === 'community' ? (
        <span className="w-[52px] h-[52px] rounded-full bg-brand-light flex items-center justify-center"><Users size={21} className="text-brand-purple" /></span>
      ) : (
        <span className="w-[52px] h-[52px] rounded-full bg-brand-light flex items-center justify-center text-brand-purple font-semibold text-lg">{(item.name || '?').slice(0, 1).toUpperCase()}</span>
      )}
      {item.type === 'direct' && isOnline ? <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-white" /> : null}
    </button>
  )
}

function Row({ item, onOpen, onMenu, onAvatarTap }) {
  const timer = useRef(null)
  const start = useRef({ x: 0, y: 0 })
  const longPressed = useRef(false)
  const unread = item.unread && !item.muted

  function down(e) {
    longPressed.current = false
    start.current = { x: e.clientX, y: e.clientY }
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      longPressed.current = true
      try { navigator.vibrate?.(12) } catch { /* not supported */ }
      onMenu(item)
    }, 450)
  }
  function move(e) {
    if (Math.abs(e.clientX - start.current.x) > 8 || Math.abs(e.clientY - start.current.y) > 8) clearTimeout(timer.current)
  }
  function up() { clearTimeout(timer.current) }

  const subtitle = item.lastMessage
    ? item.lastMessage
    : item.type === 'community' ? `${item.memberCount ?? 0} members` : 'Say hello 👋'

  return (
    <div
      role="button"
      tabIndex={0}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onPointerLeave={up}
      onContextMenu={(e) => { e.preventDefault(); onMenu(item) }}
      onClick={() => { if (longPressed.current) { longPressed.current = false; return } onOpen(item) }}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(item) }}
      className="flex items-center gap-3.5 px-4 py-3 active:bg-gray-50 cursor-pointer select-none"
    >
      <Avatar item={item} onTap={onAvatarTap} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={`text-[16px] truncate flex items-center gap-1.5 ${unread ? 'font-semibold' : 'font-medium'}`}>
            <span className="truncate">{item.name}</span>
            {item.role ? <span className="text-[10px] font-medium bg-brand-light text-brand-purple px-1.5 py-0.5 rounded-full shrink-0">{item.role}</span> : null}
          </p>
          <span className={`text-[12px] shrink-0 ${unread ? 'text-brand-purple font-semibold' : 'text-gray-400'}`}>{timeLabel(item.lastTime)}</span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className={`text-[14px] truncate flex items-center gap-1 min-w-0 ${unread ? 'text-gray-800' : 'text-gray-400'}`}>
            {item.lastMine ? (item.lastRead ? <CheckCheck size={15} className="text-brand-purple shrink-0" /> : <Check size={15} className="text-gray-400 shrink-0" />) : null}
            <span className="truncate">{item.lastMine && item.type === 'community' ? 'You: ' : ''}{subtitle}</span>
          </p>
          <span className="flex items-center gap-1.5 shrink-0">
            {item.muted ? <BellOff size={14} className="text-gray-400" /> : null}
            {item.pinned ? <Pin size={14} className="text-gray-400 rotate-45" /> : null}
            {item.unread ? (
              item.unreadCount > 0 ? (
                <span className={`min-w-[20px] h-5 px-1.5 rounded-full text-white text-[11px] font-semibold flex items-center justify-center ${item.muted ? 'bg-gray-300' : 'bg-brand-purple'}`}>{item.unreadCount > 99 ? '99+' : item.unreadCount}</span>
              ) : !item.muted ? <span className="w-2.5 h-2.5 rounded-full bg-brand-purple" /> : null
            ) : null}
          </span>
        </div>
      </div>
    </div>
  )
}

function SkeletonRows() {
  return (
    <div aria-hidden="true">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3.5 px-4 py-3 animate-pulse">
          <span className="w-[52px] h-[52px] rounded-full bg-gray-100 shrink-0" />
          <span className="flex-1 space-y-2.5">
            <span className="block h-3.5 w-1/2 rounded bg-gray-100" />
            <span className="block h-3 w-4/5 rounded bg-gray-100" />
          </span>
        </div>
      ))}
    </div>
  )
}

export default function ChatList() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [tab, setTab] = useState('All')
  const [query, setQuery] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false)
  const [viewingAvatar, setViewingAvatar] = useState(null)
  const [menu, setMenu] = useState(null)
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (!user) return undefined
    loadAll(true)
    const channel = supabase
      .channel(`chatlist-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => loadAll(false))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user])

  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(''), 2200)
    return () => clearTimeout(t)
  }, [toast])

  async function loadAll(showSpinner = true) {
    if (showSpinner) setLoading(true)

    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false })

    const byPartner = new Map()
    for (const m of messages ?? []) {
      const partnerId = m.sender_id === user.id ? m.receiver_id : m.sender_id
      if (!byPartner.has(partnerId)) {
        byPartner.set(partnerId, { type: 'direct', id: partnerId, lastMessage: previewOf(m), lastMine: m.sender_id === user.id, lastRead: !!m.read, lastTime: m.created_at, unread: false, unreadCount: 0 })
      }
      if (m.receiver_id === user.id && !m.read && !m.deleted_at) {
        const conv = byPartner.get(partnerId)
        conv.unreadCount += 1
        conv.unread = true
      }
    }

    const partnerIds = [...byPartner.keys()]
    if (partnerIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, full_name, avatar_url, role').in('id', partnerIds)
      for (const p of profiles ?? []) {
        const conv = byPartner.get(p.id)
        conv.name = p.full_name || 'Schoolink member'
        conv.avatarUrl = p.avatar_url
        conv.role = p.role
      }

      const { data: settingsRows } = await supabase.from('chat_settings').select('*').eq('user_id', user.id).in('partner_id', partnerIds)
      for (const s of settingsRows ?? []) {
        const conv = byPartner.get(s.partner_id)
        if (conv) { conv.pinned = s.pinned; conv.archived = s.archived; conv.muted = s.muted }
      }
    }

    const { data: memberships } = await supabase.from('community_members').select('community_id').eq('user_id', user.id)
    const communityIds = (memberships ?? []).map((m) => m.community_id)
    const communityItems = []
    if (communityIds.length > 0) {
      const { data: communities } = await supabase.from('communities').select('*').in('id', communityIds)
      const { data: reads } = await supabase.from('community_reads').select('community_id, last_read_at').eq('user_id', user.id).in('community_id', communityIds)
      const readMap = new Map((reads ?? []).map((r) => [r.community_id, r.last_read_at]))
      for (const c of communities ?? []) {
        const { count } = await supabase.from('community_members').select('*', { count: 'exact', head: true }).eq('community_id', c.id)
        const { data: lastMsg } = await supabase.from('community_messages').select('*').eq('community_id', c.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
        const lastRead = readMap.get(c.id) || '1970-01-01T00:00:00.000Z'
        const { count: unreadCount } = await supabase
          .from('community_messages')
          .select('*', { count: 'exact', head: true })
          .eq('community_id', c.id)
          .eq('status', 'approved')
          .neq('sender_id', user.id)
          .gt('created_at', lastRead)
        communityItems.push({
          type: 'community', id: c.id, name: c.name, avatarUrl: c.avatar_url, memberCount: count ?? 0,
          lastMessage: lastMsg ? previewOf(lastMsg) : '', lastTime: lastMsg?.created_at || c.created_at,
          unread: (unreadCount ?? 0) > 0,
          unreadCount: unreadCount ?? 0,
          lastMine: lastMsg?.sender_id === user.id,
        })
      }
    }

    const combined = [...byPartner.values(), ...communityItems].sort((a, b) => new Date(b.lastTime || 0) - new Date(a.lastTime || 0))
    setItems(combined)
    setLoading(false)
  }

  function open(item) {
    navigate(item.type === 'community' ? `/communities/${item.id}` : `/chats/${item.id}`)
  }

  async function changeSetting(item, field, value, doneText) {
    setMenu(null)
    setItems((prev) => prev.map((i) => (i.type === item.type && i.id === item.id ? { ...i, [field]: value } : i)))
    const { error } = await supabase.from('chat_settings').upsert({ user_id: user.id, partner_id: item.id, [field]: value })
    if (error) {
      setItems((prev) => prev.map((i) => (i.type === item.type && i.id === item.id ? { ...i, [field]: !value } : i)))
      setToast("Couldn't save that. Try again.")
      return
    }
    setToast(doneText)
  }

  const archivedCount = items.filter((i) => i.archived).length
  const unreadTotal = items.filter((i) => !i.archived && i.unread && !i.muted).length

  const visible = useMemo(() => {
    let list = items.filter((i) => !!i.archived === showArchived)
    if (tab === 'Unread') list = list.filter((i) => i.unread && !i.muted)
    if (tab === 'Groups') list = list.filter((i) => i.type === 'community')
    if (tab === 'Direct') list = list.filter((i) => i.type === 'direct')
    const q = query.trim().toLowerCase()
    if (q) list = list.filter((i) => i.name?.toLowerCase().includes(q))
    return list.slice().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
  }, [items, showArchived, tab, query])

  const canPin = (i) => i.type === 'direct'

  return (
    <div className="app-shell">
      <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
        {showArchived ? (
          <div className="flex items-center gap-1 -ml-2">
            <button onClick={() => setShowArchived(false)} aria-label="Back to chats" className="w-10 h-10 rounded-full flex items-center justify-center"><ChevronLeft size={24} /></button>
            <h1 className="font-bold text-[22px]">Archived</h1>
          </div>
        ) : (
          <h1 className="font-bold text-[28px] leading-none">Chats</h1>
        )}
        <button onClick={() => navigate('/statuses/create')} aria-label="Add status" className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center active:opacity-70"><Camera size={20} /></button>
      </div>

      <div className="px-4 pb-2 shrink-0">
        <div className="relative">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats"
            aria-label="Search chats"
            className="w-full bg-gray-100 rounded-full pl-10 pr-10 py-2.5 text-[15px] outline-none focus:ring-2 focus:ring-brand-purple/40"
          />
          {query ? <button onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2"><X size={17} className="text-gray-400" /></button> : null}
        </div>
      </div>

      {!showArchived ? (
        <div className="flex gap-2 px-4 pb-2 overflow-x-auto shrink-0">
          {FILTERS.map((t) => {
            const on = tab === t
            return (
              <button key={t} onClick={() => setTab(t)} className={`shrink-0 px-4 py-1.5 rounded-full text-[13.5px] font-semibold flex items-center gap-1.5 ${on ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-600'}`}>
                {t}
                {t === 'Unread' && unreadTotal > 0 ? <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[11px] flex items-center justify-center ${on ? 'bg-white/25 text-white' : 'bg-brand-purple text-white'}`}>{unreadTotal}</span> : null}
              </button>
            )
          })}
        </div>
      ) : null}

      <div className="screen-scroll">
        {!showArchived && archivedCount > 0 && !query.trim() ? (
          <button onClick={() => setShowArchived(true)} className="w-full flex items-center gap-3.5 px-4 py-3 active:bg-gray-50">
            <span className="w-[52px] h-[52px] flex items-center justify-center"><Archive size={21} className="text-gray-500" /></span>
            <span className="flex-1 text-left font-medium text-[16px]">Archived</span>
            <span className="text-[13px] text-gray-400">{archivedCount}</span>
          </button>
        ) : null}

        {loading ? (
          <SkeletonRows />
        ) : visible.length === 0 ? (
          <div className="text-center px-10 pt-16">
            <span className="w-20 h-20 rounded-full bg-brand-light mx-auto flex items-center justify-center mb-4">
              {query.trim() ? <Search size={30} className="text-brand-purple" /> : <MessageCircle size={32} className="text-brand-purple" />}
            </span>
            <p className="font-semibold text-lg">
              {query.trim() ? 'No chats found' : showArchived ? 'No archived chats' : tab === 'Unread' ? "You're all caught up" : tab === 'Groups' ? 'No groups yet' : 'No conversations yet'}
            </p>
            <p className="text-sm text-gray-400 mt-1.5">
              {query.trim() ? `Nothing matches “${query.trim()}”.` : showArchived ? 'Chats you archive show up here.' : tab === 'Unread' ? 'No unread messages.' : 'Start a chat with someone from your school.'}
            </p>
            {!query.trim() && !showArchived && tab !== 'Unread' ? (
              <button onClick={() => navigate('/chats/new')} className="mt-5 bg-brand-purple text-white font-semibold rounded-full px-7 py-3 active:opacity-80">Start a chat</button>
            ) : null}
          </div>
        ) : (
          visible.map((item) => <Row key={`${item.type}-${item.id}`} item={item} onOpen={open} onMenu={setMenu} onAvatarTap={(url) => url && setViewingAvatar(url)} />)
        )}
      </div>

      <button
        onClick={() => navigate('/chats/new')}
        aria-label="New chat"
        className="absolute bottom-24 right-4 w-14 h-14 rounded-2xl bg-brand-purple flex items-center justify-center shadow-lg active:scale-95 transition-transform"
      >
        <MessageSquarePlus size={24} className="text-white" />
      </button>

      {menu ? (
        <BottomSheet onClose={() => setMenu(null)}>
          <div className="flex items-center gap-3 px-4 pb-2">
            {menu.avatarUrl ? <img src={menu.avatarUrl} alt="" className="w-11 h-11 rounded-full object-cover" /> : <span className="w-11 h-11 rounded-full bg-brand-light flex items-center justify-center">{menu.type === 'community' ? <Users size={18} className="text-brand-purple" /> : <span className="text-brand-purple font-semibold">{(menu.name || '?').slice(0, 1).toUpperCase()}</span>}</span>}
            <p className="font-semibold truncate">{menu.name}</p>
          </div>
          <SheetAction icon={MessageCircle} label="Open chat" onClick={() => { setMenu(null); open(menu) }} />
          {canPin(menu) ? (
            <>
              <SheetAction icon={menu.pinned ? PinOff : Pin} label={menu.pinned ? 'Unpin chat' : 'Pin chat'} onClick={() => changeSetting(menu, 'pinned', !menu.pinned, menu.pinned ? 'Chat unpinned' : 'Chat pinned')} />
              <SheetAction icon={menu.muted ? Bell : BellOff} label={menu.muted ? 'Unmute notifications' : 'Mute notifications'} onClick={() => changeSetting(menu, 'muted', !menu.muted, menu.muted ? 'Unmuted' : 'Muted')} />
              <SheetAction icon={menu.archived ? ArchiveRestore : Archive} label={menu.archived ? 'Unarchive chat' : 'Archive chat'} onClick={() => changeSetting(menu, 'archived', !menu.archived, menu.archived ? 'Chat unarchived' : 'Chat archived')} />
              <SheetAction icon={Info} label="Chat options" onClick={() => { setMenu(null); navigate(`/chats/${menu.id}/options`) }} />
            </>
          ) : (
            <SheetAction icon={Info} label="Community info" onClick={() => { setMenu(null); navigate(`/communities/${menu.id}/info`) }} />
          )}
        </BottomSheet>
      ) : null}

      {toast ? <div className="absolute left-1/2 -translate-x-1/2 z-[70] bg-gray-900 text-white text-sm rounded-full px-4 py-2 shadow-lg" style={{ bottom: 100 }}>{toast}</div> : null}

      {viewingAvatar ? <AvatarViewer imageUrl={viewingAvatar} onClose={() => setViewingAvatar(null)} /> : null}

      <BottomNav />
    </div>
  )
        }
