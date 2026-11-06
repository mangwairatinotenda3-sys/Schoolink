import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, MessageCircle, Bookmark, Send, MoreVertical, Trash2, Download, Flag, MapPin } from 'lucide-react'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import PhotoViewer from './PhotoViewer.jsx'
import PostVideo from './PostVideo.jsx'
import VerifiedBadge from './VerifiedBadge.jsx'
import ReportSheet from './ReportSheet.jsx'
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

// Every person gets their own steady colour, so a missing photo still looks friendly.
const PALETTE = ['#7C3AED', '#0EA5E9', '#16A34A', '#EA580C', '#DB2777', '#0D9488', '#CA8A04', '#4F46E5']

function colorOf(key) {
  const s = String(key || '')
  let h = 0
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

// Soft tint of a colour that works on both the light and the dark theme.
const tint = (hex, alpha = 0.14) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

// One profile-photo lookup per author, shared by every card on the screen.
const avatarCache = new Map()
function loadAvatar(authorId) {
  if (!authorId) return Promise.resolve(null)
  if (!avatarCache.has(authorId)) {
    avatarCache.set(
      authorId,
      supabase.from('profiles').select('avatar_url').eq('id', authorId).maybeSingle().then(({ data }) => data?.avatar_url || null, () => null),
    )
  }
  return avatarCache.get(authorId)
}

function AuthorAvatar({ url, name, id, size = 42 }) {
  if (url) return <img src={url} alt="" loading="lazy" className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />
  return (
    <span
      className="rounded-full text-white font-semibold flex items-center justify-center shrink-0"
      style={{ width: size, height: size, background: colorOf(id || name), fontSize: size * 0.42 }}
    >
      {(name || '?').trim().slice(0, 1).toUpperCase()}
    </span>
  )
}

// One photo, or a neat grid for several: 2 side by side, 3 with one big, 4 or more as a square with "+N".
function PhotoGrid({ images, onOpen }) {
  const shown = images.slice(0, 4)
  const extra = images.length - 4
  if (images.length === 1) {
    return <img src={images[0]} alt="" loading="lazy" className="w-full max-h-[28rem] object-cover" onClick={(e) => onOpen(e, 0)} />
  }
  const layout = images.length === 2 ? 'grid-cols-2 h-60' : 'grid-cols-2 grid-rows-2 h-72'
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
  const [reportTarget, setReportTarget] = useState(null) // { type, id, authorId, authorName }
  const [deleting, setDeleting] = useState(false)
  const [viewerIndex, setViewerIndex] = useState(null)
  const [expanded, setExpanded] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(null)
  const lastMediaTap = useRef(0)

  const isMine = user && post.author_id === user.id
  const images = post.image_urls && post.image_urls.length > 0 ? post.image_urls : post.image_url ? [post.image_url] : []
  const categoryColor = colorOf(post.category)

  useEffect(() => {
    loadLikes()
    loadSaved()
    loadFollow()
    if (expandComments) loadComments()
  }, [])

  useEffect(() => {
    let live = true
    loadAvatar(post.author_id).then((url) => { if (live) setAvatarUrl(url) })
    return () => { live = false }
  }, [post.author_id])

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

  const iconBtn = 'h-10 px-3 rounded-full flex items-center gap-1.5 text-sm font-medium active:bg-black/5'

  return (
    <div
      className={`rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden ${deleting ? 'opacity-40' : ''}`}
      style={{ WebkitTapHighlightColor: 'transparent' }}
      onClick={goToPost}
    >
      {/* Who posted it */}
      <div className="flex items-center gap-3 px-4 pt-4">
        <button onClick={goToAuthorProfile} className="shrink-0" aria-label={`Open ${post.author_name || 'profile'}`}>
          <AuthorAvatar url={avatarUrl} name={post.author_name} id={post.author_id} />
        </button>
        <button onClick={goToAuthorProfile} className="min-w-0 flex-1 text-left">
          <span className="flex items-center gap-1 min-w-0">
            <span className="font-semibold text-[15px] text-gray-900 truncate">{post.author_name}</span>
            <VerifiedBadge userId={post.author_id} size={15} />
          </span>
          <span className="flex items-center gap-1.5 text-xs text-gray-400 min-w-0">
            {post.author_role ? (
              <span className="font-medium rounded-full px-2 py-px shrink-0" style={{ background: tint(colorOf(post.author_role), 0.14), color: colorOf(post.author_role) }}>
                {post.author_role}
              </span>
            ) : null}
            <span className="shrink-0">{timeAgo(post.created_at)}</span>
            {post.location ? (
              <span className="flex items-center gap-0.5 min-w-0">
                <MapPin size={11} className="shrink-0" />
                <span className="truncate">{post.location}</span>
              </span>
            ) : null}
          </span>
        </button>

        <div className="flex items-center gap-1 shrink-0">
          {user && post.author_id !== user.id ? (
            <button
              onClick={toggleFollow}
              className="text-xs font-semibold px-3.5 h-8 rounded-full"
              style={following
                ? { background: 'transparent', color: 'var(--text-muted, #9CA3AF)', border: '1px solid rgba(156,163,175,0.5)' }
                : { background: 'var(--brand-purple)', color: '#fff', border: '1px solid var(--brand-purple)' }}
            >
              {following ? 'Following' : 'Follow'}
            </button>
          ) : null}
          {user ? (
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setMenuOpen((m) => !m)} aria-label="More" className="w-9 h-9 rounded-full flex items-center justify-center active:bg-black/5">
                <MoreVertical size={18} className="text-gray-400" />
              </button>
              {menuOpen ? (
                <div className="absolute right-0 top-10 bg-white border border-gray-100 rounded-xl shadow-lg z-10 w-40 overflow-hidden">
                  {isMine ? (
                    <button onClick={handleDelete} className="w-full flex items-center gap-2 px-3 py-3 text-sm text-red-500"><Trash2 size={15} /> Delete post</button>
                  ) : (
                    <button
                      onClick={() => { setMenuOpen(false); setReportTarget({ type: 'post', id: post.id, authorId: post.author_id, authorName: post.author_name }) }}
                      className="w-full flex items-center gap-2 px-3 py-3 text-sm text-red-500"
                    >
                      <Flag size={15} /> Report post
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {/* Words */}
      <div className="px-4">
        {post.category && post.category !== 'General' ? (
          <span
            className="inline-block mt-3 text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
            style={{ background: tint(categoryColor, 0.14), color: categoryColor }}
          >
            {post.category}
          </span>
        ) : null}

        {post.content ? (
          <div className="mt-2.5">
            <p className={`text-[15px] leading-relaxed text-gray-800 whitespace-pre-wrap break-words ${expanded || expandComments ? '' : 'line-clamp-5'}`}>{linkify(post.content)}</p>
            {!expanded && !expandComments && post.content.length > 240 ? (
              <button onClick={(e) => { e.stopPropagation(); setExpanded(true) }} className="text-sm font-semibold text-brand-purple mt-0.5">Read more</button>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Pictures, video, files */}
      {images.length > 0 ? (
        <div className="mt-3 overflow-hidden cursor-pointer">
          <PhotoGrid images={images} onOpen={handlePhotoTap} />
        </div>
      ) : null}

      {post.video_url ? (
        <div className="mt-3 px-4"><PostVideo src={post.video_url} /></div>
      ) : null}

      {post.file_url ? (
        <div className="px-4">
          <a
            href={post.file_url}
            target="_blank"
            rel="noreferrer"
            download={post.file_name || undefined}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-3 mt-3 border border-gray-100 rounded-xl p-3 active:bg-black/5"
          >
            <span className="w-11 h-11 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0" style={{ background: tint('#7C3AED', 0.14), color: '#7C3AED' }}>{fileExtension(post.file_name)}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-gray-800 truncate">{post.file_name || 'Shared file'}</span>
              <span className="block text-xs text-gray-400">Tap to open</span>
            </span>
            <Download size={18} className="text-gray-400 shrink-0" />
          </a>
        </div>
      ) : null}

      {/* Like, comment, save */}
      <div className="flex items-center gap-1 px-2 pt-2 pb-2" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={toggleLike}
          aria-label={liked ? 'Unlike' : 'Like'}
          className={iconBtn}
          style={liked ? { background: tint('#EF4444', 0.12), color: '#EF4444' } : { color: 'var(--text-secondary, #6B7280)' }}
        >
          <Heart size={19} fill={liked ? 'currentColor' : 'none'} /> {likeCount}
        </button>
        <button
          onClick={handleToggleComments}
          aria-label="Comments"
          className={iconBtn}
          style={showComments ? { background: tint('#7C3AED', 0.12), color: '#7C3AED' } : { color: 'var(--text-secondary, #6B7280)' }}
        >
          <MessageCircle size={19} /> {comments.length || ''}
        </button>
        <button
          onClick={toggleSave}
          aria-label={saved ? 'Remove from saved' : 'Save'}
          className={`${iconBtn} ml-auto`}
          style={saved ? { background: tint('#F59E0B', 0.14), color: '#D97706' } : { color: 'var(--text-secondary, #6B7280)' }}
        >
          <Bookmark size={19} fill={saved ? 'currentColor' : 'none'} />
        </button>
      </div>

      {/* Comments */}
      {showComments ? (
        <div className="border-t border-gray-100 px-4 py-3 space-y-2.5" onClick={(e) => e.stopPropagation()}>
          {comments.map((c) => (
            <div key={c.id} className="flex items-start gap-2.5">
              <span
                className="w-7 h-7 rounded-full text-white text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: colorOf(c.author_id || c.author_name) }}
              >
                {(c.author_name || '?').trim().slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1 rounded-2xl px-3 py-2 bg-gray-50">
                <span className="flex items-center gap-1 text-[13px] font-semibold text-gray-900">
                  <span className="truncate">{c.author_name}</span>
                  <VerifiedBadge userId={c.author_id} size={13} />
                  {user && c.author_id !== user.id ? (
                    <button
                      onClick={() => setReportTarget({ type: 'comment', id: c.id, authorId: c.author_id, authorName: c.author_name })}
                      aria-label="Report comment"
                      className="ml-auto p-1 text-gray-300 active:text-red-500"
                    >
                      <Flag size={12} />
                    </button>
                  ) : null}
                </span>
                <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{c.content}</p>
              </div>
            </div>
          ))}

          {post.comments_off ? (
            <p className="text-xs text-gray-400 text-center py-1">Comments are turned off for this post.</p>
          ) : user ? (
            <div className="flex items-center gap-2 pt-1">
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Write a comment…"
                className="flex-1 border border-gray-200 rounded-full px-4 py-2 text-sm outline-brand-purple"
              />
              <button
                onClick={submitComment}
                disabled={submittingComment || !commentText.trim()}
                aria-label="Send comment"
                className="w-9 h-9 rounded-full flex items-center justify-center text-white disabled:opacity-40"
                style={{ background: 'var(--brand-purple)' }}
              >
                <Send size={16} />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {reportTarget ? (
        <ReportSheet
          contentType={reportTarget.type}
          contentId={reportTarget.id}
          blockUserId={reportTarget.authorId}
          blockName={(reportTarget.authorName || '').split(' ')[0]}
          onClose={() => setReportTarget(null)}
        />
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
