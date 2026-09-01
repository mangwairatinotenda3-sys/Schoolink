import { useEffect, useState } from 'react'
import BackHeader from '../components/BackHeader.jsx'
import BottomNav from '../components/BottomNav.jsx'
import PostCard from '../components/PostCard.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function MyPosts() {
  const { user } = useAuth()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    loadPosts()
  }, [user])

  async function loadPosts() {
    setLoading(true)
    const { data } = await supabase
      .from('posts')
      .select('*')
      .eq('author_id', user.id)
      .order('created_at', { ascending: false })
    setPosts(data ?? [])
    setLoading(false)
  }

  function handleDeleted(postId) {
    setPosts((prev) => prev.filter((p) => p.id !== postId))
  }

  return (
    <div className="app-shell">
      <BackHeader title="My Posts" />
      <div className="screen-scroll px-4 pt-3 space-y-4">
        {loading ? (
          <p className="text-center text-gray-400 mt-8">Loading…</p>
        ) : posts.length === 0 ? (
          <div className="text-center text-gray-400 mt-8">
            <p>You haven't posted anything yet.</p>
            <p className="text-sm">Tap the composer on Home to share something.</p>
          </div>
        ) : (
          posts.map((post) => <PostCard key={post.id} post={post} onDeleted={handleDeleted} />)
        )}
      </div>
      <BottomNav />
    </div>
  )
        }
