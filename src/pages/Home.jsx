import { Bell, Menu, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import BottomNav from '../components/BottomNav.jsx'
import PostCard from '../components/PostCard.jsx'

const shortcuts = ['Your School', 'Science Club', 'Sports Club', 'Parents', 'Alumni']

export default function Home() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setPosts(data ?? [])
        setLoading(false)
      })
  }, [])

  return (
    <div className="flex-1 flex flex-col">
      <div className="bg-brand-navy text-white px-4 pt-4 pb-3 flex items-center justify-between">
        <Menu size={22} />
        <h1 className="font-bold text-lg">Schoolink</h1>
        <div className="flex items-center gap-4">
          <Search size={20} />
          <Bell size={20} />
        </div>
      </div>

      <div className="screen-scroll">
        <div className="flex gap-4 px-4 py-4 overflow-x-auto">
          {shortcuts.map((s) => (
            <div key={s} className="flex flex-col items-center gap-1 shrink-0">
              <span className="w-14 h-14 rounded-full bg-brand-light flex items-center justify-center text-xl">
                🎓
              </span>
              <span className="text-[11px] text-gray-500 max-w-[56px] text-center">{s}</span>
            </div>
          ))}
        </div>

        <div className="px-4 mt-2 space-y-4">
          {loading ? (
            <p className="text-center text-gray-400 mt-8">Loading posts…</p>
          ) : posts.length === 0 ? (
            <div className="text-center text-gray-400 mt-8">
              <p>No posts yet.</p>
              <p className="text-sm">Be the first to share something with your school.</p>
            </div>
          ) : (
            posts.map((post) => <PostCard key={post.id} post={post} />)
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  )
          }
