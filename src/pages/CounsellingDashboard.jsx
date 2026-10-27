import { useEffect, useMemo, useState } from 'react'
import { Plus, HeartHandshake, CalendarClock, Lock, CalendarCheck } from 'lucide-react'
import {
  DashHero, SectionTitle, Tabs, SearchBox, Empty, Denied, Field, Sheet, PrimaryButton, Pill, Fab, INPUT,
} from '../components/DashKit.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

function canManage(profile) {
  return ['Guidance & Counselling', 'Headteacher', 'Deputy Head'].includes(profile?.role)
}

const BLANK = { student_name: '', appointment_date: '', notes: '' }
const STATUSES = [
  { key: 'scheduled', label: 'Scheduled', tone: 'purple' },
  { key: 'completed', label: 'Completed', tone: 'green' },
  { key: 'cancelled', label: 'Cancelled', tone: 'gray' },
]

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function whenLabel(iso) {
  const d = new Date(iso)
  const now = new Date()
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (sameDay(d, now)) return `Today · ${time}`
  if (sameDay(d, tomorrow)) return `Tomorrow · ${time}`
  return `${d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} · ${time}`
}

export default function CounsellingDashboard() {
  const { user, profile } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('upcoming')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (profile?.school_id) loadItems()
  }, [profile?.school_id])

  useEffect(() => {
    if (!notice) return undefined
    const t = setTimeout(() => setNotice(''), 3200)
    return () => clearTimeout(t)
  }, [notice])

  async function loadItems() {
    setLoading(true)
    const { data } = await supabase.from('counselling_appointments').select('*').eq('school_id', profile.school_id).order('appointment_date', { ascending: true })
    setItems(data ?? [])
    setLoading(false)
  }

  function updateForm(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleAdd() {
    if (!form.student_name.trim() || !form.appointment_date) {
      setError('Add the student name and a date and time.')
      return
    }
    setSaving(true)
    setError('')
    const { error: insertError } = await supabase.from('counselling_appointments').insert({
      ...form,
      student_name: form.student_name.trim(),
      appointment_date: new Date(form.appointment_date).toISOString(),
      school_id: profile.school_id,
      counselor_id: user.id,
      created_by: user.id,
    })
    setSaving(false)
    if (insertError) { setError(insertError.message); return }
    setForm(BLANK)
    setOpen(false)
    loadItems()
  }

  async function updateStatus(id, status) {
    const before = items
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, status } : x)))
    const { data: upRows, error: upErr } = await supabase.from('counselling_appointments').update({ status }).eq('id', id).select('id')
    if (upErr || !upRows?.length) {
      setItems(before)
      setNotice("Couldn't change that appointment. Run the dashboards SQL once, then try again.")
    }
  }

  const now = new Date()
  const todayCount = items.filter((i) => i.status === 'scheduled' && sameDay(new Date(i.appointment_date), now)).length
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const weekCount = items.filter((i) => i.status === 'scheduled' && new Date(i.appointment_date) >= now && new Date(i.appointment_date) <= weekEnd).length
  const doneCount = items.filter((i) => i.status === 'completed').length
  const openItems = items.filter((i) => i.status === 'scheduled')
  const closedItems = items.filter((i) => i.status !== 'scheduled')

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = items.filter((i) => {
      if (tab === 'upcoming' && i.status !== 'scheduled') return false
      if (tab === 'done' && i.status === 'scheduled') return false
      if (!q) return true
      return `${i.student_name} ${i.notes || ''}`.toLowerCase().includes(q)
    })
    return tab === 'done' ? [...list].reverse() : list
  }, [items, tab, query])

  if (!canManage(profile)) {
    return <Denied title="Guidance & Counselling" text="Only the Guidance & Counselling team and school leadership can view this." />
  }

  return (
    <div className="app-shell">
      <div className="screen-scroll">
        <DashHero
          icon={HeartHandshake}
          title="Counselling"
          subtitle="Private sessions with learners"
          stats={[
            { label: 'Today', value: todayCount },
            { label: 'This week', value: weekCount },
            { label: 'Completed', value: doneCount },
          ]}
        />

        <div className="px-4 pb-32">
          <p className="mt-4 flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2.5"><Lock size={13} className="shrink-0" /> Notes here are private to the counselling team and school leadership.</p>

          <SectionTitle>Appointments</SectionTitle>
          <SearchBox value={query} onChange={setQuery} placeholder="Search a learner" />
          <div className="mt-3">
            <Tabs
              value={tab}
              onChange={setTab}
              items={[
                { key: 'upcoming', label: 'Upcoming', count: openItems.length },
                { key: 'done', label: 'Past', count: closedItems.length },
                { key: 'all', label: 'All', count: items.length },
              ]}
            />
          </div>

          {notice ? <p className="mt-3 text-xs bg-gray-900 text-white rounded-full px-4 py-2 text-center">{notice}</p> : null}

          <div className="mt-3 space-y-2.5">
            {loading ? (
              <p className="text-center text-gray-400 py-10">Loading…</p>
            ) : shown.length === 0 ? (
              <Empty
                icon={CalendarCheck}
                title={items.length === 0 ? 'No appointments yet' : 'Nothing here'}
                text={items.length === 0 ? 'Tap Schedule to book the first session.' : 'Try another tab or search.'}
              />
            ) : (
              shown.map((i) => {
                const st = STATUSES.find((s) => s.key === i.status) || STATUSES[0]
                const late = i.status === 'scheduled' && new Date(i.appointment_date) < now && !sameDay(new Date(i.appointment_date), now)
                return (
                  <div key={i.id} className="rounded-2xl border border-gray-100 bg-white p-3.5">
                    <div className="flex items-center gap-3">
                      <span className="w-11 h-11 rounded-2xl bg-brand-light flex items-center justify-center font-extrabold text-brand-purple shrink-0">{(i.student_name || '?').slice(0, 1).toUpperCase()}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[15px] text-brand-navy truncate">{i.student_name}</p>
                        <p className="text-xs text-gray-400 flex items-center gap-1 truncate"><CalendarClock size={12} /> {whenLabel(i.appointment_date)}</p>
                      </div>
                      <Pill tone={late ? 'amber' : st.tone}>{late ? 'Missed?' : st.label}</Pill>
                    </div>
                    {i.notes ? <p className="text-sm text-gray-600 mt-2.5 leading-snug bg-gray-50 rounded-xl px-3 py-2">{i.notes}</p> : null}
                    <div className="grid grid-cols-3 gap-1.5 mt-3 p-1 rounded-xl bg-gray-100">
                      {STATUSES.map((s) => (
                        <button
                          key={s.key}
                          onClick={() => i.status !== s.key && updateStatus(i.id, s.key)}
                          className={`h-8 rounded-lg text-xs font-semibold ${i.status === s.key ? 'bg-white text-brand-navy shadow-sm' : 'text-gray-500'}`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
      <Fab onClick={() => { setError(''); setOpen(true) }} icon={Plus} label="Schedule" />

      <Sheet
        open={open}
        title="Schedule a session"
        onClose={() => setOpen(false)}
        footer={(
          <>
            {error ? <p className="text-red-500 text-sm mb-2">{error}</p> : null}
            <PrimaryButton onClick={handleAdd} busy={saving}>Schedule session</PrimaryButton>
          </>
        )}
      >
        <Field label="Learner"><input value={form.student_name} onChange={(e) => updateForm('student_name', e.target.value)} placeholder="Student name" className={INPUT} /></Field>
        <Field label="Date and time"><input type="datetime-local" value={form.appointment_date} onChange={(e) => updateForm('appointment_date', e.target.value)} className={INPUT} /></Field>
        <Field label="Private notes" hint="Only the counselling team and leadership can see this."><textarea value={form.notes} onChange={(e) => updateForm('notes', e.target.value)} rows={4} placeholder="What the session is about" className={`${INPUT} resize-none`} /></Field>
      </Sheet>
    </div>
  )
          }
