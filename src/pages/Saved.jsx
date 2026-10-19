import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bookmark, CalendarDays, MessageSquare, Paperclip, MapPin, Star, Image as ImageIcon, Film, Mic } from 'lucide-react'
import BottomNav from '../components/BottomNav.jsx'
import PostCard from '../components/PostCard.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

const TABS = [
  { id: 'posts', label: 'Posts', icon: Bookmark },
  { id: 'events', label: 'Events', icon: CalendarDays },
  { id: 'messages', label: 'Messages', icon: MessageSquare },
  { id: 'files', label: 'Files', icon: Paperclip },
]

const EMPTY = {
  posts: ['No saved posts', 'Tap the bookmark on any post to keep it here.'],
  events: ['No events yet', "Events you're going to appear here."],
  messages: ['No starred messages', 'Long-press a message in a chat and tap Star.'],
  files: ['No saved files', 'Starred photos, videos and files show up here.'],
}

function Skeleton() {
  return (
    <div className="px-4 space-y-3 animate-pulse" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => <div key={i} className="h-20 rounded-2xl bg-gray-100" />)}
    </div>
  )
}

export default function Saved() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [tab, setTab] = useState('posts')
  const [posts, setPosts] = useState([])
  const [events, setEvents] = useState([])
  const [starred, setStarred] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    setLoading(true)
    const [postsRes, rsvpRes, starRes] = await Promise.all([
      supabase.from('saved_posts').select('post_id, posts(*)').eq('user_id', user.id),
      supabase.from('event_rsvps').select('event_id, events(*)').eq('user_id', user.id),
      supabase.from('starred_messages').select('*, messages(*)').eq('user_id', user.id),
    ])

    setPosts((postsRes.data ?? []).filter((r) => r.posts))
    setEvents((rsvpRes.data ?? []).map((r) => r.events).filter(Boolean).sort((a, b) => new Date(a.event_date) - new Date(b.event_date)))

    const rows = (starRes.data ?? []).filter((r) => r.messages)
    const partnerIds = [...new Set(rows.map((r) => (r.messages.sender_id === user.id ? r.messages.receiver_id : r.messages.sender_id)))]
    let names = new Map()
    if (partnerIds.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', partnerIds)
      names = new Map((profs ?? []).map((p) => [p.id, p]))
    }
    setStarred(rows.map((r) => {
      const m = r.messages
      const partnerId = m.sender_id === user.id ? m.receiver_id : m.sender_id
      return { ...r, message: m, partnerId, partner: names.get(partnerId) }
    }).sort((a, b) => new Date(b.message.created_at) - new Date(a.message.created_at)))
    setLoading(false)
  }

  async function unstar(item) {
    setStarred((prev) => prev.filter((s) => s.message.id !== item.message.id))
    await supabase.from('starred_messages').delete().eq('user_id', user.id).eq('message_id', item.message.id)
  }

  const messageRows = starred.filter((s) => !s.message.media_type || s.message.media_type === 'text')
  const fileRows = starred.filter((s) => s.message.media_type && s.message.media_type !== 'text')
  const counts = { posts: posts.length, events: events.length, messages: messageRows.length, files: fileRows.length }

  const mediaIcon = (t) => (t === 'image' ? ImageIcon : t === 'video' ? Film : t === 'audio' ? Mic : Paperclip)

  function StarRow({ s }) {
    const m = s.message
    const Icon = mediaIcon(m.media_type)
    return (
      <div className="bg-gray-50 rounded-2xl p-3.5 active:bg-gray-100">
        <div className="flex items-center gap-2.5 mb-2">
          {s.partner?.avatar_url ? <img src={s.partner.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" /> : <span className="w-7 h-7 rounded-full bg-brand-light text-brand-purple text-xs font-semibold flex items-center justify-center">{(s.partner?.full_name || '?').slice(0, 1).toUpperCase()}</span>}
          <p className="text-[13px] font-semibold truncate flex-1">{m.sender_id === user.id ? 'You' : s.partner?.full_name || 'Schoolink member'}</p>
          <span className="text-[11px] text-gray-400">{new Date(m.created_at).toLocaleDateString([], { day: 'numeric', month: 'short' })}</span>
        </div>
        <button onClick={() => navigate(`/chats/${s.partnerId}`)} className="w-full text-left">
          {m.media_type === 'image' && m.media_url ? <img src={m.media_url} alt="" className="w-full max-h-56 object-cover rounded-xl mb-2" /> : null}
          {m.media_type && m.media_type !== 'text' && m.media_type !== 'image' ? (
            <span className="flex items-center gap-2 text-[14px] text-gray-700"><Icon size={17} className="text-brand-purple" />{m.media_type === 'audio' ? 'Voice message' : m.media_type === 'video' ? 'Video' : m.content || 'File'}</span>
          ) : null}
          {m.content && m.media_type !== 'file' ? <p className="text-[14.5px] text-gray-800 line-clamp-4 break-words">{m.content}</p> : null}
        </button>
        <div className="flex justify-between items-center mt-2.5">
          <button onClick={() => navigate(`/chats/${s.partnerId}`)} className="text-[12.5px] font-semibold text-brand-purple">Go to chat</button>
          <button onClick={() => unstar(s)} className="text-[12.5px] text-gray-500 flex items-center gap-1"><Star size={14} className="fill-yellow-400 text-yellow-400" />Unstar</button>
        </div>
      </div>
    )
  }

  const emptyKey = counts[tab] === 0

  return (
    <div className="app-shell">
      <div className="px-4 pt-4 pb-2 shrink-0">
        <h1 className="font-bold text-[28px] leading-none">Saved</h1>
        <p className="text-sm text-gray-400 mt-1">{counts.posts + counts.events + counts.messages + counts.files} items</p>
      </div>

      <div className="flex gap-2 px-4 pb-3 overflow-x-auto shrink-0">
        {TABS.map((t) => {
          const on = tab === t.id
          const Icon = t.icon
          return (
            <button key={t.id} onClick={() => setTab(t.id)} className={`shrink-0 px-4 py-1.5 rounded-full text-[13.5px] font-semibold flex items-center gap-1.5 ${on ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-600'}`}>
              <Icon size={15} />{t.label}
              {counts[t.id] > 0 ? <span className={`text-[11px] ${on ? 'text-white/80' : 'text-gray-400'}`}>{counts[t.id]}</span> : null}
            </button>
          )
        })}
      </div>

      <div className="screen-scroll">
        {loading ? <Skeleton /> : emptyKey ? (
          <div className="text-center px-10 pt-16">
            <span className="w-20 h-20 rounded-full bg-brand-light mx-auto flex items-center justify-center mb-4"><Bookmark size={30} className="text-brand-purple" /></span>
            <p className="font-semibold text-lg">{EMPTY[tab][0]}</p>
            <p className="text-sm text-gray-400 mt-1.5">{EMPTY[tab][1]}</p>
          </div>
        ) : tab === 'posts' ? (
          <div>{posts.map((r) => <PostCard key={r.post_id} post={r.posts} onDeleted={() => setPosts((p) => p.filter((x) => x.post_id !== r.post_id))} />)}</div>
        ) : tab === 'events' ? (
          <div className="px-4 space-y-3">
            {events.map((e) => {
              const d = new Date(e.event_date)
              const past = d < new Date()
              return (
                <button key={e.id} onClick={() => navigate('/calendar')} className={`w-full flex gap-3.5 bg-gray-50 rounded-2xl p-3.5 text-left active:bg-gray-100 ${past ? 'opacity-60' : ''}`}>
                  <span className="w-14 shrink-0 rounded-xl bg-brand-purple text-white flex flex-col items-center justify-center py-1.5">
                    <span className="text-[11px] uppercase font-semibold opacity-90">{d.toLocaleDateString([], { month: 'short' })}</span>
                    <span className="text-xl font-bold leading-none">{d.getDate()}</span>
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold truncate">{e.title}</span>
                    <span className="block text-[13px] text-gray-500 mt-0.5">{d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{past ? ' · Ended' : ''}</span>
                    {e.location ? <span className="flex items-center gap-1 text-[13px] text-gray-500 mt-0.5 truncate"><MapPin size={13} />{e.location}</span> : null}
                  </span>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="px-4 space-y-3">{(tab === 'messages' ? messageRows : fileRows).map((s) => <StarRow key={s.message.id} s={s} />)}</div>
        )}
      </div>
      <BottomNav />
    </div>
  )
   }
