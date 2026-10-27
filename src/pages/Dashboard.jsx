import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, FileText, Heart, MessageCircle, Clock, BarChart3, RefreshCw, GraduationCap,
  CalendarDays, UserCog, Mail, ChevronRight, TrendingUp,
} from 'lucide-react'
import BottomNav from '../components/BottomNav.jsx'
import { DashHero, SectionTitle, Card, Bar, Denied, Empty } from '../components/DashKit.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useSchoolStats } from '../lib/useSchoolStats.js'
import { canManageStaff, isStaffMember } from '../lib/permissions.js'

const DAY_MS = 24 * 60 * 60 * 1000

function dayKey(d) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { profile, user } = useAuth()
  const schoolId = profile?.school_id
  const { stats, loading, refresh } = useSchoolStats(schoolId, user?.id)
  const [extra, setExtra] = useState({ roles: [], week: [], top: [], ready: false })
  const [spin, setSpin] = useState(false)

  const loadExtra = useCallback(async () => {
    if (!schoolId) return
    const { data: members } = await supabase.from('profiles').select('id, role').eq('school_id', schoolId).eq('status', 'active')
    const ids = (members ?? []).map((m) => m.id)

    const roleMap = {}
    ;(members ?? []).forEach((m) => {
      const r = m.role || 'Member'
      roleMap[r] = (roleMap[r] || 0) + 1
    })
    const roles = Object.entries(roleMap).sort((a, b) => b[1] - a[1])

    let posts = []
    if (ids.length) {
      const { data } = await supabase.from('posts').select('id, content, created_at').in('author_id', ids).order('created_at', { ascending: false }).limit(100)
      posts = data ?? []
    }
    const postIds = posts.map((p) => p.id)
    let likes = []
    let comments = []
    if (postIds.length) {
      const [l, c] = await Promise.all([
        supabase.from('likes').select('post_id').in('post_id', postIds),
        supabase.from('comments').select('post_id').in('post_id', postIds),
      ])
      likes = l.data ?? []
      comments = c.data ?? []
    }

    const score = {}
    likes.forEach((x) => { score[x.post_id] = (score[x.post_id] || 0) + 1 })
    comments.forEach((x) => { score[x.post_id] = (score[x.post_id] || 0) + 1 })
    const top = posts
      .map((p) => ({ ...p, score: score[p.id] || 0 }))
      .filter((p) => p.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const week = []
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(today.getTime() - i * DAY_MS)
      week.push({ key: dayKey(d), label: d.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 3), count: 0, today: i === 0 })
    }
    posts.forEach((p) => {
      const k = dayKey(new Date(p.created_at))
      const hit = week.find((w) => w.key === k)
      if (hit) hit.count += 1
    })

    setExtra({ roles, week, top, ready: true })
  }, [schoolId])

  useEffect(() => { loadExtra() }, [loadExtra])

  async function handleRefresh() {
    setSpin(true)
    await Promise.all([refresh(), loadExtra()])
    setSpin(false)
  }

  const name = (profile?.full_name || user?.email?.split('@')[0] || 'there').split(' ')[0]
  const engagement = stats.posts > 0 ? ((stats.likes + stats.comments) / stats.posts).toFixed(1) : '0.0'
  const weekMax = useMemo(() => Math.max(1, ...extra.week.map((w) => w.count)), [extra.week])
  const weekTotal = extra.week.reduce((s, w) => s + w.count, 0)
  const roleMax = extra.roles.length ? extra.roles[0][1] : 1

  if (!isStaffMember(profile)) {
    return <Denied title="Analytics" text="This dashboard is only available to school staff members." />
  }

  const kpis = [
    { label: 'Posts', value: stats.posts, icon: FileText, tone: 'bg-brand-light text-brand-purple' },
    { label: 'Likes', value: stats.likes, icon: Heart, tone: 'bg-red-50 text-red-500' },
    { label: 'Comments', value: stats.comments, icon: MessageCircle, tone: 'bg-blue-50 text-blue-600' },
    { label: 'Per post', value: engagement, icon: TrendingUp, tone: 'bg-green-50 text-green-600', hint: 'likes + comments' },
  ]

  const actions = [
    { label: 'Learners', icon: GraduationCap, to: '/school-settings/learners' },
    { label: 'Staff directory', icon: UserCog, to: '/staff-directory' },
    ...(canManageStaff(profile) ? [{ label: 'Invite someone', icon: Mail, to: '/invite-member' }] : []),
    { label: 'Calendar', icon: CalendarDays, to: '/calendar' },
  ]

  return (
    <div className="app-shell">
      <div className="screen-scroll">
        <DashHero
          icon={BarChart3}
          title="School analytics"
          subtitle={`${greeting()}, ${name}`}
          right={(
            <button onClick={handleRefresh} aria-label="Refresh" className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.14)' }}>
              <RefreshCw size={16} color="#fff" className={spin ? 'animate-spin' : ''} />
            </button>
          )}
          stats={[
            { label: 'Members', value: loading ? '–' : stats.members },
            { label: 'Followers', value: loading ? '–' : stats.followers },
            { label: 'Pending', value: loading ? '–' : stats.pendingApprovals },
          ]}
        />

        <div className="px-4 pb-28">
          {stats.pendingApprovals > 0 && canManageStaff(profile) ? (
            <button
              onClick={() => navigate('/pending-approvals')}
              className="w-full mt-4 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left"
            >
              <span className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center"><Clock size={19} className="text-amber-600" /></span>
              <span className="flex-1">
                <span className="block text-sm font-semibold text-amber-900">{stats.pendingApprovals} {stats.pendingApprovals === 1 ? 'person is' : 'people are'} waiting for approval</span>
                <span className="block text-xs text-amber-700">Tap to review</span>
              </span>
              <ChevronRight size={18} className="text-amber-500" />
            </button>
          ) : null}

          <SectionTitle>Engagement</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            {kpis.map(({ label, value, icon: Icon, tone, hint }) => (
              <Card key={label}>
                <div className="flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-[0.1em] text-gray-400 font-semibold">{label}</p>
                  <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${tone}`}><Icon size={16} /></span>
                </div>
                <p className="text-[28px] font-extrabold tracking-tight text-brand-navy leading-none mt-3 tabular-nums">{loading ? '–' : typeof value === 'number' ? value.toLocaleString() : value}</p>
                {hint ? <p className="text-[11px] text-gray-400 mt-1.5">{hint}</p> : null}
              </Card>
            ))}
          </div>

          <SectionTitle>Posts this week</SectionTitle>
          <Card>
            {extra.ready && weekTotal === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No posts in the last 7 days.</p>
            ) : (
              <>
                <div className="flex items-end gap-2 h-32">
                  {extra.week.map((w) => (
                    <div key={w.key} className="flex-1 h-full flex flex-col items-center justify-end gap-1.5">
                      <span className="text-[11px] font-semibold text-gray-500 tabular-nums">{w.count || ''}</span>
                      <div
                        className="w-full rounded-t-lg"
                        style={{ height: `${w.count ? Math.max(8, (w.count / weekMax) * 84) : 3}%`, background: w.today ? '#6D4DFF' : '#C9BEFF', minHeight: 3 }}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  {extra.week.map((w) => (
                    <p key={w.key} className={`flex-1 text-center text-[11px] ${w.today ? 'font-bold text-brand-navy' : 'text-gray-400'}`}>{w.label}</p>
                  ))}
                </div>
              </>
            )}
          </Card>

          <SectionTitle>Who is in your school</SectionTitle>
          <Card>
            {!extra.ready ? (
              <p className="text-sm text-gray-400 text-center py-4">Loading…</p>
            ) : extra.roles.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No members yet.</p>
            ) : (
              <div className="space-y-3.5">
                {extra.roles.map(([role, count]) => (
                  <div key={role}>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-sm font-medium text-brand-navy">{role}</p>
                      <p className="text-sm font-bold text-brand-navy tabular-nums">{count}</p>
                    </div>
                    <Bar value={count} max={roleMax} />
                  </div>
                ))}
              </div>
            )}
          </Card>

          <SectionTitle>Top posts</SectionTitle>
          {extra.ready && extra.top.length === 0 ? (
            <Card><Empty icon={Heart} title="Nothing yet" text="Posts that get likes and comments will show up here." /></Card>
          ) : (
            <div className="space-y-2">
              {extra.top.map((p, i) => (
                <button key={p.id} onClick={() => navigate(`/post/${p.id}`)} className="w-full text-left flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3.5">
                  <span className="w-9 h-9 rounded-xl bg-brand-navy text-white font-extrabold flex items-center justify-center shrink-0">{i + 1}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-brand-navy line-clamp-2">{p.content || 'Photo or video post'}</span>
                    <span className="block text-xs text-gray-400 mt-0.5">{p.score} {p.score === 1 ? 'reaction' : 'reactions'}</span>
                  </span>
                  <ChevronRight size={17} className="text-gray-300" />
                </button>
              ))}
            </div>
          )}

          <SectionTitle>Shortcuts</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            {actions.map(({ label, icon: Icon, to }) => (
              <button key={label} onClick={() => navigate(to)} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3.5 text-left">
                <span className="w-10 h-10 rounded-xl bg-brand-light flex items-center justify-center shrink-0"><Icon size={19} className="text-brand-purple" /></span>
                <span className="text-sm font-semibold text-brand-navy">{label}</span>
              </button>
            ))}
          </div>
          <p className="flex items-center justify-center gap-1.5 text-xs text-gray-400 mt-6"><Users size={13} /> Numbers update every time you open this page.</p>
        </div>
      </div>
      <BottomNav />
    </div>
  )
    }
