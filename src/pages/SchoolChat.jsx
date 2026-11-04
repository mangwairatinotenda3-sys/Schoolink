import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Loader2, Search, ShieldCheck, X } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import {
  canManageSchoolChat, canSetSchoolChatManagers, CHAT_LEADER_ROLES, displayName, fetchPeople, learnerDetail, shortTime,
} from '../lib/schoolChat.js'

const ACCENT = '#6C4CE0'

const FILTERS = [
  { key: 'open', label: 'Open' },
  { key: 'mine', label: 'Assigned to me' },
  { key: 'closed', label: 'Closed' },
]

function Avatar({ name, size = 44 }) {
  return (
    <span
      className="rounded-full flex items-center justify-center shrink-0 font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.38, background: '#EFEBFF', color: ACCENT }}
    >
      {(name || '?').trim().slice(0, 1).toUpperCase()}
    </span>
  )
}

function Loading({ title }) {
  return (
    <div className="app-shell">
      <BackHeader title={title} />
      <div className="screen-scroll flex items-center justify-center">
        <Loader2 className="animate-spin text-brand-purple" />
      </div>
    </div>
  )
}

// Anyone who is not a manager: opens their own conversation with the school.
function StartChat({ schoolId }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function open() {
      setError('')
      const { error: upErr } = await supabase
        .from('school_chat_threads')
        .upsert({ school_id: schoolId, requester_id: user.id }, { onConflict: 'school_id,requester_id', ignoreDuplicates: true })
      if (cancelled) return
      if (upErr) {
        setError("Couldn't open the school chat. Check your connection and try again.")
        return
      }
      const { data, error: selErr } = await supabase
        .from('school_chat_threads')
        .select('id')
        .eq('school_id', schoolId)
        .eq('requester_id', user.id)
        .maybeSingle()
      if (cancelled) return
      if (selErr || !data) {
        setError("Couldn't open the school chat. Try again.")
        return
      }
      navigate(`/school-chat/thread/${data.id}`, { replace: true })
    }
    open()
    return () => { cancelled = true }
  }, [schoolId, user?.id, attempt])

  if (!error) return <Loading title="School chat" />

  return (
    <div className="app-shell">
      <BackHeader title="School chat" />
      <div className="screen-scroll flex flex-col items-center justify-center gap-4 px-6 text-center text-gray-500">
        <p>{error}</p>
        <button
          type="button"
          onClick={() => setAttempt((n) => n + 1)}
          className="bg-brand-purple text-white rounded-full px-5 py-2.5 text-sm font-semibold"
        >
          Try again
        </button>
      </div>
    </div>
  )
}

function ThreadRow({ t, people, onOpen }) {
  const requester = people[t.requester_id]
  const assignee = people[t.assigned_to]
  return (
    <li>
      <button type="button" onClick={onOpen} className="w-full flex items-center gap-3 px-4 py-3.5 text-left border-b border-gray-100">
        <Avatar name={displayName(requester)} />
        <span className="flex-1 min-w-0">
          <span className="flex items-center justify-between gap-2">
            <span className="font-semibold text-[15px] truncate text-brand-navy">{displayName(requester)}</span>
            <span className="text-[12px] text-gray-400 shrink-0">{shortTime(t.last_message_at)}</span>
          </span>
          {learnerDetail(requester) ? <span className="block text-[12px] text-gray-400 truncate">{learnerDetail(requester)}</span> : null}
          <span className="block text-[13px] text-gray-600 truncate mt-0.5">{t.last_preview}</span>
          <span
            className="inline-block mt-1.5 text-[11px] font-medium rounded-full px-2 py-0.5"
            style={{ background: t.assigned_to ? '#EFEBFF' : '#F3F4F6', color: t.assigned_to ? ACCENT : '#6B7280' }}
          >
            {t.assigned_to ? `With ${displayName(assignee)}` : 'Unassigned'}
          </span>
        </span>
      </button>
    </li>
  )
}

