import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, X, RefreshCw, ShieldCheck, Clock, GraduationCap } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import BottomNav from '../components/BottomNav.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { canManageStaff } from '../lib/permissions.js'

function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

function firstName(name) {
  return String(name || 'this member').trim().split(/\s+/)[0]
}

function Avatar({ p }) {
  if (p.avatar_url) {
    return <img src={p.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
  }
  return (
    <span className="w-11 h-11 rounded-full bg-brand-light text-brand-purple font-semibold text-sm flex items-center justify-center shrink-0">
      {initials(p.full_name)}
    </span>
  )
}

function ActionButtons({ p, busy, onApprove, onReject }) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <button
        type="button"
        onClick={() => onApprove(p)}
        disabled={busy}
        aria-label={`Approve ${p.full_name || 'member'}`}
        className="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center disabled:opacity-50"
      >
        <Check size={17} className="text-green-600" />
      </button>
      <button
        type="button"
        onClick={() => onReject(p)}
        disabled={busy}
        aria-label={`Turn down ${p.full_name || 'member'}`}
        className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center disabled:opacity-50"
      >
        <X size={17} className="text-red-500" />
      </button>
    </div>
  )
}

export default function PendingApprovals() {
  const { profile } = useAuth()
  const schoolId = profile?.school_id
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [message, setMessage] = useState('')

  // silent = true refreshes the list without the loading state (used for live updates)
  const loadPending = useCallback(async (silent = false) => {
    if (!schoolId) {
      setLoading(false)
      return
    }
    if (!silent) setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('school_id', schoolId)
      .eq('status', 'pending')
    if (error) setMessage("Couldn't load requests. Tap the refresh button to try again.")
    else setMessage('')
    setPending(data ?? [])
    setLoading(false)
  }, [schoolId])

  useEffect(() => { loadPending() }, [loadPending])

  // Live: a new request, an approval or a turn-down by anyone at the school shows up straight away.
  useEffect(() => {
    if (!schoolId) return undefined
    let timer = null
    const later = () => {
      clearTimeout(timer)
      timer = setTimeout(() => loadPending(true), 250)
    }
    const channel = supabase
      .channel(`pending-approvals-${schoolId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `school_id=eq.${schoolId}` }, later)
      .subscribe()
    // Coming back to the app: catch anything missed while it was in the background.
    const onVisible = () => { if (document.visibilityState === 'visible') later() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(timer)
      supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [schoolId, loadPending])

  // Learners first, then staff. Each group is sorted by name.
  const { students, staff } = useMemo(() => {
    const byName = (a, b) => String(a.full_name || '').localeCompare(String(b.full_name || ''))
    return {
      students: pending.filter((p) => p.role === 'Student').sort(byName),
      staff: pending.filter((p) => p.role !== 'Student').sort(byName),
    }
  }, [pending])

  async function handleApprove(p) {
    setBusyId(p.id)
    setMessage('')
    const { error } = await supabase.from('profiles').update({ status: 'active' }).eq('id', p.id)
    setBusyId(null)
    if (error) {
      setMessage(`Couldn't approve ${firstName(p.full_name)}. Try again.`)
      return
    }
    setPending((prev) => prev.filter((row) => row.id !== p.id))
    setMessage(`${firstName(p.full_name)} is approved`)
  }

  async function handleReject(p) {
    const name = p.full_name || 'this person'
    if (!window.confirm(`Turn down ${name}'s request to join the school?`)) return
    setBusyId(p.id)
    setMessage('')
    const { error } = await supabase
      .from('profiles')
      .update({ school_id: null, role: null, account_type: 'guest', status: 'active', class_name: null, admission_no: null })
      .eq('id', p.id)
    setBusyId(null)
    if (error) {
      setMessage(`Couldn't turn down ${firstName(p.full_name)}. Try again.`)
      return
    }
    setPending((prev) => prev.filter((row) => row.id !== p.id))
    setMessage(`${firstName(p.full_name)}'s request was turned down`)
  }

  if (!canManageStaff(profile)) {
    return (
      <div className="flex-1 flex flex-col">
        <BackHeader title="Pending Approvals" />
        <div className="screen-scroll px-4 flex items-center justify-center text-gray-400 text-center">
          Only Headteachers and Deputy Heads can view this page.
        </div>
        <BottomNav />
      </div>
    )
  }

  const total = pending.length

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader title="Pending Approvals" />
      <div className="screen-scroll px-4 pt-2 pb-6">
        {/* Count and refresh */}
        <div className="flex items-center justify-between py-2">
          <p className="text-xs text-gray-400">
            {loading ? 'Checking requests…' : total === 0 ? 'Nothing waiting' : `${total} waiting for approval`}
          </p>
          <button
            type="button"
            onClick={() => loadPending()}
            aria-label="Refresh requests"
            className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        {message ? <p className="text-sm text-brand-purple text-center py-2">{message}</p> : null}

        {loading ? (
          <p className="text-center text-gray-400 mt-8">Loading…</p>
        ) : total === 0 ? (
          <div className="text-center py-14">
            <span className="mx-auto w-14 h-14 rounded-full bg-brand-light flex items-center justify-center">
              <Clock size={24} className="text-brand-purple" />
            </span>
            <p className="font-medium mt-3">No pending requests</p>
            <p className="text-sm text-gray-400 mt-1">New learners and staff who ask to join your school will appear here.</p>
          </div>
        ) : null}

        {/* Learners */}
        {students.length > 0 ? (
          <section className="mt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 px-1 mb-2 flex items-center gap-1.5">
              <GraduationCap size={14} /> Learners ({students.length})
            </p>
            <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100 px-3">
              {students.map((p) => (
                <div key={p.id} className="flex items-center gap-3 py-3.5">
                  <Avatar p={p} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{p.full_name || 'Unnamed learner'}</p>
                    <p className="text-xs text-gray-500 truncate">
                      Student
                      {p.class_name ? ` · ${p.class_name}` : ''}
                      {p.admission_no ? ` · Adm ${p.admission_no}` : ''}
                    </p>
                    {p.student_verified ? (
                      <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-green-700 bg-green-50 rounded-full px-2 py-0.5">
                        <ShieldCheck size={12} /> Report verified
                      </span>
                    ) : (
                      <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">
                        <Clock size={12} /> Waiting for Schoolink check
                      </span>
                    )}
                  </div>
                  <ActionButtons p={p} busy={busyId === p.id} onApprove={handleApprove} onReject={handleReject} />
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* Staff */}
        {staff.length > 0 ? (
          <section className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 px-1 mb-2">
              Staff ({staff.length})
            </p>
            <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100 px-3">
              {staff.map((p) => (
                <div key={p.id} className="flex items-center gap-3 py-3.5">
                  <Avatar p={p} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{p.full_name || 'Unnamed member'}</p>
                    <p className="text-xs text-gray-500 truncate">{p.role || 'Staff'}</p>
                  </div>
                  <ActionButtons p={p} busy={busyId === p.id} onApprove={handleApprove} onReject={handleReject} />
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
      <BottomNav />
    </div>
  )
      }
