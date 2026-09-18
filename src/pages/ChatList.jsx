import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Plus, Pin, Archive, Users, Search } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import BottomNav from '../components/BottomNav.jsx'
import AvatarViewer from '../components/AvatarViewer.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useIsOnline } from '../lib/presence.jsx'

function timeAgo(dateString) {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
  if (seconds < 60) return 'now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

function Row({ item, navigate, onAvatarTap }) {
  const isOnline = useIsOnline(item.type === 'direct' ? item.id : null)

  return (
    <div className="flex items-center gap-3 py-3">
      <button
        onClick={(e) => { e.stopPropagation(); onAvatarTap(item.avatarUrl) }}
        className="relative shrink-0"
      >
        {item.avatarUrl ? (
          <img src={item.avatarUrl} alt="" className="w-12 h-12 rounded-full object-cover" />
        ) : item.type === 'community' ? (
          <span className="w-12 h-12 rounded-full bg-brand-light flex items-center justify-center"><Users size={18} className="text-brand-purple" /></span>
        ) : (
          <span className="w-12 h-12 rounded-full bg-brand-light flex items-center justify-center text-xl">🙂</span>
        )}
        {item.type === 'direct' && isOnline ? <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-white" /> : null}
      </button>

      <button
        onClick={() => navigate(item.type === 'community' ? `/communities/${item.id}` : `/chats/${item.id}`)}
        className="flex-1 min-w-0 text-left"
      >
        <p className="font-medium text-sm truncate flex items-center gap-1">
          {item.pinned ? <Pin size={11} className="text-brand-purple shrink-0" /> : null}
          {item.name}
          {item.role ? <span className="ml-1 text-[10px] font-medium bg-brand-light text-brand-purple px-1.5 py-0.5 rounded-full shrink-0">{item.role}</span> : null}
        </p>
        <p className={`text-xs truncate ${item.unread && !item.muted ? 'text-brand-navy font-medium' : 'text-gray-400'}`}>{item.lastMessage || (item.type === 'community' ? `${item.memberCount ?? 0} members` : '')}</p>
      </button>

      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-[10px] text-gray-400">{item.lastTime ? timeAgo(item.lastTime) : ''}</span>
        {item.unread && !item.muted ? <span className="w-2 h-2 rounded-full bg-brand-purple" /> : null}
      </div>
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

  useEffect(() => {
    if (!user) return
    loadAll()
  }, [user])

  async function loadAll() {
    setLoading(true)

    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false })

    const byPartner = new Map()
    for (const m of messages ?? []) {
      const partnerId = m.sender_id === user.id ? m.receiver_id : m.sender_id
      if (!byPartner.has(partnerId)) {
        byPartner.set(partnerId, { type: 'direct', id: partnerId, lastMessage: m.content || '📷 Media', lastTime: m.created_at, unread: m.receiver_id === user.id && !m.read })
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
      for (const c of communities ?? []) {
        const { count } = await supabase.from('community_members').select('*', { count: 'exact', head: true }).eq('community_id', c.id)
        const { data: lastMsg } = await supabase.from('community_messages').select('*').eq('community_id', c.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
        communityItems.push({
          type: 'community', id: c.id, name: c.name, avatarUrl: c.avatar_url, memberCount: count ?? 0,
          lastMessage: lastMsg?.content || (lastMsg?.media_type ? '📷 Media' : ''), lastTime: lastMsg?.created_at || c.created_at,
        })
      }
    }

    const combined = [...byPartner.values(), ...communityItems].sort((a, b) => new Date(b.lastTime || 0) - new Date(a.lastTime || 0))
    setItems(combined)
    setLoading(false)
  }

  let visible = items.filter((i) => !!i.archived === showArchived)
  if (tab === 'Unread') visible = visible.filter((i) => i.unread && !i.muted)
  if (tab === 'Groups') visible = visible.filter((i) => i.type === 'community')
  if (tab === 'Direct') visible = visible.filter((i) => i.type === 'direct')
  if (query.trim()) visible = visible.filter((i) => i.name?.toLowerCase().includes(query.toLowerCase().trim()))
  visible = visible.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))

  return (
    <div className="app-shell">
      <div className="flex items-center justify-between px-4 py-4">
        <h1 className="font-bold text-lg">Chats</h1>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/statuses/create')}><Camera size={20} /></button>
        </div>
      </div>

      <div className="px-4 pb-2">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats…"
            className="w-full border border-gray-200 rounded-full pl-9 pr-4 py-2.5 text-sm outline-brand-purple"
          />
        </div>
      </div>

      <div className="flex gap-2 px-4 pb-2 overflow-x-auto">
        {['All', 'Unread', 'Direct', 'Groups'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border ${tab === t ? 'bg-brand-purple text-white border-brand-purple' : 'border-gray-200 text-gray-600'}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex gap-4 px-4 pb-2">
        {[{ key: false, label: 'Active' }, { key: true, label: 'Archived' }].map((t) => (
          <button key={t.label} onClick={() => setShowArchived(t.key)} className={`text-xs font-medium flex items-center gap-1 ${showArchived === t.key ? 'text-brand-purple' : 'text-gray-400'}`}>
            {t.key ? <Archive size={12} /> : null} {t.label}
          </button>
        ))}
      </div>

      <div className="screen-scroll px-4 divide-y divide-gray-100">
        {loading ? (
          <p className="text-center text-gray-400 mt-8">Loading…</p>
        ) : visible.length === 0 ? (
          <div className="text-center text-gray-400 mt-8">
            <p>{showArchived ? 'No archived chats.' : 'No conversations yet.'}</p>
            {!showArchived ? <p className="text-sm">Tap the button below to start one.</p> : null}
          </div>
        ) : (
          visible.map((item) => <Row key={`${item.type}-${item.id}`} item={item} navigate={navigate} onAvatarTap={setViewingAvatar} />)
        )}
      </div>

      <button
        onClick={() => navigate('/chats/new')}
        className="absolute bottom-24 right-4 w-14 h-14 rounded-full bg-brand-purple flex items-center justify-center shadow-lg"
      >
        <Plus size={24} className="text-white" />
      </button>

      {viewingAvatar ? <AvatarViewer imageUrl={viewingAvatar} onClose={() => setViewingAvatar(null)} /> : null}

      <BottomNav />
    </div>
  )
        }
