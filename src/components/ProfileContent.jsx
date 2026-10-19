import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Link2, MapPin, GraduationCap, ChevronRight, Loader2, ImageOff, FileText, CalendarDays, BadgeCheck, Play, Layers } from 'lucide-react'
import PostCard from './PostCard.jsx'
import PhotoViewer from './PhotoViewer.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { postThumb } from '../lib/notificationUtils.js'

const PAGE = 12
const TABS = ['Posts', 'Media', 'About']

function photosOf(post) {
  let urls = post.image_urls
  if (typeof urls === 'string') {
    try { urls = JSON.parse(urls) } catch { urls = null }
  }
  if (Array.isArray(urls) && urls.length) return urls
  return post.image_url ? [post.image_url] : []
}

function Row({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0"><Icon size={17} className="text-gray-500" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
        <div className="text-sm text-gray-800 mt-0.5 break-words">{children}</div>
      </div>
    </div>
  )
}

// The tabs under a profile: Posts, Media and About. Used for your own profile and for other people's.
export default function ProfileContent({ userId, person, school, isMe, canSeePosts, joined, stickyTop = 52, onPostsCount }) {
  const navigate = useNavigate()
  const [tab, setTab] = useState('Posts')
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [moreLoading, setMoreLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [viewer, setViewer] = useState(null)
  const sentinel = useRef(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setPosts([])
      if (!canSeePosts) { setLoading(false); return }
      setLoading(true)
      const { data } = await supabase.from('posts').select('*').eq('author_id', userId).order('created_at', { ascending: false }).range(0, PAGE - 1)
      if (cancelled) return
      setPosts(data ?? [])
      setHasMore((data ?? []).length === PAGE)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [userId, canSeePosts])

  async function loadMore() {
    if (moreLoading || !hasMore) return
    setMoreLoading(true)
    const { data } = await supabase.from('posts').select('*').eq('author_id', userId).order('created_at', { ascending: false }).range(posts.length, posts.length + PAGE - 1)
    setPosts((prev) => {
      const have = new Set(prev.map((p) => p.id))
      return [...prev, ...(data ?? []).filter((p) => !have.has(p.id))]
    })
    setHasMore((data ?? []).length === PAGE)
    setMoreLoading(false)
  }

  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasMore || tab === 'About') return undefined
    const io = new IntersectionObserver((entries) => { if (entries[0].isIntersecting) loadMore() }, { rootMargin: '400px' })
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, posts.length, tab, moreLoading])

  const media = useMemo(() => {
    const out = []
    posts.forEach((p) => photosOf(p).forEach((url) => out.push({ url, postId: p.id })))
    return out
  }, [posts])

  // One tile per post with a photo or video, newest first, like a TikTok profile grid.
  const tiles = useMemo(() => {
    let next = 0
    const out = []
    posts.forEach((p) => {
      const photos = photosOf(p)
      const first = next
      next += photos.length
      if (photos.length === 0 && !p.video_url) return
      out.push({ post: p, photos, first })
    })
    return out
  }, [posts])

  const links = (person?.links || '').split('\n').map((l) => l.trim()).filter(Boolean)
  const tabs = canSeePosts ? TABS : ['About']
  const active = tabs.includes(tab) ? tab : tabs[0]

  return (
    <div>
      <div className="sticky z-10 bg-white flex border-b border-gray-100" style={{ top: stickyTop }}>
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 py-3 text-sm font-semibold relative ${active === t ? 'text-brand-purple' : 'text-gray-400'}`}>
            {t}
            {active === t ? <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-[3px] rounded-full bg-brand-purple" /> : null}
          </button>
        ))}
      </div>

      {active === 'Posts' ? (
        <div className="px-4 py-4 space-y-3">
          {loading ? (
            [0, 1].map((i) => <div key={i} className="h-44 rounded-2xl bg-gray-100 animate-pulse" />)
          ) : posts.length === 0 ? (
            <div className="text-center py-14">
              <span className="w-16 h-16 rounded-full bg-brand-light mx-auto flex items-center justify-center mb-3"><FileText size={26} className="text-brand-purple" /></span>
              <p className="font-semibold">{isMe ? "You haven't posted yet" : 'No posts yet'}</p>
              <p className="text-sm text-gray-400 mt-1">{isMe ? 'Share something with your school.' : 'Their posts will show up here.'}</p>
              {isMe ? <button onClick={() => navigate('/add-post')} className="mt-4 bg-brand-purple text-white text-sm font-medium rounded-full px-6 py-2.5">Create a post</button> : null}
            </div>
          ) : (
            <>
              {posts.map((p) => <PostCard key={p.id} post={p} onDeleted={(id) => { setPosts((prev) => prev.filter((x) => x.id !== id)); onPostsCount?.(-1) }} />)}
              {hasMore ? <div ref={sentinel} className="py-4 flex justify-center text-gray-300"><Loader2 size={20} className="animate-spin" /></div> : null}
            </>
          )}
        </div>
      ) : null}

      {active === 'Media' ? (
        <div>
          {loading ? (
            <div className="grid grid-cols-3 gap-px">{Array.from({ length: 9 }).map((_, i) => <div key={i} className="bg-gray-100 animate-pulse" style={{ aspectRatio: '3 / 4' }} />)}</div>
          ) : tiles.length === 0 ? (
            <div className="text-center py-14 px-6">
              <span className="w-16 h-16 rounded-full bg-brand-light mx-auto flex items-center justify-center mb-3"><ImageOff size={26} className="text-brand-purple" /></span>
              <p className="font-semibold">No photos yet</p>
              <p className="text-sm text-gray-400 mt-1">Photos from posts will appear here.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-px">
                {tiles.map((t) => {
                  const thumb = t.photos[0] || t.post.video_thumb_url || postThumb(t.post)
                  const isVideo = !!t.post.video_url && t.photos.length === 0
                  return (
                    <button
                      key={t.post.id}
                      onClick={() => (t.photos.length ? setViewer({ index: t.first }) : navigate(`/post/${t.post.id}`))}
                      className="relative bg-neutral-800 overflow-hidden active:opacity-80"
                      style={{ aspectRatio: '3 / 4' }}
                    >
                      {thumb ? (
                        <img src={thumb} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <video src={`${t.post.video_url}#t=0.1`} preload="metadata" muted playsInline className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
                      )}
                      {isVideo ? (
                        <span className="absolute top-1.5 right-1.5 text-white drop-shadow"><Play size={15} fill="currentColor" /></span>
                      ) : t.photos.length > 1 ? (
                        <span className="absolute top-1.5 right-1.5 text-white drop-shadow"><Layers size={15} /></span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
              {hasMore ? <div ref={sentinel} className="py-4 flex justify-center text-gray-300"><Loader2 size={20} className="animate-spin" /></div> : null}
            </>
          )}
        </div>
      ) : null}

      {active === 'About' ? (
        <div className="px-4 py-3 divide-y divide-gray-100">
          {person?.bio ? <div className="py-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">About</p><p className="text-sm text-gray-800 mt-1 whitespace-pre-wrap break-words">{person.bio}</p></div> : null}
          {person?.role ? <Row icon={BadgeCheck} label="Role">{person.role}</Row> : null}
          {school ? (
            <button onClick={() => person?.school_id && navigate(`/schools/${person.school_id}`)} className="w-full text-left">
              <div className="flex items-center gap-3 py-3">
                <span className="w-9 h-9 rounded-full bg-brand-light flex items-center justify-center shrink-0"><GraduationCap size={17} className="text-brand-purple" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">School</p>
                  <p className="text-sm text-gray-800 mt-0.5 truncate">{school.name}</p>
                  {school.location ? <p className="text-xs text-gray-400 truncate">{school.location}</p> : null}
                </div>
                <ChevronRight size={18} className="text-gray-300" />
              </div>
            </button>
          ) : null}
          {person?.location ? <Row icon={MapPin} label="Location">{person.location}</Row> : null}
          {links.length ? (
            <Row icon={Link2} label="Links">
              {links.map((l) => (
                <a key={l} href={/^https?:\/\//i.test(l) ? l : `https://${l}`} target="_blank" rel="noreferrer" className="block text-brand-purple truncate py-0.5">{l.replace(/^https?:\/\//i, '')}</a>
              ))}
            </Row>
          ) : null}
          {joined ? <Row icon={CalendarDays} label="Joined">{new Date(joined).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })}</Row> : null}
          {!person?.bio && !person?.role && !school && !person?.location && !links.length ? (
            <div className="text-center py-14"><p className="font-semibold">Nothing here yet</p><p className="text-sm text-gray-400 mt-1">{isMe ? 'Add a bio, location and links from Edit profile.' : 'They have not added any details.'}</p></div>
          ) : null}
        </div>
      ) : null}

      {viewer ? <PhotoViewer images={media.map((m) => m.url)} initialIndex={viewer.index} postId={media[viewer.index]?.postId} onClose={() => setViewer(null)} /> : null}
    </div>
  )
        }
