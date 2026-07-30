import { Bell, Menu, Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient.js'
import BottomNav from '../components/BottomNav.jsx'
import PostCard from '../components/PostCard.jsx'
import SideDrawer from '../components/SideDrawer.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useUnreadCount } from '../lib/useUnreadCount.js'

const shortcuts = ['Your School', 'Science Club', 'Sports Club', 'Parents', 'Alumni']

export default function Home() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const unread = useUnreadCount()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [school, setSchool] = useState(null)
  const [memberCount, setMemberCount] = useState(0)

  useEffect(() => {
    supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setPosts(data ?? [])
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (!profile?.school_id) {
      setSchool(null)
      return
    }
    supabase
      .from('schools')
      .select('*')
      .eq('id', profile.school_id)
      .maybeSingle()
      .then(({ data }) => setSchool(data))

    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', profile.school_id)
      .eq('status', 'active')
      .then(({ count }) => setMemberCount(count ?? 0))
  }, [profile?.school_id])

  function handleShortcut(label) {
    if (label === 'Your School') {
      navigate(profile?.school_id ? '/school-profile' : '/onboarding/account-type')
    }
  }

  const visiblePosts = searchQuery.trim()
    ? posts.filter(
        (p) =>
          p.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.author_name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : posts

  return (
    <div className="flex-1 flex flex-col">
      <div className="bg-brand-navy text-white px-4 pt-4 pb-3 flex items-center justify-between">
        <button onClick={() => setDrawerOpen(true)}>
          <Menu size={22} />
        </button>
        <h1 className="font-bold text-lg">Schoolink</h1>
        <div className="flex items-center gap-4">
          <button onClick={() => setSearchOpen((s) => !s)}>
            <Search size={20} />
          </button>
          <button onClick={() => navigate('/notifications')} className="relative">
            <Bell size={20} />
            {unread > 0 ? (
              <span className="absolute -top-1 -right-1 bg-red-500 rounded-full w-3.5 h-3.5 text-[9px] flex items-center justify-center">
                {unread > 9 ? '9+' : unread}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      {searchOpen ? (
        <div className="px-4 py-2 bg-white border-b border-gray-100 flex items-center gap-2">
          <input
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search posts or people…"
            className="flex-1 border border-gray-200 rounded-full px-4 py-2 text-sm outline-brand-purple"
          />
          <button
            onClick={() => {
              setSearchOpen(false)
              setSearchQuery('')
            }}
          >
            <X size={18} className="text-gray-400" />
          </button>
        </div>
      ) : null}

      <div className="screen-scroll">
        <div className="flex gap-4 px-4 py-4 overflow-x-auto">
          {shortcuts.map((s) => (
            <button key={s} onClick={() => handleShortcut(s)} className="flex flex-col items-center gap-1 shrink-0">
              <span className="w-14 h-14 rounded-full bg-brand-light flex items-center justify-center text-xl">
                🎓
              </span>
              <span className="text-[11px] text-gray-500 max-w-[56px] text-center">{s}</span>
            </button>
          ))}
        </div>

        {school ? (
          <div className="mx-4 rounded-xl border border-gray-100 p-4">
            <p className="font-semibold">{school.name}</p>
            <p className="text-sm text-gray-500">{school.location}</p>
            <div className="flex gap-6 mt-3 text-sm">
              <span><b>{memberCount}</b> Members</span>
              <span className="text-gray-400">{school.school_type}</span>
            </div>
          </div>
        ) : null}

        <div className="px-4 mt-4 space-y-4">
          {loading ? (
            <p className="text-center text-gray-400 mt-8">Loading posts…</p>
          ) : visiblePosts.length === 0 ? (
            <div className="text-center text-gray-400 mt-8">
              {searchQuery ? (
                <p>No posts match "{searchQuery}".</p>
              ) : (
                <>
                  <p>No posts yet.</p>
                  <p className="text-sm">Be the first to share something with your school.</p>
                </>
              )}
            </div>
          ) : (
            visiblePosts.map((post) => <PostCard key={post.id} post={post} />)
          )}
        </div>
      </div>

      <SideDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <BottomNav />
    </div>
  )
        }
