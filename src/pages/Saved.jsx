import { Bookmark } from 'lucide-react'
import { useEffect, useState } from 'react'
import BackHeader from '../components/BackHeader.jsx'
import BottomNav from '../components/BottomNav.jsx'
import PostCard from '../components/PostCard.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

const tabs = ['Posts', 'Articles', 'Events', 'Files']

export default function Saved() {
  const { user } = useAuth()
  const [tab, setTab] = useState('Posts')
  const [savedPosts, setSavedPosts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase
      .from('saved_posts')
      .select('post_id, posts(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setSavedPosts((data ?? []).map((row) => row.posts).filter(Boolean))
        setLoading(false)
      })
  }, [user])

  return (
    <div className="app-shell">
      <BackHeader title="Saved" />
      <div className="flex px-4 gap-6 border-b border-gray-100">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`py-2 text-sm font-medium border-b-2 ${
              tab === t ? 'border-brand-purple text-brand-purple' : 'border-transparent text-gray-400'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="screen-scroll px-4 space-y-4 pt-4">
        {tab !== 'Posts' ? (
          <p className="text-center text-gray-400 mt-10">No saved {tab.toLowerCase()} yet.</p>
        ) : loading ? (
          <p className="text-center text-gray-400 mt-10">Loading…</p>
        ) : savedPosts.length === 0 ? (
          <p className="text-center text-gray-400 mt-10">Nothing saved yet — tap the bookmark icon on a post to save it.</p>
        ) : (
          savedPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onDeleted={(id) => setSavedPosts((prev) => prev.filter((p) => p.id !== id))}
            />
          )))
        )}
      </div>

      <BottomNav />
    </div>
  )
        }
