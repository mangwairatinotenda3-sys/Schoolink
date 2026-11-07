import { Search, Menu, Landmark, FlaskConical, Trophy, Users, GraduationCap, Grid3x3, Plus, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient.js'
import BottomNav from '../components/BottomNav.jsx'
import PostCard from '../components/PostCard.jsx'
import SideDrawer from '../components/SideDrawer.jsx'
import VerifiedBadge from '../components/VerifiedBadge.jsx'
import { AnnouncementCard } from '../components/SiteAnnouncements.jsx'
import { PostListSkeleton, SkeletonBlock } from '../components/Skeleton.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { loadStatusFeed } from '../lib/statusFeed.js'
import { isSchoolMember } from '../lib/permissions.js'

// Club tiles only appear when a community with that name exists.
const CLUBS = [
  { label: 'Science Club', match: /science/i, icon: FlaskConical, color: 'bg-emerald-500' },
  { label: 'Sports Club', match: /sport/i, icon: Trophy, color: 'bg-orange-500' },
  { label: 'Parents', match: /parent/i, icon: Users, color: 'bg-purple-500' },
]

const TABS = ['My School', 'Discover', 'Updates']
const FEED_LIMIT = 50

// One full-width page of the swipeable feed
function Pane({ children }) {
  return <div className="w-full h-full shrink-0 snap-start overflow-y-auto" style={{ paddingBottom: 96 }}>{children}</div>
}

function Empty({ title, body, action, onAction, ink, muted }) {
  return (
    <div className="text-center mt-14 px-8">
      <p className="font-semibold" style={{ color: ink }}>{title}</p>
      <p className="text-sm mt-1" style={{ color: muted }}>{body}</p>
      {action ? (
        <button onClick={onAction} className="mt-4 px-5 h-10 rounded-full text-white text-sm font-semibold" style={{ background: 'var(--brand-purple)' }}>
          {action}
        </button>
      ) : null}
    </div>
  )
}

function Avatar({ url, name, size = 44 }) {
  if (url) return <img src={url} alt="" className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />
  return (
    <span
      className="rounded-full flex items-center justify-center text-white font-semibold shrink-0"
      style={{ width: size, height: size, background: '#7C5CF0', fontSize: size * 0.42 }}
    >
      {(name || '?').trim().slice(0, 1).toUpperCase()}
    </span>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const pagerRef = useRef(null)
  const [tab, setTab] = useState(0)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [school, setSchool] = useState(null)
  const [memberCount, setMemberCount] = useState(0)
  const [communities, setCommunities] = useState([])

  const [schoolPosts, setSchoolPosts] = useState([])
  const [schoolLoading, setSchoolLoading] = useState(true)
  const [discoverPosts, setDiscoverPosts] = useState([])
  const [discoverLoading, setDiscoverLoading] = useState(true)

  const [announcements, setAnnouncements] = useState([])
  const [avatarUrl, setAvatarUrl] = useState('')
  const [people, setPeople] = useState([])
  const [mine, setMine] = useState([])
  const [updatesLoading, setUpdatesLoading] = useState(true)

  const dark = !!profile?.dark_mode
  const ink = dark ? '#FFFFFF' : '#1B1450'
  const muted = dark ? '#C7D2FE' : '#7A7A99'
  const schoolId = isSchoolMember(profile) ? profile.school_id : null

  // Everyone's posts (Discover) and the clubs that exist
  useEffect(() => {
    let live = true
    supabase.from('posts').select('*').order('created_at', { ascending: false }).limit(FEED_LIMIT).then(({ data }) => {
      if (!live) return
      setDiscoverPosts(data ?? [])
      setDiscoverLoading(false)
    })
    supabase.from('communities').select('id, name').order('created_at', { ascending: false }).limit(200)
      .then(({ data }) => { if (live) setCommunities(data ?? []) })
    return () => { live = false }
  }, [])

  // Only this school's posts (My School)
  useEffect(() => {
    if (!schoolId) {
      setSchoolPosts([])
      setSchoolLoading(false)
      return undefined
    }
    let live = true
    setSchoolLoading(true)
    supabase.from('posts').select('*').eq('school_id', schoolId).order('created_at', { ascending: false }).limit(FEED_LIMIT).then(({ data }) => {
      if (!live) return
      setSchoolPosts(data ?? [])
      setSchoolLoading(false)
    })
    return () => { live = false }
  }, [schoolId])

  useEffect(() => {
    if (!schoolId) {
      setSchool(null)
      setMemberCount(0)
      return
    }
    supabase.from('schools').select('*').eq('id', schoolId).maybeSingle().then(({ data }) => setSchool(data))
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('status', 'active').then(({ count }) => setMemberCount(count ?? 0))
  }, [schoolId, profile?.status])

  // Updates: 24-hour updates from people, and 48-hour announcements from the Schoolink team
  useEffect(() => {
    let live = true
    setUpdatesLoading(true)
    Promise.all([
      supabase.from('site_announcements').select('id, body, media, expires_at').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(20),
      supabase.rpc('site_announcement_avatar'),
      user ? loadStatusFeed(user, profile) : Promise.resolve(null),
    ]).then(([ann, avatar, feed]) => {
      if (!live) return
      setAnnouncements(ann.data ?? [])
      setAvatarUrl(avatar.data || '')
      setPeople(feed?.people ?? [])
      setMine(feed?.mine ?? [])
      setUpdatesLoading(false)
    }).catch(() => { if (live) setUpdatesLoading(false) })
    return () => { live = false }
  }, [user?.id, profile?.school_id])

  function removePost(id) {
    setSchoolPosts((list) => list.filter((p) => p.id !== id))
    setDiscoverPosts((list) => list.filter((p) => p.id !== id))
  }

  function goTab(i) {
    setTab(i)
    const el = pagerRef.current
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }

  function onPagerScroll(e) {
    const el = e.currentTarget
    if (!el.clientWidth) return
    const i = Math.round(el.scrollLeft / el.clientWidth)
    if (i !== tab) setTab(i)
  }

  const clubTiles = CLUBS.flatMap((club) => {
    const found = communities.find((c) => club.match.test(c.name || ''))
    return found ? [{ label: club.label, icon: club.icon, color: club.color, to: `/communities/${found.id}` }] : []
  })
  const tiles = [
    ...(schoolId ? [{ label: 'Your School', icon: Landmark, color: 'bg-blue-500', to: '/school-profile' }] : []),
    ...clubTiles,
    { label: 'Alumni', icon: GraduationCap, color: 'bg-rose-500', to: '/alumni' },
    { label: 'More', icon: Grid3x3, color: 'bg-gray-400', to: '/more' },
  ]
  // The header has room for three small buttons. With more, the last one becomes "More".
  const headerTiles = tiles.length > 3 ? [...tiles.slice(0, 2), tiles[tiles.length - 1]] : tiles

  const headerBg = dark ? '#241B4E' : 'linear-gradient(135deg, #F3EFFF 0%, #E6DEFF 55%, #F6F3FF 100%)'
  const pageBg = dark ? undefined : '#F6F4FF'

  return (
    <div className="app-shell">
      {/* Top bar: menu and name on the left; search and quick links on the right */}
      <div style={{ position: 'relative', overflow: 'hidden', background: headerBg, padding: '10px 12px 0', flexShrink: 0 }}>
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', top: -70, right: -50, width: 220, height: 220, borderRadius: 999, pointerEvents: 'none',
            background: 'radial-gradient(circle, rgba(124,92,255,0.28), rgba(124,92,255,0) 70%)',
          }}
        />
        <div className="flex items-center gap-2" style={{ position: 'relative', minHeight: 46 }}>
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            style={{
              width: 38, height: 38, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'linear-gradient(135deg, #8B5CF6, #4F46E5)', boxShadow: '0 6px 16px rgba(91,75,255,0.35)',
            }}
          >
            <Menu size={21} color="#fff" />
          </button>
          <h1 className="flex-1 min-w-0 truncate" style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.1, color: ink }}>
            School<span style={{ color: '#6D4DFF' }}>ink</span>
          </h1>
          <button onClick={() => navigate('/search')} aria-label="Search" style={{ width: 36, height: 36, color: ink, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Search size={21} />
          </button>
          {headerTiles.map(({ label, icon: Icon, color, to }) => (
            <button
              key={label}
              onClick={() => navigate(to)}
              aria-label={label}
              title={label}
              className={`${color} shrink-0`}
              style={{ width: 34, height: 34, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.12)' }}
            >
              <Icon size={17} className="text-white" />
            </button>
          ))}
        </div>

        {/* Tabs, like TikTok's top tabs */}
        <div role="tablist" className="relative flex mt-1">
          {TABS.map((label, i) => (
            <button
              key={label}
              role="tab"
              aria-selected={tab === i}
              onClick={() => goTab(i)}
              className="flex-1 py-3 text-[15px] font-semibold transition-colors"
              style={{ color: tab === i ? ink : muted }}
            >
              {label}
            </button>
          ))}
          <span
            aria-hidden="true"
            style={{
              position: 'absolute', bottom: 0, left: `${(tab * 100) / TABS.length}%`, width: `${100 / TABS.length}%`,
              height: 3, borderRadius: 3, background: '#7C5CF0', transition: 'left 0.25s ease',
            }}
          />
        </div>
      </div>

      {/* Swipe sideways between the three pages */}
      <div
        ref={pagerRef}
        onScroll={onPagerScroll}
        className="flex-1 min-h-0 flex overflow-x-auto snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', background: pageBg }}
      >
        {/* My School */}
        <Pane>
          {schoolId ? (
            <>
              {school ? (
                <button
                  type="button"
                  onClick={() => navigate('/school-profile')}
                  className="flex items-center gap-3 mx-4 mt-3 rounded-xl border border-gray-100 px-3 py-2 text-left"
                  style={{ background: dark ? 'rgba(255,255,255,0.06)' : '#FFFFFF', borderColor: dark ? 'rgba(255,255,255,0.08)' : undefined }}
                >
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span className="font-semibold truncate" style={{ color: ink, fontSize: 14 }}>{school.name}</span>
                      <VerifiedBadge schoolId={school.id} size={14} />
                    </span>
                    <span className="block truncate" style={{ color: muted, fontSize: 11 }}>{school.location}</span>
                    <span className="block mt-0.5" style={{ color: ink, fontSize: 11 }}><b>{memberCount}</b> Members</span>
                  </span>
                  <ChevronRight size={15} color={muted} />
                </button>
              ) : null}
              <div className="px-4 pt-3 space-y-4">
                {schoolLoading ? (
                  <PostListSkeleton count={3} />
                ) : schoolPosts.length === 0 ? (
                  <Empty ink={ink} muted={muted} title="No posts from your school yet" body="Be the first to share something with your school." />
                ) : (
                  schoolPosts.map((post) => <PostCard key={post.id} post={post} onDeleted={removePost} />)
                )}
              </div>
            </>
          ) : (
            <Empty
              ink={ink}
              muted={muted}
              title="Join your school"
              body="Your school's posts show here once you are a member."
              action="Find a school"
              onAction={() => navigate('/schools')}
            />
          )}
        </Pane>

        {/* Discover: every school */}
        <Pane>
          <div className="px-4 pt-3 space-y-4">
            {discoverLoading ? (
              <PostListSkeleton count={3} />
            ) : discoverPosts.length === 0 ? (
              <Empty ink={ink} muted={muted} title="No posts yet" body="Posts from every school will show here." />
            ) : (
              discoverPosts.map((post) => <PostCard key={post.id} post={post} onDeleted={removePost} />)
            )}
          </div>
        </Pane>

        {/* Updates: 24-hour updates and 48-hour team announcements */}
        <Pane>
          <div className="px-4 pt-3 space-y-5">
            <button
              onClick={() => navigate('/statuses/create')}
              className="w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-left border border-gray-100"
              style={{ background: dark ? 'rgba(255,255,255,0.06)' : '#FFFFFF' }}
            >
              <span className="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: 'linear-gradient(135deg, #8B5CF6, #4F46E5)' }}>
                <Plus size={20} />
              </span>
              <span className="font-semibold text-[15px]" style={{ color: ink }}>Share an update</span>
            </button>

            {mine.length > 0 ? (
              <button
                onClick={() => navigate(`/statuses/${user.id}`)}
                className="w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-left"
                style={{ background: dark ? 'rgba(255,255,255,0.06)' : '#FFFFFF' }}
              >
                <Avatar url={profile?.avatar_url} name={profile?.full_name} size={44} />
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold text-[15px]" style={{ color: ink }}>My update</span>
                  <span className="block text-xs" style={{ color: muted }}>{mine.length} shared in the last 24 hours</span>
                </span>
                <ChevronRight size={16} color={muted} />
              </button>
            ) : null}

            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: muted }}>Last 24 hours</h2>
              {updatesLoading ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <SkeletonBlock w={44} h={44} r={999} />
                      <div className="flex-1 space-y-2"><SkeletonBlock w="45%" h={12} /><SkeletonBlock w="25%" h={10} /></div>
                    </div>
                  ))}
                </div>
              ) : people.length === 0 ? (
                <p className="text-sm py-2" style={{ color: muted }}>No updates from people in the last 24 hours.</p>
              ) : (
                <div className="space-y-1">
                  {people.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => navigate(`/statuses/${p.id}`, { state: { queue: [p.id] } })}
                      className="w-full flex items-center gap-3 rounded-2xl px-2 py-2 text-left active:bg-black/5"
                    >
                      <span
                        className="rounded-full p-[2.5px] shrink-0"
                        style={{ background: p.allSeen ? '#CBD5E1' : 'linear-gradient(135deg, #A583FF, #6C4CE0)' }}
                      >
                        <span className="block rounded-full p-[2px]" style={{ background: dark ? '#0B0920' : '#FFFFFF' }}>
                          <Avatar url={p.avatar_url} name={p.full_name} size={40} />
                        </span>
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-semibold text-[15px] truncate" style={{ color: ink }}>{p.full_name}</span>
                        <span className="block text-xs" style={{ color: muted }}>
                          {p.items.length} update{p.items.length === 1 ? '' : 's'}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            {announcements.length > 0 ? (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: muted }}>From the Schoolink team</h2>
                <div className="space-y-3">
                  {announcements.map((a) => (
                    <AnnouncementCard key={a.id} body={a.body} media={a.media} expiresAt={a.expires_at} avatarUrl={avatarUrl} />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </Pane>
      </div>

      <SideDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <BottomNav />
    </div>
  )
    }
