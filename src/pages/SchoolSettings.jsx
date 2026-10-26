import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  GraduationCap, UserCog, UserPlus, UserCheck, CalendarDays, Clock, ShieldCheck, ChevronRight, Sparkles, Gift,
} from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { PlusSeal, useIsPlusSchool } from '../components/SchoolPlusBadge.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { canManageStaff } from '../lib/permissions.js'

function Row({ icon: Icon, tint, title, sub, badge, onClick }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left active:bg-gray-50">
      <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${tint}1F`, color: tint }}>
        <Icon size={19} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-semibold text-brand-navy leading-tight">{title}</span>
        <span className="block text-xs text-gray-500 mt-0.5 truncate">{sub}</span>
      </span>
      {badge ? <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center">{badge}</span> : null}
      <ChevronRight size={18} className="text-gray-300 shrink-0" />
    </button>
  )
}

function Group({ label, children }) {
  return (
    <div className="mt-6">
      <p className="px-5 text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400 mb-2">{label}</p>
      <div className="mx-4 rounded-2xl border border-gray-100 bg-white divide-y divide-gray-100 overflow-hidden">{children}</div>
    </div>
  )
}

// The headteacher's control room for everything about the school.
export default function SchoolSettings() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const schoolId = profile?.school_id
  const plus = useIsPlusSchool(schoolId)
  const [school, setSchool] = useState(null)
  const [counts, setCounts] = useState(null)
  const [pending, setPending] = useState(0)
  const [learners, setLearners] = useState(null)

  useEffect(() => {
    if (!schoolId) return
    supabase.from('schools').select('id, name, verified, verification_status, logo_url').eq('id', schoolId).maybeSingle().then(({ data }) => setSchool(data))
    supabase.rpc('school_follower_count', { p_school: schoolId }).then(({ data }) => setCounts(data))
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('status', 'pending').then(({ count }) => setPending(count || 0))
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('role', 'Student').eq('status', 'active').then(({ count }) => setLearners(count || 0))
  }, [schoolId])

  if (!canManageStaff(profile)) {
    return (
      <div className="app-shell">
        <BackHeader title="School settings" />
        <div className="screen-scroll px-6 flex items-center justify-center text-center text-gray-400">
          Only the headteacher or deputy head can open school settings.
        </div>
      </div>
    )
  }

  const total = counts?.total ?? 0
  const pct = Math.min(100, Math.round((total / 100) * 100))

  return (
    <div className="app-shell">
      <BackHeader title="School settings" />
      <div className="screen-scroll pb-10">
        <div className="mx-4 mt-1 rounded-3xl bg-brand-navy text-white p-5 relative overflow-hidden">
          <span className="absolute -right-10 -top-10 w-40 h-40 rounded-full border border-white/10" />
          <span className="absolute -right-4 -top-4 w-24 h-24 rounded-full border border-white/10" />
          <p className="text-[11px] uppercase tracking-[0.14em] text-white/50">Managing</p>
          <p className="text-xl font-extrabold tracking-tight mt-1 flex items-center gap-2 flex-wrap">
            {school?.name || 'Your school'} {plus ? <PlusSeal size={20} /> : null}
          </p>
          <div className="mt-4">
            <div className="flex items-end justify-between text-xs text-white/70">
              <span>{total >= 100 ? 'You passed 100 people' : `${total} of 100 people`}</span>
              <span>{total >= 100 ? '🎉' : `${100 - total} to go`}</span>
            </div>
            <div className="h-2 rounded-full bg-white/15 mt-1.5 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-amber-500" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-[11px] text-white/55 mt-2 flex items-center gap-1.5"><Gift size={12} /> Reach 100 students and followers to get School Plus free for a month.</p>
          </div>
        </div>

        <Group label="People">
          <Row icon={GraduationCap} tint="#6C4CE0" title="Learners" sub={learners == null ? 'Students by form' : `${learners} student${learners === 1 ? '' : 's'} · grouped by form`} onClick={() => navigate('/school-settings/learners')} />
          <Row icon={UserCog} tint="#EC4899" title="Staff" sub="Teachers and school team" onClick={() => navigate('/staff-directory')} />
          <Row icon={UserCheck} tint="#F59E0B" title="Join requests" sub="Approve people waiting to join" badge={pending || null} onClick={() => navigate('/pending-approvals')} />
          <Row icon={UserPlus} tint="#10B981" title="Invite people" sub="Codes and links for staff and students" onClick={() => navigate('/invite-member')} />
        </Group>

        <Group label="School life">
          <Row icon={CalendarDays} tint="#2563EB" title="Calendar and events" sub="Term dates, exams and events" onClick={() => navigate('/calendar')} />
          <Row icon={Clock} tint="#14B8A6" title="Timetable" sub="Lessons for each class" onClick={() => navigate('/timetable')} />
        </Group>

        <Group label="Verification">
          <Row icon={Sparkles} tint="#D97706" title="School Plus" sub={plus ? 'Active · gold badge on your profile' : '$2.99 a month · gold verified badge'} onClick={() => navigate('/school-settings/verification')} />
          <Row icon={ShieldCheck} tint="#0095F6" title="Free school verification" sub={school?.verified ? 'Your school is verified' : school?.verification_status === 'pending' ? 'Under review' : 'Send your registration document'} onClick={() => navigate('/school-profile/verification')} />
        </Group>
      </div>
    </div>
  )
}
