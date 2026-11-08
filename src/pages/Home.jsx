import { Search, Menu, Landmark, FlaskConical, Trophy, Users, GraduationCap, Grid3x3, Plus, ChevronRight } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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

// Kept in memory while the app is open, so leaving Home (for example to More) and coming back
// shows the last results at once instead of skeletons. Fresh data loads in the background.
const cache = {
  tab: 0,
  communities: null,
  discover: null,
  schoolPosts: {},
  school: {},
  updates: null,
}

// Club tiles only appear when a community with that name exists.
const CLUBS = [
  { label: 'Science Club', match: /science/i, icon: FlaskConical, color: 'bg-emerald-500' },
  { label: 'Sports Club', match: /sport/i, icon: Trophy, color: 'bg-orange-500' },
  { label: 'Parents', match: /parent/i, icon: Users, color: 'bg-purple-500' },
]

const TABS = ['My School', 'Discover', 'Updates']
const PAGE = 20 // posts per page; the next page loads as you reach the end of the list
const TILE_COLORS = ['#7C3AED', '#0EA5E9', '#16A34A', '#EA580C', '#DB2777', '#0D9488', '#CA8A04', '#4F46E5']

function tileColor(key) {
  const s = String(key || '')
  let h = 0
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return TILE_COLORS[h % TILE_COLORS.length]
}

