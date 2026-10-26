import { useEffect, useMemo, useState } from 'react'
import { Search, Loader2, Users, Pencil } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import PersonAvatar from '../components/PersonAvatar.jsx'
import StudentClasses from '../components/StudentClasses.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { isStaffMember, canManageStaff } from '../lib/permissions.js'
import { levelOf, levelRank } from '../lib/forms.js'

// Every learner of the school, grouped by form: Form 1, Form 2 ... Lower 6, Upper 6.
export default function SchoolLearners() {
  const { profile } = useAuth()
  const schoolId = profile?.school_id
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [level, setLevel] = useState('all')
  const [assigning, setAssigning] = useState(false)

  async function load() {
    const { data, error: e } = await supabase.rpc('school_learners', { p_school: schoolId })
    if (e) { setError(e.message); setRows([]); return }
    setRows(data ?? [])
  }

  useEffect(() => { if (schoolId) load() }, [schoolId])

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = (rows || []).filter((r) => !q || (r.full_name || '').toLowerCase().includes(q) || (r.form || '').toLowerCase().includes(q))
    const map = new Map()
    filtered.forEach((r) => {
      const l = levelOf(r.form)
      if (!map.has(l)) map.set(l, [])
      map.get(l).push(r)
    })
    return [...map.entries()].sort((a, b) => levelRank(a[0]) - levelRank(b[0]))
  }, [rows, query])

  const allLevels = useMemo(() => {
    const set = new Set((rows || []).map((r) => levelOf(r.form)))
    return [...set].sort((a, b) => levelRank(a) - levelRank(b))
  }, [rows])

  if (!isStaffMember(profile)) {
    return (
      <div className="app-shell">
        <BackHeader title="Learners" />
        <div className="screen-scroll px-6 flex items-center justify-center text-center text-gray-400">Only school staff can see the learners list.</div>
      </div>
    )
  }

  const shown = level === 'all' ? groups : groups.filter(([l]) => l === level)
  const total = (rows || []).length

  return (
    <div className="app-shell">
      <BackHeader title="Learners" />
      <div className="px-4">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or form" className="w-full bg-gray-100 rounded-full pl-10 pr-4 py-2.5 text-sm outline-none" />
        </div>
        <div className="flex gap-2 overflow-x-auto mt-3 pb-1" style={{ scrollbarWidth: 'none' }}>
          {[['all', `All (${total})`], ...allLevels.map((l) => [l, `${l} (${(rows || []).filter((r) => levelOf(r.form) === l).length})`])].map(([k, label]) => (
            <button key={k} onClick={() => setLevel(k)} className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ${level === k ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-600'}`}>{label}</button>
          ))}
        </div>
        {canManageStaff(profile) || isStaffMember(profile) ? (
          <button onClick={() => setAssigning(true)} className="mt-2 mb-1 flex items-center gap-1.5 text-sm font-semibold text-brand-purple"><Pencil size={14} /> Move students to a form</button>
        ) : null}
      </div>

      <div className="screen-scroll">
        {!rows ? (
          <p className="text-center text-gray-400 mt-10"><Loader2 className="animate-spin inline" /></p>
        ) : error ? (
          <p className="text-center text-red-500 text-sm mt-10 px-6">{error}</p>
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-center text-center px-8 pt-14">
            <span className="w-16 h-16 rounded-full bg-brand-light flex items-center justify-center mb-3"><Users size={28} className="text-brand-purple" /></span>
            <p className="font-semibold">{total ? 'No learners match' : 'No learners yet'}</p>
            <p className="text-sm text-gray-500 mt-1">Students appear here when they join with your student code or follow your school as a student.</p>
          </div>
        ) : shown.map(([l, list]) => (
          <div key={l} className="mt-3">
            <div className="flex items-baseline justify-between px-5 py-1.5 bg-gray-50 sticky top-0 z-10">
              <p className="text-[13px] font-extrabold tracking-tight text-brand-navy">{l}</p>
              <p className="text-xs text-gray-400">{list.length}</p>
            </div>
            {list.map((s) => (
              <div key={`${s.kind}-${s.id}`} className="flex items-center gap-3 px-5 py-2.5">
                <PersonAvatar p={s} size={40} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{s.full_name || 'Student'}</p>
                  <p className="text-xs text-gray-400 truncate">{s.form || 'No form yet'}</p>
                </div>
                {s.kind === 'follower' ? <span className="text-[10px] font-semibold text-brand-purple bg-brand-light rounded-full px-2 py-0.5">Follower</span> : null}
                {s.status === 'pending' ? <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 rounded-full px-2 py-0.5">Waiting</span> : null}
              </div>
            ))}
          </div>
        ))}
        <div className="h-8" />
      </div>

      {assigning ? <StudentClasses schoolId={schoolId} classes={[]} onClose={() => setAssigning(false)} onChanged={load} /> : null}
    </div>
  )
}
