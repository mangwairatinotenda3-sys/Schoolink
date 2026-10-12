import { Bell, Search, Menu, Landmark, FlaskConical, Trophy, Users, GraduationCap, Grid3x3 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient.js'
import BottomNav from '../components/BottomNav.jsx'
import PostCard from '../components/PostCard.jsx'
import SideDrawer from '../components/SideDrawer.jsx'
import ComposerBar from '../components/ComposerBar.jsx'
import StatusRow from '../components/StatusRow.jsx'
import SiteAnnouncements from '../components/SiteAnnouncements.jsx'
import VerifiedBadge from '../components/VerifiedBadge.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useUnreadCount } from '../lib/useUnreadCount.js'
import { isSchoolMember } from '../lib/permissions.js'

const shortcuts = [
  { label: 'Your School', icon: Landmark, color: 'bg-blue-500' },
  { label: 'Science Club', icon: FlaskConical, color: 'bg-emerald-500', to: '/communities' },
  { label: 'Sports Club', icon: Trophy, color: 'bg-orange-500', to: '/communities' },
  { label: 'Parents', icon: Users, color: 'bg-purple-500', to: '/communities' },
  { label: 'Alumni', icon: GraduationCap, color: 'bg-rose-500', to: '/alumni' },
  { label: 'More', icon: Grid3x3, color: 'bg-gray-400', to: '/more' },
]

export default function Home() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const unread = useUnreadCount()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [school, setSchool] = useState(null)
  const [memberCount, setMemberCount] = useState(0)

  useEffect(() => {
    supabase.from('posts').select('*').order('created_at', { ascending: false }).limit(50).then(({ data }) => {
      setPosts(data ?? [])
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!isSchoolMember(profile)) {
      setSchool(null)
      return
    }
    supabase.from('schools').select('*').eq('id', profile.school_id).maybeSingle().then(({ data }) => setSchool(data))
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('school_id', profile.school_id).eq('status', 'active').then(({ count }) => setMemberCount(count ?? 0))
  }, [profile?.school_id, profile?.status, profile?.account_type])

  function handleShortcut(label) {
    if (label === 'Your School') {
      navigate(isSchoolMember(profile) ? '/school-profile' : '/schools')
      return
    }
    const item = shortcuts.find((s) => s.label === label)
    if (item?.to) navigate(item.to)
  }

  const dark = !!profile?.dark_mode
  const ink = dark ? '#FFFFFF' : '#1B1450'

  return (
    <div className="app-shell">
      {/* header: soft lavender, menu button opens the side menu */}
      <div
        style={{
          position: 'relative', overflow: 'hidden', padding: '16px 16px 14px',
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
            <p style={{ fontSize: 12, color: dark ? '#C7D2FE' : '#7A7A99' }}>Connect &nbsp;•&nbsp; Learn &nbsp;•&nbsp; Grow</p>
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

            <div className="screen-scroll" style={dark ? undefined : { background: '#F6F4FF' }}>
        <div className="flex gap-3 px-4 py-4 overflow-x-auto">
          {shortcuts.filter((s) => s.label !== 'Your School' || isSchoolMember(profile)).map(({ label, icon: Icon, color }) => (
            <button
              key={label}
              onClick={() => handleShortcut(label)}
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

        {isSchoolMember(profile) && school ? (
          <div className="mx-4 rounded-xl border border-gray-100 p-4">
            <p className="font-semibold flex items-center gap-1.5">{school.name}<VerifiedBadge schoolId={school.id} size={16} /></p>
            <p className="text-sm text-gray-500">{school.location}</p>
            <div className="flex gap-6 mt-3 text-sm">
              <span><b>{memberCount}</b> Members</span>
            </div>
          </div>
        ) : null}

        <StatusRow />
        <ComposerBar />

        <div className="px-4 mt-4 space-y-4">
          <SiteAnnouncements />
          {loading ? (
            <p className="text-center text-gray-400 mt-8">Loading posts…</p>
          ) : posts.length === 0 ? (
            <div className="text-center text-gray-400 mt-8">
              <p>No posts yet.</p><p className="text-sm">Be the first to share something with your school.</p>
            </div>
          ) : (
            posts.map((post) => (
              <PostCard key={post.id} post={post} onDeleted={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))} />
            ))
          )}
        </div>
      </div>

      <SideDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <BottomNav />
    </div>
  )
          }
