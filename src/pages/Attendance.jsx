import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Check, Search, ChevronDown, ChevronUp, CalendarCheck, Users } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import BottomNav from '../components/BottomNav.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

const STATUSES = [
  { key: 'present', short: 'P', label: 'Present', on: 'bg-green-500 text-white border-green-500', dot: 'bg-green-500' },
  { key: 'absent', short: 'A', label: 'Absent', on: 'bg-red-500 text-white border-red-500', dot: 'bg-red-500' },
  { key: 'late', short: 'L', label: 'Late', on: 'bg-amber-500 text-white border-amber-500', dot: 'bg-amber-500' },
  { key: 'excused', short: 'E', label: 'Excused', on: 'bg-sky-500 text-white border-sky-500', dot: 'bg-sky-500' },
]

const RANGES = [
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: '30', label: 'Last 30 days' },
]

function canMark(profile) {
  return ['Teacher / Tutor', 'Headteacher', 'Deputy Head'].includes(profile?.role)
}

// Dates are kept as plain YYYY-MM-DD in the phone's own time, so "today" is never off by a day.
function toDateString(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function rangeStart(key) {
  const now = new Date()
  if (key === 'week') {
    const d = new Date(now)
    const diff = (d.getDay() + 6) % 7
    d.setDate(d.getDate() - diff)
    return toDateString(d)
  }
  if (key === 'month') return toDateString(new Date(now.getFullYear(), now.getMonth(), 1))
  const d = new Date(now)
  d.setDate(d.getDate() - 29)
  return toDateString(d)
}

function prettyDate(value) {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

function emptyCounts() {
  return { present: 0, absent: 0, late: 0, excused: 0 }
}

function rateOf(c) {
  const total = c.present + c.absent + c.late + c.excused
  if (total === 0) return null
  return Math.round(((c.present + c.late) / total) * 100)
}

function Avatar({ url }) {
  return url ? (
    <img src={url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
  ) : (
    <span className="w-9 h-9 rounded-full bg-brand-light flex items-center justify-center shrink-0 text-sm">🙂</span>
  )
}

function StatusDot({ status }) {
  const s = STATUSES.find((x) => x.key === status)
  if (!s) return null
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${s.dot}`} title={s.label} />
}

// ---------------------------------------------------------------- Student: my own attendance
function MyAttendance({ user }) {
  const [range, setRange] = useState('month')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('student_id', user.id)
        .gte('attendance_date', rangeStart(range))
        .order('attendance_date', { ascending: false })
      if (!cancelled) {
        setRows(data ?? [])
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [range, user.id])

  const counts = emptyCounts()
  rows.forEach((r) => { if (counts[r.status] !== undefined) counts[r.status] += 1 })
  const rate = rateOf(counts)

  return (
    <div className="screen-scroll px-4 pt-2">
      <div className="flex gap-2 pb-3 overflow-x-auto">
        {RANGES.map((r) => (
          <button key={r.key} onClick={() => setRange(r.key)} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border ${range === r.key ? 'bg-brand-purple text-white border-brand-purple' : 'border-gray-200 text-gray-600'}`}>{r.label}</button>
        ))}
      </div>

      <div className="rounded-2xl bg-brand-light p-4 text-center">
        <p className="text-3xl font-bold text-brand-purple">{rate === null ? '—' : `${rate}%`}</p>
        <p className="text-xs text-gray-500 mt-1">Attendance rate</p>
        <div className="grid grid-cols-4 gap-2 mt-3">
          {STATUSES.map((s) => (
            <div key={s.key}>
              <p className="font-semibold text-sm">{counts[s.key]}</p>
              <p className="text-[10px] text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-center text-gray-400 mt-8">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-center text-gray-400 mt-8">No attendance recorded for this period yet.</p>
      ) : (
        <div className="divide-y divide-gray-100 mt-3">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-3 py-3">
              <StatusDot status={r.status} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{prettyDate(r.attendance_date)}</p>
                {r.class_name || r.note ? <p className="text-xs text-gray-400 truncate">{[r.class_name, r.note].filter(Boolean).join(' · ')}</p> : null}
              </div>
              <span className="text-xs text-gray-500 capitalize">{r.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
  }

// ---------------------------------------------------------------- Staff: mark attendance
function MarkAttendance({ user, profile, students }) {
  const [date, setDate] = useState(toDateString(new Date()))
  const [className, setClassName] = useState('')
  const [onlyClass, setOnlyClass] = useState(true)
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState({})
  const [notes, setNotes] = useState({})
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Which students have been marked in which class lately, so a class list builds itself.
  useEffect(() => {
    let cancelled = false
    async function loadRecent() {
      const since = new Date()
      since.setDate(since.getDate() - 90)
      const { data } = await supabase
        .from('attendance_records')
        .select('student_id, class_name')
        .eq('school_id', profile.school_id)
        .gte('attendance_date', toDateString(since))
        .limit(5000)
      if (!cancelled) setRecent(data ?? [])
    }
    loadRecent()
    return () => { cancelled = true }
  }, [profile.school_id])

  // What was already saved for this day.
  useEffect(() => {
    let cancelled = false
    async function loadDay() {
      setLoading(true)
      setMessage('')
      setError('')
      const { data } = await supabase
        .from('attendance_records')
        .select('student_id, status, note, class_name')
        .eq('school_id', profile.school_id)
        .eq('attendance_date', date)
      if (cancelled) return
      const d = {}
      const n = {}
      let seenClass = ''
      for (const r of data ?? []) {
        d[r.student_id] = r.status
        if (r.note) n[r.student_id] = r.note
        if (!seenClass && r.class_name) seenClass = r.class_name
      }
      setDraft(d)
      setNotes(n)
      setClassName((current) => current || seenClass)
      setLoading(false)
    }
    loadDay()
    return () => { cancelled = true }
  }, [date, profile.school_id])

  const classes = useMemo(() => {
    const set = new Set()
    recent.forEach((r) => { if (r.class_name) set.add(r.class_name) })
    return [...set].sort()
  }, [recent])

  const classMembers = useMemo(() => {
    const set = new Set()
    const wanted = className.trim().toLowerCase()
    if (!wanted) return set
    recent.forEach((r) => { if ((r.class_name || '').toLowerCase() === wanted) set.add(r.student_id) })
    return set
  }, [recent, className])

  const classHasList = classMembers.size > 0
  const filtering = onlyClass && classHasList

  const list = students.filter((s) => {
    if (filtering && !classMembers.has(s.id)) return false
    if (search.trim() && !(s.full_name || '').toLowerCase().includes(search.toLowerCase().trim())) return false
    return true
  })

  const counts = emptyCounts()
  list.forEach((s) => { if (draft[s.id]) counts[draft[s.id]] += 1 })
  const unmarked = list.filter((s) => !draft[s.id]).length

  function setStatus(id, status) {
    setMessage('')
    setDraft((d) => ({ ...d, [id]: d[id] === status ? undefined : status }))
  }

  function markAllPresent() {
    setMessage('')
    setDraft((d) => {
      const next = { ...d }
      list.forEach((s) => { if (!next[s.id]) next[s.id] = 'present' })
      return next
    })
  }

  async function handleSave() {
    setError('')
    setMessage('')
    if (!className.trim()) {
      setError('Type the class name first (for example Form 2A).')
      return
    }
    const rows = list
      .filter((s) => draft[s.id])
      .map((s) => ({
        school_id: profile.school_id,
        student_id: s.id,
        class_name: className.trim(),
        attendance_date: date,
        status: draft[s.id],
        note: notes[s.id]?.trim() || null,
        marked_by: user.id,
        updated_at: new Date().toISOString(),
      }))
    if (rows.length === 0) {
      setError('Mark at least one student first.')
      return
    }
    setSaving(true)
    const { error: saveError } = await supabase.from('attendance_records').upsert(rows, { onConflict: 'student_id,attendance_date' })
    setSaving(false)
    if (saveError) {
      setError(saveError.message)
      return
    }
    setMessage(`Saved ${rows.length} ${rows.length === 1 ? 'student' : 'students'}.`)
    setRecent((r) => [...r, ...rows.map((x) => ({ student_id: x.student_id, class_name: x.class_name }))])
  }

  return (
    <>
      <div className="px-4 pt-2 space-y-2">
        <div className="flex gap-2">
          <input
            type="date"
            value={date}
            max={toDateString(new Date())}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
          />
          <input
            list="attendance-classes"
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            placeholder="Class (e.g. Form 2A)"
            className="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
          />
          <datalist id="attendance-classes">
            {classes.map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>

        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search students…"
            className="w-full border border-gray-200 rounded-full pl-9 pr-4 py-2 text-sm outline-brand-purple"
          />
        </div>

        <div className="flex items-center justify-between text-xs">
          {classHasList ? (
            <button onClick={() => setOnlyClass((v) => !v)} className="text-brand-purple font-medium">
              {onlyClass ? `Showing ${classMembers.size} in this class · show everyone` : 'Showing everyone · only this class'}
            </button>
          ) : (
            <span className="text-gray-400">{className.trim() ? 'New class: pick its students below' : 'Everyone in your school'}</span>
          )}
          <button onClick={markAllPresent} className="text-brand-purple font-medium">Mark all present</button>
        </div>

        <div className="flex gap-3 text-[11px] text-gray-500">
          {STATUSES.map((s) => (
            <span key={s.key} className="flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${s.dot}`} /> {counts[s.key]} {s.label.toLowerCase()}</span>
          ))}
        </div>
      </div>

      <div className="screen-scroll px-4 pt-1 pb-28">
        {loading ? (
          <p className="text-center text-gray-400 mt-8">Loading…</p>
        ) : students.length === 0 ? (
          <p className="text-center text-gray-400 mt-8">No students have joined your school yet.</p>
        ) : list.length === 0 ? (
          <p className="text-center text-gray-400 mt-8">No students match.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {list.map((s) => (
              <div key={s.id} className="py-2.5">
                <div className="flex items-center gap-3">
                  <Avatar url={s.avatar_url} />
                  <p className="flex-1 min-w-0 text-sm font-medium truncate">{s.full_name || 'Student'}</p>
                  <div className="flex gap-1.5 shrink-0">
                    {STATUSES.map((st) => (
                      <button
                        key={st.key}
                        onClick={() => setStatus(s.id, st.key)}
                        aria-label={st.label}
                        className={`w-8 h-8 rounded-full text-xs font-semibold border ${draft[s.id] === st.key ? st.on : 'border-gray-200 text-gray-500'}`}
                      >
                        {st.short}
                      </button>
                    ))}
                  </div>
                </div>
                {draft[s.id] && draft[s.id] !== 'present' ? (
                  <input
                    value={notes[s.id] || ''}
                    onChange={(e) => setNotes((n) => ({ ...n, [s.id]: e.target.value }))}
                    placeholder="Reason or note (optional)"
                    className="mt-2 ml-12 w-[calc(100%-3rem)] border border-gray-200 rounded-lg px-3 py-1.5 text-xs outline-brand-purple"
                  />
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3">
        {error ? <p className="text-red-500 text-xs mb-2">{error}</p> : null}
        {message ? <p className="text-green-600 text-xs mb-2 flex items-center gap-1"><Check size={13} /> {message}</p> : null}
        <button onClick={handleSave} disabled={saving || loading} className="w-full bg-brand-purple text-white font-medium py-3 rounded-xl disabled:opacity-60">
          {saving ? 'Saving…' : unmarked > 0 && list.length > 0 ? `Save attendance (${unmarked} not marked)` : 'Save attendance'}
        </button>
      </div>
    </>
  )
}

// ---------------------------------------------------------------- Staff: reports
function AttendanceReport({ profile, students }) {
  const [range, setRange] = useState('month')
  const [classFilter, setClassFilter] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('school_id', profile.school_id)
        .gte('attendance_date', rangeStart(range))
        .order('attendance_date', { ascending: false })
        .limit(10000)
      if (!cancelled) {
        setRows(data ?? [])
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [range, profile.school_id])

  const classes = useMemo(() => [...new Set(rows.map((r) => r.class_name).filter(Boolean))].sort(), [rows])
  const shown = classFilter ? rows.filter((r) => r.class_name === classFilter) : rows
  const nameOf = useMemo(() => new Map(students.map((s) => [s.id, s])), [students])

  const perStudent = useMemo(() => {
    const map = new Map()
    for (const r of shown) {
      if (!map.has(r.student_id)) map.set(r.student_id, { id: r.student_id, counts: emptyCounts(), days: [] })
      const entry = map.get(r.student_id)
      if (entry.counts[r.status] !== undefined) entry.counts[r.status] += 1
      entry.days.push(r)
    }
    return [...map.values()]
      .map((e) => ({ ...e, rate: rateOf(e.counts) }))
      .sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101))
  }, [shown])

  const totals = emptyCounts()
  shown.forEach((r) => { if (totals[r.status] !== undefined) totals[r.status] += 1 })
  const schoolRate = rateOf(totals)

  return (
    <div className="screen-scroll px-4 pt-2 pb-6">
      <div className="flex gap-2 pb-2 overflow-x-auto">
        {RANGES.map((r) => (
          <button key={r.key} onClick={() => setRange(r.key)} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border ${range === r.key ? 'bg-brand-purple text-white border-brand-purple' : 'border-gray-200 text-gray-600'}`}>{r.label}</button>
        ))}
      </div>

      {classes.length > 0 ? (
        <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="w-full border border-gray-200 rounded-full px-3 py-2 text-xs text-gray-600 bg-white outline-brand-purple mb-3">
          <option value="">All classes</option>
          {classes.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      ) : null}

      <div className="rounded-2xl bg-brand-light p-4 text-center">
        <p className="text-3xl font-bold text-brand-purple">{schoolRate === null ? '—' : `${schoolRate}%`}</p>
        <p className="text-xs text-gray-500 mt-1">{classFilter || 'Whole school'} attendance rate</p>
        <div className="grid grid-cols-4 gap-2 mt-3">
          {STATUSES.map((s) => (
            <div key={s.key}>
              <p className="font-semibold text-sm">{totals[s.key]}</p>
              <p className="text-[10px] text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-center text-gray-400 mt-8">Loading…</p>
      ) : perStudent.length === 0 ? (
        <p className="text-center text-gray-400 mt-8">No attendance recorded for this period yet.</p>
      ) : (
        <>
          <p className="text-xs font-semibold text-gray-400 uppercase mt-4 mb-1">Lowest attendance first</p>
          <div className="divide-y divide-gray-100">
            {perStudent.map((e) => {
              const s = nameOf.get(e.id)
              const isOpen = open === e.id
              return (
                <div key={e.id} className="py-2.5">
                  <button onClick={() => setOpen(isOpen ? null : e.id)} className="w-full flex items-center gap-3 text-left">
                    <Avatar url={s?.avatar_url} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium truncate">{s?.full_name || 'Student'}</span>
                      <span className="block text-[11px] text-gray-400">
                        {e.counts.present} present · {e.counts.absent} absent · {e.counts.late} late · {e.counts.excused} excused
                      </span>
                    </span>
                    <span className={`text-sm font-bold shrink-0 ${e.rate !== null && e.rate < 75 ? 'text-red-500' : 'text-brand-purple'}`}>{e.rate === null ? '—' : `${e.rate}%`}</span>
                    {isOpen ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                  </button>
                  {isOpen ? (
                    <div className="mt-2 ml-12 space-y-1">
                      {e.days.map((d) => (
                        <div key={d.id} className="flex items-center gap-2 text-xs">
                          <StatusDot status={d.status} />
                          <span className="w-24 shrink-0">{prettyDate(d.attendance_date)}</span>
                          <span className="capitalize text-gray-500">{d.status}</span>
                          {d.note ? <span className="text-gray-400 truncate">· {d.note}</span> : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- Page
export default function Attendance() {
  const { user, profile } = useAuth()
  const [tab, setTab] = useState('mark')
  const [students, setStudents] = useState([])
  const [loadingStudents, setLoadingStudents] = useState(true)

  const isStudent = profile?.role === 'Student'
  const marker = canMark(profile)

  useEffect(() => {
    if (!profile?.school_id || isStudent) {
      setLoadingStudents(false)
      return undefined
    }
    let cancelled = false
    async function loadStudents() {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('school_id', profile.school_id)
        .eq('role', 'Student')
        .eq('status', 'active')
        .order('full_name', { ascending: true })
        .limit(2000)
      if (!cancelled) {
        setStudents(data ?? [])
        setLoadingStudents(false)
      }
    }
    loadStudents()
    return () => { cancelled = true }
  }, [profile?.school_id, isStudent])

  if (profile?.account_type === 'parent') return <Navigate to="/family" replace />

  if (!profile?.school_id) {
    return (
      <div className="app-shell">
        <BackHeader title="Attendance" />
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 text-gray-400 gap-2">
          <CalendarCheck size={32} />
          <p>Attendance is available once you belong to a school.</p>
        </div>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="app-shell">
      <BackHeader title="Attendance" />

      {isStudent ? (
        <MyAttendance user={user} />
      ) : (
        <>
          <div className="flex gap-4 px-4 border-b border-gray-100">
            {marker ? (
              <button onClick={() => setTab('mark')} className={`py-2 text-sm font-medium border-b-2 ${tab === 'mark' ? 'border-brand-purple text-brand-purple' : 'border-transparent text-gray-400'}`}>Mark</button>
            ) : null}
            <button onClick={() => setTab('report')} className={`py-2 text-sm font-medium border-b-2 ${tab === 'report' || !marker ? 'border-brand-purple text-brand-purple' : 'border-transparent text-gray-400'}`}>Reports</button>
            <span className="flex-1" />
            <span className="py-2 text-xs text-gray-400 flex items-center gap-1"><Users size={12} /> {students.length}</span>
          </div>

          {loadingStudents ? (
            <p className="text-center text-gray-400 mt-8">Loading…</p>
          ) : marker && tab === 'mark' ? (
            <MarkAttendance user={user} profile={profile} students={students} />
          ) : (
            <AttendanceReport profile={profile} students={students} />
          )}
        </>
      )}

      {isStudent || tab === 'report' || !marker ? <BottomNav /> : null}
    </div>
  )
    }