// One full-width page of the swipeable feed. The top padding clears the floating header.
function Pane({ children, onScroll }) {
  return (
    <div onScroll={onScroll} className="w-full h-full shrink-0 snap-start overflow-y-auto" style={{ paddingTop: 110, paddingBottom: 96 }}>
      {children}
    </div>
  )
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

function Avatar({ url, name, size = 44, ring = false }) {
  const style = { width: size, height: size, ...(ring ? { border: '2px solid rgba(255,255,255,0.9)' } : {}) }
  if (url) return <img src={url} alt="" className="rounded-full object-cover shrink-0" style={style} />
  return (
    <span
      className="rounded-full flex items-center justify-center text-white font-semibold shrink-0"
      style={{ ...style, background: '#7C5CF0', fontSize: size * 0.42 }}
    >
      {(name || '?').trim().slice(0, 1).toUpperCase()}
    </span>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const schoolId = isSchoolMember(profile) ? profile.school_id : null
  const schoolKey = schoolId || '_'
  const profileLoading = !profile

  const pagerRef = useRef(null)
  const [tab, setTab] = useState(cache.tab)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // The floating header slides away while you scroll down and comes back when you scroll up
  const [chromeHidden, setChromeHidden] = useState(false)
  const lastY = useRef(0)

  const [school, setSchool] = useState(cache.school[schoolKey]?.school ?? null)
  const [memberCount, setMemberCount] = useState(cache.school[schoolKey]?.count ?? 0)
  const [communities, setCommunities] = useState(cache.communities ?? [])

  const [schoolPosts, setSchoolPosts] = useState(cache.schoolPosts[schoolKey] ?? [])
  const [schoolLoading, setSchoolLoading] = useState(!!schoolId && !cache.schoolPosts[schoolKey])
  const [discoverPosts, setDiscoverPosts] = useState(cache.discover ?? [])
  const [discoverLoading, setDiscoverLoading] = useState(!cache.discover)
  const [moreBusy, setMoreBusy] = useState({ discover: false, school: false })

  const [announcements, setAnnouncements] = useState(cache.updates?.announcements ?? [])
  const [avatarUrl, setAvatarUrl] = useState(cache.updates?.avatarUrl ?? '')
  const [people, setPeople] = useState(cache.updates?.people ?? [])
  const [schools, setSchools] = useState(cache.updates?.schools ?? [])
  const [mine, setMine] = useState(cache.updates?.mine ?? [])
  const [updatesLoading, setUpdatesLoading] = useState(!cache.updates)

  // Paging: refs so the scroll observers always see the latest lists and flags
  const schoolRef = useRef(schoolId)
  schoolRef.current = schoolId
  const postsRef = useRef({ discover: discoverPosts, school: schoolPosts })
  postsRef.current = { discover: discoverPosts, school: schoolPosts }
  const pageState = useRef({
    discover: { loaded: false, more: true, busy: false },
    school: { loaded: false, more: true, busy: false },
  })
  const discoverSentinel = useRef(null)
  const schoolSentinel = useRef(null)

  const dark = !!profile?.dark_mode
  const ink = dark ? '#FFFFFF' : '#1B1450'
  const muted = dark ? '#C7D2FE' : '#7A7A99'
  const frost = dark ? 'rgba(20,14,44,0.74)' : 'rgba(255,255,255,0.8)'
  const pageBg = dark ? '#0B0920' : '#F6F4FF'

  // Put the pager back on the tab the user left
  useLayoutEffect(() => {
    const el = pagerRef.current
    if (el && el.clientWidth) el.scrollLeft = cache.tab * el.clientWidth
  }, [])

  // One page of posts. Discover is every post. My School is only the posts the school itself made.
  async function fetchPage(kind, from) {
    let query = supabase.from('posts').select('*')
    if (kind === 'school') {
      if (!schoolRef.current) return []
      query = query.eq('as_school_id', schoolRef.current)
    }
    const { data, error } = await query.order('created_at', { ascending: false }).range(from, from + PAGE - 1)
    return error ? null : (data ?? [])
  }

  // Adds the next page when the end of a list comes into view
  async function loadMore(kind) {
    const st = pageState.current[kind]
    if (!st.loaded || !st.more || st.busy) return
    st.busy = true
    setMoreBusy((m) => ({ ...m, [kind]: true }))
    const rows = await fetchPage(kind, postsRef.current[kind].length)
    st.busy = false
    setMoreBusy((m) => ({ ...m, [kind]: false }))
    if (!rows) return
    st.more = rows.length === PAGE
    const setter = kind === 'school' ? setSchoolPosts : setDiscoverPosts
    setter((prev) => {
      const have = new Set(prev.map((p) => p.id))
      return [...prev, ...rows.filter((p) => !have.has(p.id))]
    })
  }

  // Keep the cache in step with what is on screen
  useEffect(() => {
    if (discoverPosts.length) cache.discover = discoverPosts
  }, [discoverPosts])

  useEffect(() => {
    if (schoolId && schoolPosts.length) cache.schoolPosts[schoolId] = schoolPosts
  }, [schoolPosts, schoolId])

  // Everyone's posts (Discover) and the clubs that exist
  useEffect(() => {
    let live = true
    const st = pageState.current.discover
    if (cache.discover) {
      st.loaded = true
      st.more = cache.discover.length === PAGE
    }
    fetchPage('discover', 0).then((rows) => {
      if (!live) return
      if (rows) {
        st.loaded = true
        st.more = rows.length === PAGE
        setDiscoverPosts(rows)
      }
      setDiscoverLoading(false)
    })
    supabase.from('communities').select('id, name').order('created_at', { ascending: false }).limit(200).then(({ data, error }) => {
      if (!live || error) return
      cache.communities = data ?? []
      setCommunities(cache.communities)
    })
    return () => { live = false }
  }, [])

  // This school's posts (My School), from the posts the school made as itself
  useEffect(() => {
    if (!schoolId) {
      setSchoolPosts([])
      setSchoolLoading(false)
      pageState.current.school = { loaded: false, more: true, busy: false }
      return undefined
    }
    let live = true
    const st = { loaded: false, more: true, busy: false }
    pageState.current.school = st
    const cached = cache.schoolPosts[schoolId]
    if (cached) {
      setSchoolPosts(cached)
      setSchoolLoading(false)
      st.loaded = true
      st.more = cached.length === PAGE
    } else {
      setSchoolPosts([])
      setSchoolLoading(true)
    }
    fetchPage('school', 0).then((rows) => {
      if (!live) return
      if (rows) {
        st.loaded = true
        st.more = rows.length === PAGE
        setSchoolPosts(rows)
      }
      setSchoolLoading(false)
    })
    return () => { live = false }
  }, [schoolId])

  // The next page loads when the end of either list is near the screen
  useEffect(() => {
    const pairs = [[discoverSentinel, 'discover'], [schoolSentinel, 'school']]
    const observers = pairs.map(([ref, kind]) => {
      const el = ref.current
      if (!el) return null
      const io = new IntersectionObserver((entries) => { if (entries[0].isIntersecting) loadMore(kind) }, { rootMargin: '600px' })
      io.observe(el)
      return io
    })
    return () => observers.forEach((io) => io?.disconnect())
  }, [schoolId])

  // School card and member count
  useEffect(() => {
    if (!schoolId) {
      setSchool(null)
      setMemberCount(0)
      return undefined
    }
    let live = true
    supabase.from('schools').select('*').eq('id', schoolId).maybeSingle().then(({ data }) => {
      if (!live || !data) return
      cache.school[schoolId] = { ...(cache.school[schoolId] || {}), school: data }
      setSchool(data)
    })
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('status', 'active').then(({ count }) => {
      if (!live) return
      cache.school[schoolId] = { ...(cache.school[schoolId] || {}), count: count ?? 0 }
      setMemberCount(count ?? 0)
    })
    return () => { live = false }
  }, [schoolId, profile?.status])

  // Updates: 24-hour updates from people and schools, and 48-hour announcements from the Schoolink team
  useEffect(() => {
    if (!user) return undefined
    let live = true

    const show = (d) => {
      setAnnouncements(d.announcements)
      setAvatarUrl(d.avatarUrl)
      setPeople(d.people)
      setSchools(d.schools)
      setMine(d.mine)
    }

    const cached = cache.updates?.uid === user.id ? cache.updates : null
    if (cached) {
      show(cached)
      setUpdatesLoading(false)
    } else {
      setUpdatesLoading(true)
    }

    Promise.all([
      supabase.from('site_announcements').select('id, body, media, expires_at').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(20),
      supabase.rpc('site_announcement_avatar'),
      loadStatusFeed(user, profile),
    ]).then(([ann, avatar, feed]) => {
      if (!live) return
      const next = {
        uid: user.id,
        announcements: ann.data ?? [],
        avatarUrl: avatar.data || '',
        people: feed?.people ?? [],
        schools: feed?.schools ?? [],
        mine: feed?.mine ?? [],
      }
      cache.updates = next
      show(next)
    }).catch(() => {}).finally(() => {
      if (live) setUpdatesLoading(false)
    })
    return () => { live = false }
  }, [user?.id, profile?.school_id])

  function removePost(id) {
    const drop = (list) => list.filter((p) => p.id !== id)
    setSchoolPosts(drop)
    setDiscoverPosts(drop)
    for (const key of Object.keys(cache.schoolPosts)) cache.schoolPosts[key] = drop(cache.schoolPosts[key])
    if (cache.discover) cache.discover = drop(cache.discover)
  }

  function selectTab(i) {
    cache.tab = i
    setTab(i)
  }

  function goTab(i) {
    selectTab(i)
    lastY.current = 0
    setChromeHidden(false)
    const el = pagerRef.current
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }

  function onPagerScroll(e) {
    const el = e.currentTarget
    if (!el.clientWidth) return
    const i = Math.round(el.scrollLeft / el.clientWidth)
    if (i !== cache.tab) selectTab(i)
  }

  // Instagram-style: scrolling down hides the floating header, scrolling up brings it back
  function onPaneScroll(e) {
    const y = e.currentTarget.scrollTop
    const dy = y - lastY.current
    lastY.current = y
    if (y <= 8) setChromeHidden(false)
    else if (dy > 6) setChromeHidden(true)
    else if (dy < -6) setChromeHidden(false)
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
  // Room for three small buttons. With more, the last one becomes "More".
  const headerTiles = tiles.length > 3 ? [...tiles.slice(0, 2), tiles[tiles.length - 1]] : tiles

  const floatShadow = '0 6px 18px rgba(31,22,74,0.14)'
  const floatBlur = { backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }

  return (
    <div className="app-shell">
      <div className="relative flex-1 min-h-0 overflow-hidden" style={{ background: pageBg }}>
        {/* The pages scroll underneath the floating header */}
        <div
          ref={pagerRef}
          onScroll={onPagerScroll}
          className="absolute inset-0 flex overflow-x-auto snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none' }}
        >
          {/* My School */}
          <Pane onScroll={onPaneScroll}>
            {profileLoading ? (
              <div className="px-4 space-y-4"><PostListSkeleton count={3} /></div>
            ) : schoolId ? (
              <>
                {school ? (
                  <button
                    type="button"
                    onClick={() => navigate('/school-profile')}
                    className="flex items-center gap-3 mx-4 rounded-xl px-3 py-2 text-left"
                    style={{ background: frost, boxShadow: floatShadow, ...floatBlur }}
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
                    <Empty ink={ink} muted={muted} title="No posts from your school yet" body="Posts your school shares as itself will show here." />
                  ) : (
                    schoolPosts.map((post) => <PostCard key={post.id} post={post} onDeleted={removePost} />)
                  )}
                  {moreBusy.school ? <PostListSkeleton count={1} /> : null}
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
            <div ref={schoolSentinel} className="h-px" />
          </Pane>

          {/* Discover: every school */}
          <Pane onScroll={onPaneScroll}>
            <div className="px-4 pt-3 space-y-4">
              {discoverLoading ? (
                <PostListSkeleton count={3} />
              ) : discoverPosts.length === 0 ? (
                <Empty ink={ink} muted={muted} title="No posts yet" body="Posts from every school will show here." />
              ) : (
                discoverPosts.map((post) => <PostCard key={post.id} post={post} onDeleted={removePost} />)
              )}
              {moreBusy.discover ? <PostListSkeleton count={1} /> : null}
            </div>
            <div ref={discoverSentinel} className="h-px" />
          </Pane>

          {/* Updates: laid out as tiles, like TikTok's Discover grid */}
          <Pane onScroll={onPaneScroll}>
            <div className="px-3 grid grid-cols-2 gap-2.5">
              <button
                onClick={() => navigate('/statuses/create')}
                className="aspect-[3/4] rounded-2xl flex flex-col items-center justify-center gap-2 border-2 border-dashed"
                style={{ borderColor: dark ? 'rgba(255,255,255,0.18)' : 'rgba(109,77,255,0.35)', background: frost, color: ink }}
              >
                <span className="w-11 h-11 rounded-full flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg, #8B5CF6, #4F46E5)' }}>
                  <Plus size={22} />
                </span>
                <span className="font-semibold text-sm">Share an update</span>
                <span className="text-[11px]" style={{ color: muted }}>Visible for 24 hours</span>
              </button>

              {mine.length > 0 ? (
                <button
                  onClick={() => navigate(`/statuses/${user.id}`)}
                  className="aspect-[3/4] rounded-2xl relative overflow-hidden text-left"
                  style={{ background: `linear-gradient(160deg, ${tileColor(user.id)}, #1B1450)` }}
                >
                  <span className="absolute top-3 left-3"><Avatar url={profile?.avatar_url} name={profile?.full_name} size={44} ring /></span>
                  <span className="absolute inset-x-0 bottom-0 p-2.5 text-white" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.6))' }}>
                    <span className="block font-semibold text-sm truncate">My update</span>
                    <span className="block text-[11px] opacity-90">{mine.length} in the last 24 hours</span>
                  </span>
                </button>
              ) : null}

              {updatesLoading ? (
                [0, 1, 2, 3].map((i) => <SkeletonBlock key={i} w="100%" h={210} r={16} />)
              ) : null}

              {!updatesLoading && schools.length > 0 ? (
                <p className="col-span-2 text-xs font-semibold uppercase tracking-wide mt-2" style={{ color: muted }}>Schools</p>
              ) : null}

              {!updatesLoading && schools.map((s) => (
                <button
                  key={`school-${s.id}`}
                  onClick={() => navigate(`/schools/${s.id}`, { state: { openUpdates: true } })}
                  className="aspect-[3/4] rounded-2xl relative overflow-hidden text-left"
                  style={{ background: `linear-gradient(160deg, ${tileColor(s.id)}, #1B1450)`, opacity: s.allSeen ? 0.7 : 1 }}
                >
                  <span className="absolute top-3 left-3"><Avatar url={s.logo_url} name={s.name} size={44} ring /></span>
                  <span className="absolute inset-x-0 bottom-0 p-2.5 text-white" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.6))' }}>
                    <span className="block font-semibold text-sm truncate">{s.name}</span>
                    <span className="block text-[11px] opacity-90">{s.items.length} update{s.items.length === 1 ? '' : 's'}</span>
                  </span>
                </button>
              ))}

              {!updatesLoading && people.length > 0 ? (
                <p className="col-span-2 text-xs font-semibold uppercase tracking-wide mt-2" style={{ color: muted }}>Last 24 hours</p>
              ) : null}

              {!updatesLoading && people.map((p) => (
                <button
                  key={p.id}
                  onClick={() => navigate(`/statuses/${p.id}`, { state: { queue: [p.id] } })}
                  className="aspect-[3/4] rounded-2xl relative overflow-hidden text-left"
                  style={{ background: `linear-gradient(160deg, ${tileColor(p.id)}, #1B1450)`, opacity: p.allSeen ? 0.7 : 1 }}
                >
                  <span className="absolute top-3 left-3">
                    <Avatar url={p.avatar_url} name={p.full_name} size={44} ring />
                  </span>
                  <span className="absolute inset-x-0 bottom-0 p-2.5 text-white" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.6))' }}>
                    <span className="block font-semibold text-sm truncate">{p.full_name}</span>
                    <span className="block text-[11px] opacity-90">{p.items.length} update{p.items.length === 1 ? '' : 's'}</span>
                  </span>
                </button>
              ))}

              {!updatesLoading && announcements.length > 0 ? (
                <p className="col-span-2 text-xs font-semibold uppercase tracking-wide mt-2" style={{ color: muted }}>From the Schoolink team</p>
              ) : null}

              {!updatesLoading && announcements.map((a) =>
                a.media ? (
                  <div key={a.id} className="col-span-2">
                    <AnnouncementCard body={a.body} media={a.media} expiresAt={a.expires_at} avatarUrl={avatarUrl} />
                  </div>
                ) : (
                  <div
                    key={a.id}
                    className="aspect-[3/4] rounded-2xl relative overflow-hidden text-white"
                    style={{ background: 'linear-gradient(160deg, #7C5CF0, #1B1450)' }}
                  >
                    <p className="absolute inset-0 p-3.5 pt-4 text-[14px] leading-snug font-medium overflow-hidden whitespace-pre-wrap break-words" style={{ display: '-webkit-box', WebkitLineClamp: 12, WebkitBoxOrient: 'vertical' }}>
                      {a.body}
                    </p>
                    <span className="absolute inset-x-0 bottom-0 p-2.5 flex items-center gap-2" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.55))' }}>
                      <Avatar url={avatarUrl} name="Schoolink" size={24} />
                      <span className="text-[11px] font-semibold truncate">Schoolink team</span>
                    </span>
                  </div>
                ),
              )}

              {!updatesLoading && people.length === 0 && schools.length === 0 && mine.length === 0 && announcements.length === 0 ? (
                <p className="col-span-2 text-center text-sm mt-10" style={{ color: muted }}>No updates in the last 24 hours yet.</p>
              ) : null}
            </div>
          </Pane>
        </div>

        {/* Floating header: no bar behind it, just the buttons and tabs. It slides away on scroll down. */}
        <div
          className="absolute top-0 left-0 right-0 z-10 pointer-events-none"
          style={{
            padding: '10px 12px 0',
            transform: chromeHidden ? 'translateY(-170%)' : 'translateY(0)',
            transition: 'transform 240ms ease',
          }}
        >
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              className="pointer-events-auto"
              style={{
                width: 38, height: 38, borderRadius: 999, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: frost, boxShadow: floatShadow, ...floatBlur,
              }}
            >
              <Menu size={20} color={ink} />
            </button>

            <h1
              className="pointer-events-auto flex-1 min-w-0 flex items-center px-3.5 h-9 rounded-full"
              style={{ background: frost, boxShadow: floatShadow, ...floatBlur, fontSize: 17, fontWeight: 800, color: ink }}
            >
              <span className="truncate">School<span style={{ color: '#6D4DFF' }}>ink</span></span>
            </h1>

            <button
              onClick={() => navigate('/search')}
              aria-label="Search"
              className="pointer-events-auto"
              style={{
                width: 38, height: 38, borderRadius: 999, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: frost, boxShadow: floatShadow, color: ink, ...floatBlur,
              }}
            >
              <Search size={19} />
            </button>

            {headerTiles.map(({ label, icon: Icon, color, to }) => (
              <button
                key={label}
                onClick={() => navigate(to)}
                aria-label={label}
                title={label}
                className={`${color} pointer-events-auto shrink-0`}
                style={{ width: 34, height: 34, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: floatShadow }}
              >
                <Icon size={17} className="text-white" />
              </button>
            ))}
          </div>

          {/* Floating tabs, like TikTok's Following / Friends row */}
          <div className="flex justify-center mt-2.5">
            <div
              role="tablist"
              className="pointer-events-auto flex p-1 rounded-full"
              style={{ background: frost, boxShadow: floatShadow, ...floatBlur }}
            >
              {TABS.map((label, i) => (
                <button
                  key={label}
                  role="tab"
                  aria-selected={tab === i}
                  onClick={() => goTab(i)}
                  className="px-4 h-8 rounded-full text-[14px] font-semibold transition-colors"
                  style={tab === i
                    ? { background: '#6D4DFF', color: '#FFFFFF' }
                    : { color: muted }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <SideDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <BottomNav />
    </div>
  )
        }
