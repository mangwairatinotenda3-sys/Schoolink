import { Bell, Menu, Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient.js'
import BottomNav from '../components/BottomNav.jsx'
import PostCard from '../components/PostCard.jsx'
import SideDrawer from '../components/SideDrawer.jsx'
import ComposerBar from '../components/ComposerBar.jsx'
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
        setPosts(data?? [])
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
     .then(({ count }) => setMemberCount(count?? 0))
  }, [profile?.school_id])

  function handleShortcut(label) {
    if (label === 'Your School') {
      navigate(profile?.school_id? '/school-profile' : '/onboarding/account-type')
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
    <div className="app-shell">
      <div className="bg-brand-navy text-white px-4 pt-4 pb-3 flex items-center justify-between">
        <button onClick={() => setDrawerOpen(true)}>
          <Menu size={22} />
        </button>
        <h1 className="font-bold text-lg">Schoolink</h1>
        <div className="flex items-center gap-4">
          <button onClick={() => setSearchOpen((s) =>!s)}>
            <Search size={20} />
          </button>
          <button onClick={() => navigate('/notifications')} className="relative">
            <Bell size={20} />
            {unread > 0? (
              <span className="absolute -top-1 -right-1 bg-red-500 rounded-full w-3.5 h-3.5 text-[9px] flex items-center justify-center">
                {unread > 9? '9+' : unread}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      {searchOpen? (