// Choose who can answer the school chat. Leaders are always managers.
function ManagersSheet({ schoolId, onClose }) {
  const [staff, setStaff] = useState([])
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  async function load() {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role, is_school_chat_manager')
      .eq('school_id', schoolId)
      .eq('status', 'active')
      .neq('role', 'Student')
      .order('full_name')
    setStaff(data ?? [])
  }

  useEffect(() => { load() }, [schoolId])

  async function toggle(person) {
    if (busyId) return
    const on = !person.is_school_chat_manager
    setBusyId(person.id)
    setError('')
    const { data, error: err } = await supabase.rpc('set_school_chat_manager', { p_user: person.id, p_on: on })
    setBusyId(null)
    if (err || !data?.ok) {
      setError(data?.error || "Couldn't update. Try again.")
      return
    }
    setStaff((prev) => prev.map((s) => (s.id === person.id ? { ...s, is_school_chat_manager: on } : s)))
  }

  const q = query.trim().toLowerCase()
  const shown = staff.filter((s) => (s.full_name || '').toLowerCase().includes(q))

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[520px] bg-white rounded-t-3xl px-5 pt-3 pb-8 max-h-[85dvh] flex flex-col">
        <span className="block w-10 h-1.5 rounded-full bg-gray-200 mx-auto mb-4" />
        <div className="flex items-center justify-between">
          <p className="text-[18px] font-semibold text-brand-navy">School chat managers</p>
          <button type="button" onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
            <X size={18} />
          </button>
        </div>
        <p className="text-[13px] text-gray-500 mt-1.5 leading-relaxed">
          Managers answer messages sent to the school and can refer them to any staff member. Headteachers and deputies are always managers.
        </p>
        <div className="relative mt-4">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search staff"
            className="w-full rounded-xl border border-gray-200 pl-10 pr-4 py-3 text-[14px] outline-none"
          />
        </div>
        {error ? <p className="text-[13px] text-red-500 mt-3">{error}</p> : null}
        <ul className="mt-2 overflow-y-auto divide-y divide-gray-100">
          {shown.map((s) => {
            const leader = CHAT_LEADER_ROLES.includes(s.role)
            const on = leader || !!s.is_school_chat_manager
            return (
              <li key={s.id} className="flex items-center gap-3 py-3">
                <Avatar name={displayName(s)} size={40} />
                <span className="flex-1 min-w-0">
                  <span className="block text-[14px] font-medium truncate text-brand-navy">{displayName(s)}</span>
                  <span className="block text-[12px] text-gray-500">{s.role}{leader ? ' · always a manager' : ''}</span>
                </span>
                <button
                  type="button"
                  disabled={leader || busyId === s.id}
                  onClick={() => toggle(s)}
                  className="shrink-0 h-8 px-3.5 rounded-full text-[13px] font-semibold disabled:opacity-60 flex items-center gap-1.5"
                  style={{ background: on ? ACCENT : '#F3F1FA', color: on ? '#FFFFFF' : '#1B1450' }}
                >
                  {busyId === s.id ? <Loader2 size={14} className="animate-spin" /> : on ? 'Manager' : 'Make manager'}
                </button>
              </li>
            )
          })}
        </ul>
        {shown.length === 0 ? <p className="text-center text-gray-400 text-[14px] py-8">No staff found.</p> : null}
      </div>
    </div>
  )
}

// Managers' inbox: every conversation with the school.
function Inbox({ schoolId }) {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [threads, setThreads] = useState([])
  const [people, setPeople] = useState({})
  const [filter, setFilter] = useState('open')
  const [loading, setLoading] = useState(true)
  const [managersOpen, setManagersOpen] = useState(false)
  const leader = canSetSchoolChatManagers(profile)

  async function load() {
    const { data } = await supabase
      .from('school_chat_threads')
      .select('*')
      .eq('school_id', schoolId)
      .not('last_preview', 'is', null)
      .order('last_message_at', { ascending: false })
      .limit(300)
    const rows = data ?? []
    setThreads(rows)
    const map = await fetchPeople(rows.flatMap((t) => [t.requester_id, t.assigned_to]))
    setPeople((prev) => ({ ...prev, ...map }))
    setLoading(false)
  }

  // Live: new messages and referrals show up without a refresh.
  useEffect(() => {
    load()
    let timer = null
    const later = () => {
      clearTimeout(timer)
      timer = setTimeout(load, 300)
    }
    const channel = supabase
      .channel(`school-chat-inbox-${schoolId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'school_chat_threads', filter: `school_id=eq.${schoolId}` }, later)
      .subscribe()
    return () => {
      clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [schoolId])

  const shown = threads.filter((t) => {
    if (filter === 'closed') return t.status === 'closed'
    if (t.status === 'closed') return false
    if (filter === 'mine') return t.assigned_to === user.id
    return true
  })

  const emptyText = filter === 'mine'
    ? 'Nothing is assigned to you right now.'
    : filter === 'closed'
      ? 'No closed conversations.'
      : 'No messages yet. When people message the school, they appear here.'

  return (
    <div className="app-shell">
      <BackHeader title="School chat" />
      <div className="screen-scroll">
        <div className="px-4 pt-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-[15px] text-brand-navy">Messages to the school</p>
            <p className="text-[12px] text-gray-500 mt-0.5">Replies come from the school chat managers.</p>
          </div>
          {leader ? (
            <button
              type="button"
              onClick={() => setManagersOpen(true)}
              className="shrink-0 flex items-center gap-1.5 border border-gray-200 rounded-full px-3 py-2 text-[13px] font-medium text-brand-navy"
            >
              <ShieldCheck size={15} /> Managers
            </button>
          ) : null}
        </div>

        <div className="flex gap-2 px-4 pt-4 pb-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {FILTERS.map((f) => {
            const on = filter === f.key
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className="shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium"
                style={{ background: on ? ACCENT : '#F3F1FA', color: on ? '#FFFFFF' : '#1B1450' }}
              >
                {f.label}
              </button>
            )
          })}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-brand-purple" /></div>
        ) : shown.length === 0 ? (
          <p className="text-center text-gray-400 text-[14px] py-14 px-6">{emptyText}</p>
        ) : (
          <ul>
            {shown.map((t) => (
              <ThreadRow key={t.id} t={t} people={people} onOpen={() => navigate(`/school-chat/thread/${t.id}`)} />
            ))}
          </ul>
        )}
      </div>

      {managersOpen ? <ManagersSheet schoolId={schoolId} onClose={() => setManagersOpen(false)} /> : null}
    </div>
  )
}

// /school-chat/:schoolId. Managers get the inbox. Everyone else goes to their own conversation.
export default function SchoolChat() {
  const { schoolId } = useParams()
  const { profile, loading } = useAuth()

  if (loading) return <Loading title="School chat" />
  if (canManageSchoolChat(profile) && profile.school_id === schoolId) return <Inbox schoolId={schoolId} />
  return <StartChat schoolId={schoolId} />
}
