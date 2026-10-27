import { useEffect, useMemo, useState } from 'react'
import { Plus, UserCheck, CalendarClock, LogOut, DoorOpen, Users } from 'lucide-react'
import {
  DashHero, SectionTitle, Tabs, SearchBox, Empty, Denied, Field, Sheet, PrimaryButton, Pill, Fab, INPUT,
} from '../components/DashKit.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

function canManage(profile) {
  return ['Receptionist', 'Headteacher', 'Deputy Head'].includes(profile?.role)
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function clock(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function stay(from, to) {
  const mins = Math.max(1, Math.round((new Date(to) - new Date(from)) / 60000))
  if (mins < 60) return `${mins} min`
  return `${Math.floor(mins / 60)} h ${mins % 60} min`
}

function whenLabel(iso) {
  const d = new Date(iso)
  const now = new Date()
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  if (sameDay(d, now)) return `Today · ${clock(iso)}`
  if (sameDay(d, tomorrow)) return `Tomorrow · ${clock(iso)}`
  return `${d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} · ${clock(iso)}`
}

export default function ReceptionistDashboard() {
  const { user, profile } = useAuth()
  const [tab, setTab] = useState('visitors')
  const [visitors, setVisitors] = useState([])
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('today')
  const [open, setOpen] = useState(false)
  const [visitorForm, setVisitorForm] = useState({ visitor_name: '', purpose: '', host_name: '' })
  const [apptForm, setApptForm] = useState({ parent_name: '', meeting_with: '', appointment_time: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (profile?.school_id) loadAll()
  }, [profile?.school_id])

  async function loadAll() {
    setLoading(true)
    const [{ data: v }, { data: a }] = await Promise.all([
      supabase.from('visitor_logs').select('*').eq('school_id', profile.school_id).order('check_in_time', { ascending: false }),
      supabase.from('parent_appointments').select('*').eq('school_id', profile.school_id).order('appointment_time', { ascending: true }),
    ])
    setVisitors(v ?? [])
    setAppointments(a ?? [])
    setLoading(false)
  }

  async function handleAddVisitor() {
    if (!visitorForm.visitor_name.trim()) {
      setError("Add the visitor's name.")
      return
    }
    setSaving(true)
    setError('')
    const { error: insErr } = await supabase.from('visitor_logs').insert({ ...visitorForm, visitor_name: visitorForm.visitor_name.trim(), school_id: profile.school_id, recorded_by: user.id })
    setSaving(false)
    if (insErr) { setError(insErr.message); return }
    setVisitorForm({ visitor_name: '', purpose: '', host_name: '' })
    setOpen(false)
    loadAll()
  }

  async function handleCheckout(id) {
    const stamp = new Date().toISOString()
    setVisitors((prev) => prev.map((v) => (v.id === id ? { ...v, check_out_time: stamp } : v)))
    await supabase.from('visitor_logs').update({ check_out_time: stamp }).eq('id', id)
  }

  async function handleAddAppointment() {
    if (!apptForm.parent_name.trim() || !apptForm.appointment_time) {
      setError('Add the parent name and a date and time.')
      return
    }
    setSaving(true)
    setError('')
    const { error: insErr } = await supabase.from('parent_appointments').insert({
      ...apptForm,
      parent_name: apptForm.parent_name.trim(),
      appointment_time: new Date(apptForm.appointment_time).toISOString(),
      school_id: profile.school_id,
      recorded_by: user.id,
    })
    setSaving(false)
    if (insErr) { setError(insErr.message); return }
    setApptForm({ parent_name: '', meeting_with: '', appointment_time: '' })
    setOpen(false)
    loadAll()
  }

  const now = new Date()
  const inBuilding = visitors.filter((v) => !v.check_out_time).length
  const todayVisitors = visitors.filter((v) => sameDay(new Date(v.check_in_time), now)).length
  const upcomingAppts = appointments.filter((a) => new Date(a.appointment_time) >= new Date(now.getTime() - 30 * 60000))
  const todayAppts = appointments.filter((a) => sameDay(new Date(a.appointment_time), now)).length

  const shownVisitors = useMemo(() => {
    const q = query.trim().toLowerCase()
    return visitors.filter((v) => {
      if (filter === 'inside' && v.check_out_time) return false
      if (filter === 'today' && !sameDay(new Date(v.check_in_time), now)) return false
      if (!q) return true
      return `${v.visitor_name} ${v.purpose || ''} ${v.host_name || ''}`.toLowerCase().includes(q)
    })
  }, [visitors, filter, query])

  const shownAppts = useMemo(() => {
    const q = query.trim().toLowerCase()
    return appointments.filter((a) => {
      const upcoming = new Date(a.appointment_time) >= new Date(now.getTime() - 30 * 60000)
      if (filter === 'upcoming' && !upcoming) return false
      if (filter === 'past' && upcoming) return false
      if (!q) return true
      return `${a.parent_name} ${a.meeting_with || ''}`.toLowerCase().includes(q)
    })
  }, [appointments, filter, query])

  function switchTab(next) {
    setTab(next)
    setFilter(next === 'visitors' ? 'today' : 'upcoming')
    setQuery('')
  }

  if (!canManage(profile)) {
    return <Denied title="Reception" text="Only the Receptionist and school leadership can view this." />
  }

  return (
    <div className="app-shell">
      <div className="screen-scroll">
        <DashHero
          icon={DoorOpen}
          title="Reception"
          subtitle="Visitors and parent meetings"
          stats={[
            { label: 'In building', value: inBuilding },
            { label: 'Visitors today', value: todayVisitors },
            { label: 'Meetings today', value: todayAppts },
          ]}
        />

        <div className="px-4 pb-32">
          <div className="grid grid-cols-2 gap-1.5 mt-4 p-1 rounded-2xl bg-gray-100">
            {[
              { key: 'visitors', label: 'Visitors', icon: Users },
              { key: 'appointments', label: 'Meetings', icon: CalendarClock },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => switchTab(key)}
                className={`h-10 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 ${tab === key ? 'bg-white text-brand-navy shadow-sm' : 'text-gray-500'}`}
              >
                <Icon size={16} /> {label}
              </button>
            ))}
          </div>

          <SectionTitle>{tab === 'visitors' ? 'Visitor log' : 'Parent meetings'}</SectionTitle>
          <SearchBox value={query} onChange={setQuery} placeholder={tab === 'visitors' ? 'Search a visitor' : 'Search a parent'} />
          <div className="mt-3">
            {tab === 'visitors' ? (
              <Tabs
                value={filter}
                onChange={setFilter}
                items={[
                  { key: 'today', label: 'Today' },
                  { key: 'inside', label: 'Still inside', count: inBuilding },
                  { key: 'all', label: 'All', count: visitors.length },
                ]}
              />
            ) : (
              <Tabs
                value={filter}
                onChange={setFilter}
                items={[
                  { key: 'upcoming', label: 'Upcoming', count: upcomingAppts.length },
                  { key: 'past', label: 'Past', count: appointments.length - upcomingAppts.length },
                  { key: 'all', label: 'All', count: appointments.length },
                ]}
              />
            )}
          </div>

          <div className="mt-3 space-y-2.5">
            {loading ? (
              <p className="text-center text-gray-400 py-10">Loading…</p>
            ) : tab === 'visitors' ? (
              shownVisitors.length === 0 ? (
                <Empty icon={UserCheck} title={visitors.length === 0 ? 'No visitors logged yet' : 'Nobody here'} text={visitors.length === 0 ? 'Tap Log visitor when someone arrives.' : 'Try another filter.'} />
              ) : (
                shownVisitors.map((v) => (
                  <div key={v.id} className="rounded-2xl border border-gray-100 bg-white p-3.5">
                    <div className="flex items-center gap-3">
                      <span className={`w-11 h-11 rounded-2xl flex items-center justify-center font-extrabold shrink-0 ${v.check_out_time ? 'bg-gray-100 text-gray-500' : 'bg-green-50 text-green-600'}`}>{(v.visitor_name || '?').slice(0, 1).toUpperCase()}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[15px] text-brand-navy truncate">{v.visitor_name}</p>
                        <p className="text-xs text-gray-400 truncate">{[v.purpose, v.host_name ? `to see ${v.host_name}` : ''].filter(Boolean).join(' · ') || 'Visitor'}</p>
                      </div>
                      <Pill tone={v.check_out_time ? 'gray' : 'green'}>{v.check_out_time ? 'Left' : 'Inside'}</Pill>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-500">
                        In {clock(v.check_in_time)}{v.check_out_time ? ` · out ${clock(v.check_out_time)} · ${stay(v.check_in_time, v.check_out_time)}` : ''}
                      </p>
                      {!v.check_out_time ? (
                        <button onClick={() => handleCheckout(v.id)} className="h-9 px-3.5 rounded-full bg-brand-navy text-white text-xs font-semibold flex items-center gap-1.5"><LogOut size={13} /> Check out</button>
                      ) : null}
                    </div>
                  </div>
                ))
              )
            ) : shownAppts.length === 0 ? (
              <Empty icon={CalendarClock} title={appointments.length === 0 ? 'No meetings yet' : 'Nothing here'} text={appointments.length === 0 ? 'Tap Book meeting to schedule a parent.' : 'Try another filter.'} />
            ) : (
              shownAppts.map((a) => {
                const past = new Date(a.appointment_time) < new Date(now.getTime() - 30 * 60000)
                return (
                  <div key={a.id} className="rounded-2xl border border-gray-100 bg-white p-3.5 flex items-center gap-3">
                    <span className="w-11 h-11 rounded-2xl bg-brand-light flex items-center justify-center shrink-0"><CalendarClock size={20} className="text-brand-purple" /></span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[15px] text-brand-navy truncate">{a.parent_name}</p>
                      <p className="text-xs text-gray-400 truncate">{a.meeting_with ? `With ${a.meeting_with}` : 'Parent meeting'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-semibold text-brand-navy">{whenLabel(a.appointment_time)}</p>
                      <Pill tone={past ? 'gray' : 'purple'} className="mt-1">{past ? 'Past' : 'Booked'}</Pill>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
      <Fab onClick={() => { setError(''); setOpen(true) }} icon={Plus} label={tab === 'visitors' ? 'Log visitor' : 'Book meeting'} />

      <Sheet
        open={open}
        title={tab === 'visitors' ? 'Log a visitor' : 'Book a parent meeting'}
        onClose={() => setOpen(false)}
        footer={(
          <>
            {error ? <p className="text-red-500 text-sm mb-2">{error}</p> : null}
            <PrimaryButton onClick={tab === 'visitors' ? handleAddVisitor : handleAddAppointment} busy={saving}>{tab === 'visitors' ? 'Check in' : 'Book meeting'}</PrimaryButton>
          </>
        )}
      >
        {tab === 'visitors' ? (
          <>
            <Field label="Visitor name"><input value={visitorForm.visitor_name} onChange={(e) => setVisitorForm((f) => ({ ...f, visitor_name: e.target.value }))} placeholder="Full name" className={INPUT} /></Field>
            <Field label="Purpose of visit"><input value={visitorForm.purpose} onChange={(e) => setVisitorForm((f) => ({ ...f, purpose: e.target.value }))} placeholder="Delivery, meeting, enquiry…" className={INPUT} /></Field>
            <Field label="Here to see (optional)"><input value={visitorForm.host_name} onChange={(e) => setVisitorForm((f) => ({ ...f, host_name: e.target.value }))} placeholder="Staff member" className={INPUT} /></Field>
          </>
        ) : (
          <>
            <Field label="Parent name"><input value={apptForm.parent_name} onChange={(e) => setApptForm((f) => ({ ...f, parent_name: e.target.value }))} placeholder="Full name" className={INPUT} /></Field>
            <Field label="Meeting with"><input value={apptForm.meeting_with} onChange={(e) => setApptForm((f) => ({ ...f, meeting_with: e.target.value }))} placeholder="Staff member" className={INPUT} /></Field>
            <Field label="Date and time"><input type="datetime-local" value={apptForm.appointment_time} onChange={(e) => setApptForm((f) => ({ ...f, appointment_time: e.target.value }))} className={INPUT} /></Field>
          </>
        )}
      </Sheet>
    </div>
  )
          }
