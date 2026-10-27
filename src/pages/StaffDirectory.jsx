import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageCircle, UserX, UserPlus, User, ChevronRight, Users, Clock, Loader2 } from 'lucide-react'
import BottomNav from '../components/BottomNav.jsx'
import VerifiedBadge from '../components/VerifiedBadge.jsx'
import { DashHero, SearchBox, Tabs, Empty, Sheet, Pill, Denied } from '../components/DashKit.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { isSchoolMember, canManageStaff } from '../lib/permissions.js'
import { useOnlineIds } from '../lib/presence.jsx'

const GROUPS = ['Leadership', 'Teachers', 'Support staff', 'Students']

function groupOf(m) {
  if (m.role === 'Student') return 'Students'
  if (m.role === 'Headteacher' || m.role === 'Deputy Head') return 'Leadership'
  if (m.role === 'Teacher / Tutor') return 'Teachers'
  return 'Support staff'
}

function rank(m) {
  if (m.role === 'Headteacher') return 0
  if (m.role === 'Deputy Head') return 1
  return 2
}

function Avatar({ member, size = 48, online }) {
  const initial = (member.full_name || '?').slice(0, 1).toUpperCase()
  return (
    <span className="relative shrink-0" style={{ width: size, height: size }}>
      {member.avatar_url ? (
        <img src={member.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
      ) : (
        <span className="w-full h-full rounded-full bg-brand-light text-brand-purple font-extrabold flex items-center justify-center" style={{ fontSize: size * 0.4 }}>{initial}</span>
      )}
      {online ? <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-white" /> : null}
    </span>
  )
}

export default function StaffDirectory() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const onlineIds = useOnlineIds()
  const [members, setMembers] = useState([])
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all')
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState(null) // member whose action sheet is open
  const [confirm, setConfirm] = useState(null) // member about to be removed
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const manager = canManageStaff(profile)
  const schoolId = profile?.school_id

  const loadMembers = useCallback(async () => {
    if (!schoolId) { setLoading(false); return }
    const { data } = await supabase.from('profiles').select('*').eq('school_id', schoolId).eq('status', 'active')
    setMembers(data ?? [])
    if (manager) {
      const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('status', 'pending')
      setPendingCount(count ?? 0)
    }
    setLoading(false)
  }, [schoolId, manager])

  useEffect(() => { loadMembers() }, [loadMembers])

  // Someone joined, left or was removed: refresh the list on its own.
  useEffect(() => {
    if (!schoolId) return undefined
    const channel = supabase
      .channel(`staff-dir-${schoolId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `school_id=eq.${schoolId}` }, () => loadMembers())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [schoolId, loadMembers])

  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(''), 2800)
    return () => clearTimeout(t)
  }, [toast])

  // Headteacher can remove anyone but themselves. Deputy head can remove anyone except the headteacher and other deputies.
  function canRemove(m) {
    if (!manager || m.id === user.id || m.role === 'Headteacher') return false
    if (m.role === 'Deputy Head') return profile?.role === 'Headteacher'
    return true
  }

  async function removeMember() {
    const m = confirm
    if (!m || removing) return
    setRemoving(true)
    setError('')
    let failed = ''
    const { data: res, error: rpcErr } = await supabase.rpc('remove_school_member', { p_user: m.id })
    if (rpcErr) {
      // The SQL has not been run yet: fall back to the plain update so removal still works.
      const { data: rows, error: upErr } = await supabase
        .from('profiles')
        .update({ school_id: null, role: null, account_type: 'guest', class_name: null })
        .eq('id', m.id)
        .select('id')
      if (upErr || !rows?.length) failed = upErr?.message || 'Could not remove this person.'
    } else if (!res?.ok) {
      failed = res?.error || 'Could not remove this person.'
    }
    setRemoving(false)
    if (failed) { setError(failed); return }
    setMembers((prev) => prev.filter((x) => x.id !== m.id))
    setConfirm(null)
    setPicked(null)
    setToast(`${m.full_name || 'Member'} was removed from the school`)
  }

  const staffCount = members.filter((m) => m.role !== 'Student').length
  const studentCount = members.length - staffCount

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return members
      .filter((m) => {
        if (tab === 'staff' && m.role === 'Student') return false
        if (tab === 'students' && m.role !== 'Student') return false
        if (!q) return true
        return `${m.full_name || ''} ${m.role || ''} ${m.class_name || ''}`.toLowerCase().includes(q)
      })
      .sort((a, b) => rank(a) - rank(b) || (a.full_name || '').localeCompare(b.full_name || ''))
  }, [members, tab, query])

  const grouped = GROUPS.map((g) => ({ name: g, list: shown.filter((m) => groupOf(m) === g) })).filter((g) => g.list.length)

  if (!isSchoolMember(profile)) {
    return <Denied title="Staff directory" text="You need to belong to a school to view its staff directory." />
  }

  return (
    <div className="app-shell">
      <div className="screen-scroll">
        <DashHero
          icon={Users}
          title="Staff directory"
          subtitle="Everyone in your school"
          stats={[
            { label: 'Members', value: members.length },
            { label: 'Staff', value: staffCount },
            { label: 'Students', value: studentCount },
          ]}
          right={manager ? (
            <button onClick={() => navigate('/invite-member')} className="h-9 px-4 rounded-full text-[13px] font-semibold flex items-center gap-1.5" style={{ background: 'rgba(255,255,255,0.18)', color: '#fff' }}>
              <UserPlus size={15} color="#fff" /> Invite
            </button>
          ) : null}
        />

        <div className="px-4 pb-28">
          {manager && pendingCount > 0 ? (
            <button onClick={() => navigate('/pending-approvals')} className="w-full mt-4 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left">
              <span className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center"><Clock size={19} className="text-amber-600" /></span>
              <span className="flex-1 text-sm font-semibold text-amber-900">{pendingCount} {pendingCount === 1 ? 'person is' : 'people are'} waiting to join</span>
              <ChevronRight size={18} className="text-amber-500" />
            </button>
          ) : null}

          <div className="mt-4">
            <SearchBox value={query} onChange={setQuery} placeholder="Search by name, role or class" />
          </div>
          <div className="mt-3">
            <Tabs
              value={tab}
              onChange={setTab}
              items={[
                { key: 'all', label: 'Everyone', count: members.length },
                { key: 'staff', label: 'Staff', count: staffCount },
                { key: 'students', label: 'Students', count: studentCount },
              ]}
            />
          </div>

          {toast ? <p className="mt-3 text-xs bg-gray-900 text-white rounded-full px-4 py-2 text-center">{toast}</p> : null}

          {loading ? (
            <p className="text-center text-gray-400 py-12">Loading…</p>
          ) : grouped.length === 0 ? (
            <Empty icon={User} title={members.length === 0 ? 'No members yet' : 'Nobody found'} text={members.length === 0 ? 'Invite people to your school to see them here.' : 'Try a different search.'} />
          ) : (
            grouped.map((g) => (
              <div key={g.name}>
                <p className="mt-6 mb-2 px-0.5 text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400">{g.name} · {g.list.length}</p>
                <div className="rounded-2xl border border-gray-100 bg-white divide-y divide-gray-100">
                  {g.list.map((m) => {
                    const me = m.id === user.id
                    return (
                      <button key={m.id} onClick={() => setPicked(m)} className="w-full flex items-center gap-3 p-3.5 text-left">
                        <Avatar member={m} online={onlineIds.has(m.id)} />
                        <span className="flex-1 min-w-0">
                          <span className="flex items-center gap-1.5">
                            <span className="font-semibold text-[15px] text-brand-navy truncate">{m.full_name || 'Unnamed member'}</span>
                            <VerifiedBadge userId={m.id} size={14} />
                            {me ? <span className="text-[10px] font-bold text-brand-purple bg-brand-light rounded-full px-1.5 py-0.5">YOU</span> : null}
                          </span>
                          <span className="block text-xs text-gray-400 truncate">{m.role}{m.role === 'Student' && m.class_name ? ` · ${m.class_name}` : ''}</span>
                        </span>
                        <ChevronRight size={17} className="text-gray-300 shrink-0" />
                      </button>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      <BottomNav />

      <Sheet open={!!picked} title="" onClose={() => setPicked(null)}>
        {picked ? (
          <>
            <div className="flex flex-col items-center text-center -mt-4">
              <Avatar member={picked} size={84} online={onlineIds.has(picked.id)} />
              <p className="mt-3 text-lg font-extrabold tracking-tight text-brand-navy flex items-center gap-1.5">{picked.full_name || 'Unnamed member'} <VerifiedBadge userId={picked.id} size={16} /></p>
              <div className="flex items-center gap-2 mt-1.5">
                <Pill tone="purple">{picked.role}</Pill>
                {picked.role === 'Student' && picked.class_name ? <Pill tone="gray">{picked.class_name}</Pill> : null}
                {onlineIds.has(picked.id) ? <Pill tone="green">Online</Pill> : null}
              </div>
            </div>
            <div className="space-y-2 pt-2">
              {picked.id !== user.id ? (
                <button onClick={() => navigate(`/chats/${picked.id}`)} className="w-full h-12 rounded-2xl bg-brand-purple text-white font-semibold flex items-center justify-center gap-2"><MessageCircle size={18} /> Message</button>
              ) : null}
              <button onClick={() => navigate(picked.id === user.id ? '/profile' : `/users/${picked.id}`)} className="w-full h-12 rounded-2xl border border-gray-200 text-brand-navy font-semibold flex items-center justify-center gap-2"><User size={18} /> View profile</button>
              {canRemove(picked) ? (
                <button onClick={() => { setError(''); setConfirm(picked) }} className="w-full h-12 rounded-2xl border border-red-200 text-red-500 font-semibold flex items-center justify-center gap-2"><UserX size={18} /> Remove from school</button>
              ) : null}
            </div>
          </>
        ) : null}
      </Sheet>

      <Sheet
        open={!!confirm}
        title="Remove from school?"
        onClose={() => !removing && setConfirm(null)}
        footer={(
          <>
            {error ? <p className="text-red-500 text-sm mb-2">{error}</p> : null}
            <div className="flex gap-2">
              <button onClick={() => setConfirm(null)} disabled={removing} className="flex-1 h-12 rounded-2xl border border-gray-200 font-semibold">Cancel</button>
              <button onClick={removeMember} disabled={removing} className="flex-1 h-12 rounded-2xl bg-red-600 text-white font-semibold flex items-center justify-center disabled:opacity-60">
                {removing ? <Loader2 size={18} className="animate-spin" /> : 'Remove'}
              </button>
            </div>
          </>
        )}
      >
        {confirm ? (
          <p className="text-sm text-gray-500 leading-relaxed">
            <span className="font-semibold text-brand-navy">{confirm.full_name || 'This person'}</span> will leave {'your school'} and lose access to its staff tools and school feed. Their account and posts stay on Schoolink, and they can join again with a new invite.
          </p>
        ) : null}
      </Sheet>
    </div>
  )
}
