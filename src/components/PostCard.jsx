import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, MessageCircle, Bookmark, Send, MoreVertical, Trash2, Download } from 'lucide-react'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import PhotoViewer from './PhotoViewer.jsx'
import PostVideo from './PostVideo.jsx'
import VerifiedBadge from './VerifiedBadge.jsx'
import { fileExtension } from '../lib/mediaTools.js'

function timeAgo(iso) {
  if (!iso) return ''
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' })
}

const LINK_PATTERN = /(https?:\/\/[^\s]*[^\s.,!?;:)]|www\.[^\s]*[^\s.,!?;:)])/gi

// Web addresses in a post become tappable links.
function linkify(text) {
  return text.split(LINK_PATTERN).map((part, i) => {
    if (i % 2 === 1) {
      const href = part.toLowerCase().startsWith('http') ? part : `https://${part}`
      return <a key={i} href={href} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-brand-purple underline break-all">{part}</a>
    }
    return <span key={i}>{part}</span>
  })
}

// One photo, or a neat grid for several: 2 side by side, 3 with one big, 4 or more as a square with "+N".
function PhotoGrid({ images, onOpen }) {
  const shown = images.slice(0, 4)
  const extra = images.length - 4
  if (images.length === 1) {
    return <img src={images[0]} alt="" loading="lazy" className="w-full max-h-[28rem] object-cover" onClick={(e) => onOpen(e, 0)} />
  }
  const layout = images.length === 2 ? 'grid-cols-2 h-60' : images.length === 3 ? 'grid-cols-2 grid-rows-2 h-72' : 'grid-cols-2 grid-rows-2 h-72'
  return (
    <div className={`grid gap-0.5 ${layout}`}>
      {shown.map((url, i) => (
        <div key={url + i} className={`relative overflow-hidden bg-gray-100 ${images.length === 3 && i === 0 ? 'row-span-2' : ''}`}>
          <img src={url} alt="" loading="lazy" className="w-full h-full object-cover" onClick={(e) => onOpen(e, i)} />
          {i === 3 && extra > 0 ? (
            <button onClick={(e) => onOpen(e, 3)} className="absolute inset-0 bg-black/55 text-white text-2xl font-semibold flex items-center justify-center">+{extra}</button>
          ) : null}
        </div>
      ))}
    </div>
  )
}

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
  const [viewerIndex, setViewerIndex] = useState(null)
  const [expanded, setExpanded] = useState(false)
  const [burst, setBurst] = useState(false)
  const lastMediaTap = useRef(0)

  const isMine = user && post.author_id === user.id
  const images = post.image_urls && post.image_urls.length > 0 ? post.image_urls : post.image_url ? [post.image_url] : []

  useEffect(() => {
    loadLikes()
    loadSaved()
    loadFollow()
    if (expandComments) loadComments()
  }, [])

  async function loadLikes() {
    const { count } = await supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', post.id)
    setLikeCount(count ?? 0)
    if (user) {
      const { data } = await supabase.from('likes').select('*').eq('post_id', post.id).eq('user_id', user.id).maybeSingle()
      setLiked(!!data)
    }
  }

  async function loadSaved() {
    if (!user) return
    const { data } = await supabase.from('saved_posts').select('*').eq('post_id', post.id).eq('user_id', user.id).maybeSingle()
    setSaved(!!data)
  }

  async function loadFollow() {
    if (!user || !post.author_id || post.author_id === user.id) return
    const { data } = await supabase.from('follows').select('*').eq('follower_id', user.id).eq('followed_id', post.author_id).maybeSingle()
    setFollowing(!!data)
  }

  async function loadComments() {
    const { data } = await supabase.from('comments').select('*').eq('post_id', post.id).order('created_at', { ascending: true })
    setComments(data ?? [])
  }

  async function toggleLike(e) {
    e.stopPropagation()
    if (!user) return
    if (liked) {
      await supabase.from('likes').delete().eq('post_id', post.id).eq('user_id', user.id)
      setLiked(false); setLikeCount((c) => c - 1)
    } else {
      await supabase.from('likes').insert({ post_id: post.id, user_id: user.id })
      setLiked(true); setLikeCount((c) => c + 1)
    }
  }

  // Tap a photo to open it; double-tap it to like the post.
  function handlePhotoTap(e, index) {
    e.stopPropagation()
    const now = Date.now()
    if (now - lastMediaTap.current < 320) {
      lastMediaTap.current = 0
      if (!liked) toggleLike(e)
      setBurst(true)
      setTimeout(() => setBurst(false), 700)
      return
    }
    lastMediaTap.current = now
    setTimeout(() => {
      if (lastMediaTap.current === now) setViewerIndex(index)
    }, 330)
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
    const { data, error } = await supabase.from('comments').insert({
      post_id: post.id, author_id: user.id, author_name: profile?.full_name || user.email, content: commentText,
    }).select().maybeSingle()
    if (!error && data) { setComments((c) => [...c, data]); setCommentText('') }
    setSubmittingComment(false)
  }

  async function handleDelete(e) {
    e.stopPropagation()
    setMenuOpen(false)
    if (!window.confirm('Delete this post? This cannot be undone.')) return
    setDeleting(true)
    const { error } = await supabase.from('posts').delete().eq('id', post.id)
    setDeleting(false)
    if (!error) onDeleted ? onDeleted(post.id) : navigate(-1)
  }

  function goToPost() {
    if (!expandComments) navigate(`/post/${post.id}`)
  }

  function goToAuthorProfile(e) {
    e.stopPropagation()
    if (post.author_id) navigate(`/users/${post.author_id}`)
  }

  return (
    <div className={`border border-gray-100 rounded-xl p-4 ${deleting ? 'opacity-40' : ''}`} onClick={goToPost}>
      <div className="flex items-center justify-between gap-2">
        <button onClick={goToAuthorProfile} className="min-w-0 text-left">
          <div className="flex items-center gap-1 min-w-0"><span className="font-semibold truncate hover:underline">{post.author_name}</span><VerifiedBadge userId={post.author_id} size={15} /></div>
          <p className="text-xs text-gray-400 truncate">{post.author_role}{post.author_role && post.created_at ? ' · ' : ''}{timeAgo(post.created_at)}</p>
        </button>
        <div className="flex items-center gap-2 shrink-0">
          {user && post.author_id !== user.id ? (
            <button onClick={toggleFollow} className={`text-xs font-medium px-3 py-1 rounded-full border ${following ? 'text-gray-400 border-gray-200' : 'text-brand-purple border-brand-purple'}`}>
              {following ? 'Following' : 'Follow'}
            </button>
          ) : null}
          {isMine ? (
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setMenuOpen((m) => !m)}><MoreVertical size={18} className="text-gray-400" /></button>
              {menuOpen ? (
                <div className="absolute right-0 top-6 bg-white border-gray-100 rounded-lg shadow-lg z-10 w-32">
                  <button onClick={handleDelete} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-500"><Trash2 size={14} /> Delete</button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {post.category && post.category !== 'General' ? (
        <span className="inline-block mt-2 text-[10px] font-medium px-2 py-0.5 rounded-full bg-brand-light text-brand-purple">{post.category}</span>
      ) : null}

      {post.content ? (
        <div className="mt-2">
          <p className={`text-sm whitespace-pre-wrap break-words ${expanded || expandComments ? '' : 'line-clamp-5'}`}>{linkify(post.content)}</p>
          {!expanded && !expandComments && post.content.length > 240 ? (
            <button onClick={(e) => { e.stopPropagation(); setExpanded(true) }} className="text-xs font-medium text-gray-400 mt-0.5">more</button>
          ) : null}
        </div>
      ) : null}

      {images.length > 0 ? (
        <div className="relative mt-2 rounded-xl overflow-hidden cursor-pointer">
          <PhotoGrid images={images} onOpen={handlePhotoTap} />
          {burst ? <Heart size={84} fill="currentColor" className="absolute inset-0 m-auto text-white drop-shadow-lg animate-ping pointer-events-none" /> : null}
        </div>
      ) : null}

      {post.video_url ? (
        <PostVideo src={post.video_url} />
      ) : null}

      {post.file_url ? (
        <a
          href={post.file_url}
          target="_blank"
          rel="noreferrer"
          download={post.file_name || undefined}
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-3 mt-2 border border-gray-100 rounded-xl p-3"
        >
          <span className="w-11 h-11 rounded-lg bg-brand-light text-brand-purple flex items-center justify-center text-[11px] font-bold shrink-0">{fileExtension(post.file_name)}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium truncate">{post.file_name || 'Shared file'}</span>
            <span className="block text-xs text-gray-400">Tap to open</span>
          </span>
          <Download size={18} className="text-gray-400 shrink-0" />
        </a>
      ) : null}

      <div className="flex items-center gap-5 mt-3 text-gray-500" onClick={(e) => e.stopPropagation()}>
        <button onClick={toggleLike} className="flex items-center gap-1 text-sm">
          <Heart size={18} className={liked ? 'text-red-500' : ''} fill={liked ? 'currentColor' : 'none'} /> {likeCount}
        </button>
        <button onClick={handleToggleComments} className="flex items-center gap-1 text-sm">
          <MessageCircle size={18} /> {comments.length || ''}
        </button>
        <button onClick={toggleSave} className="ml-auto">
          <Bookmark size={18} className={saved ? 'text-brand-purple' : ''} fill={saved ? 'currentColor' : 'none'} />
        </button>
      </div>

      {showComments ? (
        <div className="mt-3 border-t border-gray-100 pt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
          {comments.map((c) => (
            <div key={c.id} className="text-sm">
              <span className="font-medium inline-flex items-center gap-1">{c.author_name}<VerifiedBadge userId={c.author_id} size={13} /></span> <span className="text-gray-600">{c.content}</span>
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

      {viewerIndex !== null ? (
        <PhotoViewer
          images={images}
          initialIndex={viewerIndex}
          postId={post.id}
          onClose={() => setViewerIndex(null)}
        />
      ) : null}
    </div>
  )
  }
