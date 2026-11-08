import { Bell, Search, Menu, Landmark, FlaskConical, Trophy, Users, GraduationCap, Grid3x3, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient.js'
import BottomNav from '../components/BottomNav.jsx'
import PostCard from '../components/PostCard.jsx'
import SideDrawer from '../components/SideDrawer.jsx'
import StatusRow from '../components/StatusRow.jsx'
import { PostListSkeleton } from '../components/Skeleton.jsx'
import SiteAnnouncements from '../components/SiteAnnouncements.jsx'
import VerifiedBadge from '../components/VerifiedBadge.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useUnreadCount } from '../lib/useUnreadCount.js'
import { isSchoolMember } from '../lib/permissions.js'

// Club tiles only appear when a community with that name exists.
const CLUBS = [
  { label: 'Science Club', match: /science/i, icon: FlaskConical, color: 'bg-emerald-500' },
  { label: 'Sports Club', match: /sport/i, icon: Trophy, color: 'bg-orange-500' },
  { label: 'Parents', match: /parent/i, icon: Users, color: 'bg-purple-500' },
]

const PAGE = 20 // posts per page, loaded as you reach the end of the list
const HEADER_H = 76 // height of the purple top bar when it is showing
const FEED_TABS = [
  { key: 'discover', label: 'Discover' },
  { key: 'school', label: 'My school' },
]

export default function Home() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const unread = useUnreadCount()

  const [lists, setLists] = useState({ discover: null, school: null }) // null = still loading
  const listsRef = useRef(lists)
  listsRef.current = lists
  const [tab, setTab] = useState('discover')
  const [moreBusy, setMoreBusy] = useState(false)
  const moreRef = useRef(false)
  const sentinel = useRef(null)

  const [headerHidden, setHeaderHidden] = useState(false) // Instagram-style: hides on scroll down, returns on scroll up
  const lastY = useRef(0)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [school, setSchool] = useState(null)
  const [memberCount, setMemberCount] = useState(0)
  const [communities, setCommunities] = useState([])

  const schoolId = isSchoolMember(profile) ? profile.school_id : null

  // One page of posts. Discover is every post. My school is only the posts the school itself made.
  async function fetchPage(key, from) {
    let query = supabase.from('posts').select('*')
    if (key === 'school') {
      if (!schoolId) return []
      query = query.eq('as_school_id', schoolId)
    }
    const { data, error } = await query.order('created_at', { ascending: false }).range(from, from + PAGE - 1)
    if (error) return null
    return data ?? []
  }

  // First page of the tab you open. Each tab keeps its posts while you move between them.
  useEffect(() => {
    if (tab === 'school' && !schoolId) return undefined
    if (listsRef.current[tab]) return undefined
    let cancelled = false
    fetchPage(tab, 0).then((rows) => {
      if (cancelled) return
      const list = rows ?? []
      setLists((l) => ({ ...l, [tab]: { posts: list, hasMore: list.length === PAGE } }))
    })
    return () => { cancelled = true }
  }, [tab, schoolId])

  async function loadMore() {
    const cur = listsRef.current[tab]
    if (!cur || !cur.hasMore || moreRef.current) return
    moreRef.current = true
    setMoreBusy(true)
    const rows = await fetchPage(tab, cur.posts.length)
    moreRef.current = false
    setMoreBusy(false)
    if (rows === null) return
    setLists((l) => {
      const existing = l[tab]?.posts ?? []
      const have = new Set(existing.map((p) => p.id))
      const posts = [...existing, ...rows.filter((p) => !have.has(p.id))]
      return { ...l, [tab]: { posts, hasMore: rows.length === PAGE } }
    })
  }

  const current = lists[tab]
  const canLoadMore = !!current?.hasMore
  const loadedCount = current?.posts.length ?? 0

  // When the end of the list comes into view, load the next page
  useEffect(() => {
    const el = sentinel.current
    if (!el || !canLoadMore) return undefined
    const io = new IntersectionObserver((entries) => { if (entries[0].isIntersecting) loadMore() }, { rootMargin: '400px' })
    io.observe(el)
    return () => io.disconnect()
  }, [tab, canLoadMore, loadedCount])

  useEffect(() => {
    if (!schoolId) { setSchool(null); return }
    supabase.from('schools').select('*').eq('id', schoolId).maybeSingle().then(({ data }) => setSchool(data))
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('status', 'active').then(({ count }) => setMemberCount(count ?? 0))
  }, [schoolId, profile?.status, profile?.account_type])

  useEffect(() => {
    supabase.from('communities').select('id, name').order('created_at', { ascending: false }).limit(200)
      .then(({ data }) => setCommunities(data ?? []))
  }, [])

  // Hide the top bar while scrolling down, show it again as soon as you scroll up or reach the top
  function onScroll(e) {
    const y = e.currentTarget.scrollTop
    const dy = y - lastY.current
    lastY.current = y
    if (y <= 8) setHeaderHidden(false)
    else if (dy > 6) setHeaderHidden(true)
    else if (dy < -6) setHeaderHidden(false)
  }

  const dark = !!profile?.dark_mode
  const ink = dark ? '#FFFFFF' : '#1B1450'
  const muted = dark ? '#C7D2FE' : '#7A7A99'

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

  return (
    <div className="app-shell">
      {/* Top bar: soft lavender, menu button opens the side menu. It slides away while you scroll down. */}
      <div style={{ height: headerHidden ? 0 : HEADER_H, overflow: 'hidden', flexShrink: 0, transition: 'height 220ms ease' }}>
        <div
          style={{
            position: 'relative', overflow: 'hidden', height: HEADER_H, boxSizing: 'border-box', padding: '16px 16px 14px',
            background: dark ? '#241B4E' : 'linear-gradient(135deg, #F3EFFF 0%, #E6DEFF 55%, #F6F3FF 100%)',
          }}
        >
          <div
            aria-hidden="true"
            style={{
              position: 'absolute', top: -70, right: -50, width: 220, height: 220, borderRadius: 999, pointerEvents: 'none',
              background: 'radial-gradient(circle, rgba(124,92,255,0.28), rgba(124,92,255,0) 70%)',
            }}
          />
          <div className="flex items-center gap-3" style={{ position: 'relative' }}>
            <button
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              style={{
                width: 46, height: 46, borderRadius: 14, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg, #8B5CF6, #4F46E5)', boxShadow: '0 6px 16px rgba(91,75,255,0.35)',
              }}
            >
              <Menu size={26} color="#fff" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.1, color: ink }}>
                School<span style={{ color: '#6D4DFF' }}>ink</span>
              </h1>
              <p style={{ fontSize: 12, color: muted }}>Connect &nbsp;•&nbsp; Learn &nbsp;•&nbsp; Grow</p>
            </div>
            <button onClick={() => navigate('/search')} aria-label="Search" style={{ color: ink, padding: 6 }}>
              <Search size={22} />
            </button>
            <button onClick={() => navigate('/notifications')} aria-label="Notifications" className="relative" style={{ color: ink, padding: 6 }}>
              <Bell size={22} />
              {unread > 0 ? (
                <span
                  style={{
                    position: 'absolute', top: 0, right: 0, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999,
                    background: '#F43F5E', color: '#fff', fontSize: 10, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {unread > 9 ? '9+' : unread}
                </span>
              ) : null}
            </button>
          </div>
        </div>
      </div>

      <div className="screen-scroll" onScroll={onScroll} style={dark ? undefined : { background: '#F6F4FF' }}>
        {/* Quick links: coloured circles on white cards */}
        <div className="flex gap-3 px-4 py-4 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {tiles.map(({ label, icon: Icon, color, to }) => (
            <button
              key={label}
              onClick={() => navigate(to)}
              className="flex flex-col items-center gap-2 shrink-0"
              style={{
                width: 78, padding: '12px 6px', borderRadius: 20,
                background: dark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
                boxShadow: dark ? 'none' : '0 4px 14px rgba(90,70,200,0.10)',
              }}
            >
              <span className={`w-12 h-12 rounded-full ${color} flex items-center justify-center`}><Icon size={22} className="text-white" /></span>
              <span style={{ fontSize: 11.5, fontWeight: 500, lineHeight: 1.2, textAlign: 'center', color: ink }}>{label}</span>
            </button>
          ))}
        </div>

        {/* Your school */}
        {schoolId && school ? (
          <button
            type="button"
            onClick={() => navigate('/school-profile')}
            className="flex items-center gap-3 mx-4 rounded-xl border border-gray-100 px-3 py-2 text-left"
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

        <StatusRow />

        <div className="px-4 mt-4">
          <SiteAnnouncements />
        </div>

        {/* Feed tabs: stay at the top of the screen while you scroll */}
        <div
          className="sticky top-0 z-10 flex border-b mt-4"
          style={{ background: dark ? 'var(--surface, #120F28)' : '#F6F4FF', borderColor: dark ? 'rgba(255,255,255,0.08)' : '#E9E7F1' }}
        >
          {FEED_TABS.map(({ key, label }) => {
            const on = tab === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                aria-current={on ? 'page' : undefined}
                className="flex-1 relative py-3 text-[14px]"
                style={{ color: on ? ink : muted, fontWeight: on ? 700 : 500 }}
              >
                {label}
                {on ? <span className="absolute left-1/2 -translate-x-1/2 bottom-0 w-10 h-[3px] rounded-full" style={{ background: '#6D4DFF' }} /> : null}
              </button>
            )
          })}
        </div>

        <div className="px-4 pt-4 pb-6 space-y-4">
          {tab === 'school' && !schoolId ? (
            <div className="text-center mt-8 px-6" style={{ color: muted }}>
              <p className="font-semibold" style={{ color: ink }}>Join a school to see its posts here</p>
              <p className="text-sm mt-1">Once you are linked to a school, the posts it shares show up in this tab.</p>
            </div>
          ) : !current ? (
            <PostListSkeleton count={3} />
          ) : current.posts.length === 0 ? (
            <div className="text-center text-gray-400 mt-8">
              {tab === 'school' ? (
                <>
                  <p>Your school hasn't posted yet.</p>
                </>
              ) : (
                <>
                  <p>No posts yet.</p>
                  <p className="text-sm">Be the first to share something with your school.</p>
                </>
              )}
            </div>
          ) : (
            current.posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onDeleted={(id) => setLists((l) => ({ ...l, [tab]: { ...l[tab], posts: (l[tab]?.posts ?? []).filter((x) => x.id !== id) } }))}
              />
            ))
          )}

          {canLoadMore ? <div ref={sentinel} className="h-px" /> : null}
          {moreBusy ? <PostListSkeleton count={1} /> : null}
        </div>
      </div>

      <SideDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <BottomNav />
    </div>
  )
  }
