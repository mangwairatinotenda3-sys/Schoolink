import { Bell, Menu, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import BottomNav from '../components/BottomNav.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const shortcuts = ['Your School', 'Science Club', 'Sports Club', 'Parents', 'Alumni']

export default function Home() {
  const { profile } = useAuth()
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
          <span className="relative">
            <Bell size={20} />
            <span className="absolute -top-1 -right-1 bg-red-500 rounded-full w-3.5 h-3.5 text-[9px] flex items-center justify-center">
              3
            </span>
          </span>
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

        <div className="mx-4 rounded-xl border border-gray-100 p-4">
          <p className="font-semibold">Springfield High School</p>
          <p className="text-sm text-gray-500">Harare, Zimbabwe</p>
          <div className="flex gap-6 mt-3 text-sm">
            <span><b>1.2K</b> Followers</span>
            <span><b>320</b> Staff</span>
            <span><b>2.3K</b> Students</span>
          </div>
        </div>

        <div className="px-4 mt-4 space-y-4">
          {loading ? (
            <p className="text-center text-gray-400 mt-8">Loading posts…</p>
          ) : posts.length === 0 ? (
            <div className="text-center text-gray-400 mt-8">
              <p>No posts yet.</p>
              <p className="text-sm">
                Once you connect Supabase and add rows to the{' '}
                <code className="text-brand-purple">posts</code> table, they’ll show up here.
              </p>
            </div>
          ) : (
            posts.map((post) => (
              <div key={post.id} className="border border-gray-100 rounded-xl p-4">
                <p className="font-semibold">{post.author_name}</p>
                <p className="text-xs text-gray-400 mb-2">{post.author_role}</p>
                <p className="text-sm">{post.content}</p>
              </div>
            ))
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
