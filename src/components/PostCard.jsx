import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, MessageCircle, Bookmark, Send, MoreVertical, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import PhotoViewer from './PhotoViewer.jsx'

export default function PostCard({ post, onDeleted, expandComments }) {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [likeCount, setLikeCount] = useState(0)
  const [liked, setLiked] = useState(false)
  const [saved, setSaved] = useState(false)
  const [following, setFollowing] = useState(false)
  const [comments, setComments] = useState([])
  const [showComments, setShowComments] = useState(!!expandComments)
  const [commentText, setCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [viewerOpen, setViewerOpen] = useState(false)

  const isMine = user && post.author_id === user.id

  useEffect(() => {
    loadLikes()
    loadSaved()
    loadFollow()
    if (expandComments) loadComments()
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

  async function toggleLike(e) {
    e.stopPropagation()
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

  async function toggleSave(e) {
    e.stopPropagation()
    if (!user) return
    if (saved) {
      await supabase.from('saved_posts').delete().eq('post_id', post.id).eq('user_id', user.id)
      setSaved(false)
    } else {
      await supabase.from('saved_posts').insert({ post_id: post.id, user_id: user.id })
      setSaved(true)
    }
  }

  async function toggleFollow(e) {
    e.stopPropagation()
    if (!user || !post.author_id) return
    if (following) {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('followed_id', post.author_id)
      setFollowing(false)
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, followed_id: post.author_id })
      setFollowing(true)
    }
  }

  async function handleToggleComments(e) {
    e.stopPropagation()
    setShowComments((s) => !s)
    if (!showComments) await loadComments()
  }

  async function submitComment(e) {
    e.stopPropagation()
    if (!commentText.trim() || !user || submittingComment) return
    setSubmittingComment(true)
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
    setSubmittingComment(false)
  }

  async function handleDelete(e) {
    e.stopPropagation()
    setMenuOpen(false)
    if (!window.confirm('Delete this post? This cannot be undone.')) return
    setDeleting(true)
    const { error } = await supabase.from('posts').delete().eq('id', post.id)
    setDeleting(false)
    if (!error) {
      onDeleted ? onDeleted(post.id) : navigate(-1)
    }
  }

  function goToPost() {
    if (!expandComments) navigate(`/post/${post.id}`)
  }

  return (
    <div
      className={`border border-gray-100 rounded-xl p-4 ${deleting ? 'opacity-40' : ''}`}
      onClick={goToPost}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold truncate">{post.author_name}</p>
          <p className="text-xs text-gray-400 truncate">{post.author_role}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
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
          {isMine ? (
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setMenuOpen((m) => !m)}>
                <MoreVertical size={18} className="text-gray-400" />
              </button>
              {menuOpen ? (
                <div className="absolute right-0 top-6 bg-white border border-gray-100 rounded-lg shadow-lg z-10 w-32">
                  <button
                    onClick={handleDelete}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-500"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {post.category && post.category !== 'General' ? (
        <span className="inline-block mt-2 text-[10px] font-medium px-2 py-0.5 rounded-full bg-brand-light text-brand-purple">
          {post.category}
        </span>
      ) : null}

      {post.content ? <p className="text-sm mt-2">{post.content}</p> : null}

      {post.image_url ? (
        <img
          src={post.image_url}
          alt=""
          className="w-full rounded-xl mt-2 max-h-80 object-cover cursor-pointer"
          onClick={(e) => {
            e.stopPropagation()
            setViewerOpen(true)
          }}
        />
      ) : null}

      <div className="flex items-center gap-5 mt-3 text-gray-500" onClick={(e) => e.stopPropagation()}>
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
        <div className="mt-3 border-t border-gray-100 pt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
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
                onClick={(e) => e.stopPropagation()}
                placeholder="Write a comment…"
                className="flex-1 border border-gray-200 rounded-full px-3 py-1.5 text-sm outline-brand-purple"
              />
              <button onClick={submitComment} disabled={submittingComment}>
                <Send size={18} className={submittingComment ? 'text-gray-300' : 'text-brand-purple'} />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {viewerOpen ? (
        <PhotoViewer
          imageUrl={post.image_url}
          postId={post.id}
          onClose={() => setViewerOpen(false)}
        />
      ) : null}
    </div>
  )
                                 }
