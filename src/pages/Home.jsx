import { Bell, Search, Menu, Landmark, FlaskConical, Trophy, Users, GraduationCap, Grid3x3, ChevronRight } from 'lucide-react'
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

const ACCENT = '#6C4CE0'

const shortcuts = [
  { label: 'Your School', icon: Landmark, color: '#2563EB', tint: '#DBEAFE' },
  { label: 'Science Club', icon: FlaskConical, color: '#059669', tint: '#D1FAE5', to: '/communities' },
  { label: 'Sports Club', icon: Trophy, color: '#EA580C', tint: '#FFEDD5', to: '/communities' },
  { label: 'Parents', icon: Users, color: '#7C3AED', tint: '#EDE9FE', to: '/communities' },
  { label: 'Alumni', icon: GraduationCap, color: '#E11D48', tint: '#FFE4E6', to: '/alumni' },
  { label: 'More', icon: Grid3x3, color: '#475569', tint: '#E2E8F0', to: '/more' },
]

// Flat round button for the header. No shadow, no glow.
function IconButton({ label, onClick, children, badge = 0, dark, tint }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{
        position: 'relative',
        width: 40,
        height: 40,
        borderRadius: 999,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: tint ? ACCENT : dark ? '#FFFFFF' : '#1B1450',
        background: tint ? (dark ? 'rgba(124,92,255,0.22)' : '#EFEBFF') : dark ? 'rgba(255,255,255,0.08)' : '#F3F1FA',
      }}
    >
      {children}
      {badge > 0 ? (
        <span
          style={{
            position: 'absolute',
            top: -2,
            right: -2,
            minWidth: 17,
            height: 17,
            padding: '0 5px',
            borderRadius: 999,
            background: '#F43F5E',
            color: '#FFFFFF',
            fontSize: 10,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `2px solid ${dark ? '#150F45' : '#FFFFFF'}`,
          }}
        >
          {badge > 9 ? '9+' : badge}
        </span>
      ) : null}
    </button>
  )
}

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
  const muted = dark ? '#A9A6D6' : '#7A7A99'
  const line = dark ? 'rgba(255,255,255,0.08)' : '#ECE9F6'
  const visibleShortcuts = shortcuts.filter((s) => s.label !== 'Your School' || isSchoolMember(profile))
  const monogram = (school?.name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()

  return (
    <div className="app-shell">
      {/* Header: flat, with the menu on the left and quick actions on the right */}
      <header
        style={{
          padding: '14px 16px 12px',
          background: dark ? '#150F45' : '#FFFFFF',
          borderBottom: `1px solid ${line}`,
        }}
      >
        <div className="flex items-center gap-2.5">
          <IconButton label="Open menu" onClick={() => setDrawerOpen(true)} tint dark={dark}>
            <Menu size={21} />
          </IconButton>
          <div className="flex-1 min-w-0">
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1, color: ink }}>
              School<span style={{ color: ACCENT }}>ink</span>
            </h1>
          </div>
          <IconButton label="Search" onClick={() => navigate('/search')} dark={dark}>
            <Search size={19} />
          </IconButton>
          <IconButton label="Notifications" onClick={() => navigate('/notifications')} badge={unread} dark={dark}>
            <Bell size={19} />
          </IconButton>
        </div>
      </header>

      <div className="screen-scroll" style={{ background: dark ? undefined : '#F6F4FF' }}>
        {/* Quick access */}
        <div className="flex gap-1 px-3 pt-4 pb-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {visibleShortcuts.map(({ label, icon: Icon, color, tint }) => (
            <button
              key={label}
              type="button"
              onClick={() => handleShortcut(label)}
              className="flex flex-col items-center gap-2 shrink-0"
              style={{ width: 74 }}
            >
              <span
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 18,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: dark ? 'rgba(255,255,255,0.08)' : tint,
                }}
              >
                <Icon size={23} color={dark ? '#E9E7FF' : color} />
              </span>
              <span style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.2, textAlign: 'center', color: ink }}>{label}</span>
            </button>
          ))}
        </div>

        {/* Your school */}
        {isSchoolMember(profile) && school ? (
          <button
            type="button"
            onClick={() => navigate('/school-profile')}
            className="flex items-center gap-3 mx-4 mt-3 rounded-2xl p-3.5 text-left"
            style={{ background: dark ? 'rgba(255,255,255,0.06)' : '#FFFFFF', border: `1px solid ${line}` }}
          >
            <span
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                overflow: 'hidden',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: dark ? 'rgba(124,92,255,0.22)' : '#EFEBFF',
              }}
            >
              {school.logo_url ? (
                <img src={school.logo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span style={{ color: ACCENT, fontWeight: 700, fontSize: 16 }}>{monogram}</span>
              )}
            </span>
            <span className="flex-1 min-w-0">
              <span className="flex items-center gap-1.5">
                <span className="truncate" style={{ fontSize: 15, fontWeight: 600, color: ink }}>{school.name}</span>
                <VerifiedBadge schoolId={school.id} size={15} />
              </span>
              <span className="block truncate" style={{ fontSize: 12, color: muted, marginTop: 2 }}>
                {school.location || 'Your school'} · {memberCount} members
              </span>
            </span>
            <ChevronRight size={18} color={muted} />
          </button>
        ) : null}

        <StatusRow />
        <ComposerBar />

        <div className="px-4 mt-4 space-y-4">
          <SiteAnnouncements />
          {loading ? (
            <p className="text-center text-gray-400 mt-8">Loading posts…</p>
          ) : posts.length === 0 ? (
            <div className="text-center mt-8" style={{ color: muted }}>
              <p style={{ fontWeight: 600, color: ink }}>No posts yet.</p>
              <p className="text-sm mt-1">Be the first to share something with your school.</p>
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
