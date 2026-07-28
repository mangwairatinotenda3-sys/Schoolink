import { useEffect, useState } from 'react'
import { Heart, MessageCircle, Bookmark, Send } from 'lucide-react'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function PostCard({ post }) {
  const { user, profile } = useAuth()
  const [likeCount, setLikeCount] = useState(0)
  const [liked, setLiked] = useState(false)
  const [saved, setSaved] = useState(false)
  const [following, setFollowing] = useState(false)
  const [comments, setComments] = useState([])
  const [showComments, setShowComments] = useState(false)
  const [commentText, setCommentText] = useState('')

  useEffect(() => {
    loadLikes()
    loadSaved()
    loadFollow()
  }, [])

  async function loadLikes() {
    const { count } = await supabase
      .from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', post.id)
    setLikeCount(count ?? 0)

    if (user) {
      const { data } = await supabase
        .from('likes')
        .select('*')
        .eq('post_id', post.id)
        .eq('user_id', user.id)
        .maybeSingle()
      setLiked(!!data)
    }
  }

  async function loadSaved() {
    if (!user) return
    const { data } = await supabase
      .from('saved_posts')
      .select('*')
      .eq('post_id', post.id)
      .eq('user_id', user.id)
      .maybeSingle()
    setSaved(!!data)
  }

  async function loadFollow() {
    if (!user || !post.author_id || post.author_id === user.id) return
    const { data } = await supabase
      .from('follows')
      .select('*')
      .eq('follower_id', user.id)
      .eq('followed_id', post.author_id)
      .maybeSingle()
    setFollowing(!!data)
  }

  async function loadComments() {
    const { data } = await supabase
      .from('comments')
      .select('*')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true })
    setComments(data ?? [])
  }

  async function toggleLike() {
    if (!user) return
    if (liked) {
      await supabase.from('likes').delete().eq('post_id', post.id).eq('user_id', user.id)
      setLiked(false)
      setLikeCount((c) => c - 1)
    } else {
      await supabase.from('likes').insert({ post_id: post.id, user_id: user.id })
      setLiked(true)
      setLikeCount((c) => c + 1)
    }
  }

  async function toggleSave() {
    if (!user) return
    if (saved) {
      await supabase.from('saved_posts').delete().eq('post_id', post.id).eq('user_id', user.id)
      setSaved(false)
    } else {
      await supabase.from('saved_posts').insert({ post_id: post.id, user_id: user.id })
      setSaved(true)
    }
  }

  async function toggleFollow() {
    if (!user || !post.author_id) return
    if (following) {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('followed_id', post.author_id)
      setFollowing(false)
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, followed_id: post.author_id })
      setFollowing(true)
    }
  }

  async function handleToggleComments() {
    setShowComments((s) => !s)
    if (!showComments) await loadComments()
  }

  async function submitComment() {
    if (!commentText.trim() || !user) return
    const { data, error } = await supabase
      .from('comments')
      .insert({
        post_id: post.id,
        author_id: user.id,
        author_name: profile?.full_name || user.email,
        content: commentText,
      })
      .select()
      .maybeSingle()
    if (!error && data) {
      setComments((c) => [...c, data])
      setCommentText('')
    }
  }

  return (
    <div className="border border-gray-100 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold">{post.author_name}</p>
          <p className="text-xs text-gray-400">{post.author_role}</p>
        </div>
        {user && post.author_id !== user.id ? (
          <button
            onClick={toggleFollow}
            className={`text-xs font-medium px-3 py-1 rounded-full border ${
              following ? 'text-gray-400 border-gray-200' : 'text-brand-purple border-brand-purple'
            }`}
          >
            {following ? 'Following' : 'Follow'}
          </button>
        ) : null}
      </div>

      <p className="text-sm mt-2">{post.content}</p>

      <div className="flex items-center gap-5 mt-3 text-gray-500">
        <button onClick={toggleLike} className="flex items-center gap-1 text-sm">
          <Heart size={18} className={liked ? 'text-red-500' : ''} fill={liked ? 'currentColor' : 'none'} />
          {likeCount}
        </button>
        <button onClick={handleToggleComments} className="flex items-center gap-1 text-sm">
          <MessageCircle size={18} />
          {comments.length || ''}
        </button>
        <button onClick={toggleSave} className="ml-auto">
          <Bookmark size={18} className={saved ? 'text-brand-purple' : ''} fill={saved ? 'currentColor' : 'none'} />
        </button>
      </div>

      {showComments ? (
        <div className="mt-3 border-t border-gray-100 pt-3 space-y-2">
          {comments.map((c) => (
            <div key={c.id} className="text-sm">
              <span className="font-medium">{c.author_name}</span>{' '}
              <span className="text-gray-600">{c.content}</span>
            </div>
          ))}
          {user ? (
            <div className="flex items-center gap-2 mt-2">
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write a comment…"
                className="flex-1 border border-gray-200 rounded-full px-3 py-1.5 text-sm outline-brand-purple"
              />
              <button onClick={submitComment}>
                <Send size={18} className="text-brand-purple" />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
  }
