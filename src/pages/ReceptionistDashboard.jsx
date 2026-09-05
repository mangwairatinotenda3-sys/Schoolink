import { useEffect, useState } from 'react'
import { Plus, X, UserCheck, CalendarClock } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

function canManage(profile) {
  return ['Receptionist', 'Headteacher', 'Deputy Head'].includes(profile?.role)
}

export default function ReceptionistDashboard() {
  const { user, profile } = useAuth()
  const [tab, setTab] = useState('visitors')
  const [visitors, setVisitors] = useState([])
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const [visitorForm, setVisitorForm] = useState({ visitor_name: '', purpose: '', host_name: '' })
  const [apptForm, setApptForm] = useState({ parent_name: '', meeting_with: '', appointment_time: '' })
  const [saving, setSaving] = useState(false)

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
    if (!visitorForm.visitor_name.trim()) return
    setSaving(true)
    await supabase.from('visitor_logs').insert({
      ...visitorForm,
      school_id: profile.school_id,
      recorded_by: user.id,
    })
    setSaving(false)
    setVisitorForm({ visitor_name: '', purpose: '', host_name: '' })
    setShowForm(false)
    loadAll()
  }

  async function handleCheckout(id) {
    await supabase.from('visitor_logs').update({ check_out_time: new Date().toISOString() }).eq('id', id)
    loadAll()
  }

  async function handleAddAppointment() {
    if (!apptForm.parent_name.trim() || !apptForm.appointment_time) return
    setSaving(true)
    await supabase.from('parent_appointments').insert({
      ...apptForm,
      appointment_time: new Date(apptForm.appointment_time).toISOString(),
      school_id: profile.school_id,
      recorded_by: user.id,
    })
    setSaving(false)
    setApptForm({ parent_name: '', meeting_with: '', appointment_time: '' })
    setShowForm(false)
    loadAll()
  }

  if (!canManage(profile)) {
    return (
      <div className="app-shell">
        <BackHeader title="Receptionist Dashboard" />
        <div className="screen-scroll px-6 flex items-center justify-center text-center text-gray-400">
          Only the Receptionist and school leadership can view this.
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <BackHeader title="Receptionist Dashboard" />

      <div className="flex px-4 gap-6 border-b border-gray-100">
        {['visitors', 'appointments'].map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setShowForm(false) }}
            className={`py-2 text-sm font-medium border-b-2 capitalize ${
              tab === t ? 'border-brand-purple text-brand-purple' : 'border-transparent text-gray-400'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="screen-scroll px-4 pt-3">
        {tab === 'visitors' ? (
          <>
            {showForm ? (
              <div className="border border-gray-100 rounded-xl p-4 space-y-2 mb-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm">Log Visitor</p>
                  <button onClick={() => setShowForm(false)}><X size={16} className="text-gray-400" /></button>
                </div>
                <input
                  value={visitorForm.visitor_name}
                  onChange={(e) => setVisitorForm((f) => ({ ...f, visitor_name: e.target.value }))}
                  placeholder="Visitor name"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
                />
                <input
                  value={visitorForm.purpose}
                  onChange={(e) => setVisitorForm((f) => ({ ...f, purpose: e.target.value }))}
                  placeholder="Purpose of visit"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
                />
                <input
                  value={visitorForm.host_name}
                  onChange={(e) => setVisitorForm((f) => ({ ...f, host_name: e.target.value }))}
                  placeholder="Here to see (optional)"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
                />
                <button onClick={handleAddVisitor} disabled={saving} className="w-full bg-brand-purple text-white font-medium py-2.5 rounded-lg text-sm disabled:opacity-60">
                  {saving ? 'Logging…' : 'Log Visitor'}
                </button>
              </div>
            ) : (
              <button onClick={() => setShowForm(true)} className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500 mb-3">
                <Plus size={16} /> Log Visitor
              </button>
            )}

            {loading ? (
              <p className="text-center text-gray-400 mt-8">Loading…</p>
            ) : visitors.length === 0 ? (
              <p className="text-center text-gray-400 mt-8">No visitors logged yet.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {visitors.map((v) => (
                  <div key={v.id} className="py-3 flex items-center gap-3">
                    <span className="w-9 h-9 rounded-full bg-brand-light flex items-center justify-center shrink-0">
                      <UserCheck size={16} className="text-brand-purple" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{v.visitor_name}</p>
                      <p className="text-xs text-gray-400">
                        {[v.purpose, v.host_name ? `to see ${v.host_name}` : null].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    {v.check_out_time ? (
                      <span className="text-[10px] text-gray-400 shrink-0">Checked out</span>
                    ) : (
                      <button onClick={() => handleCheckout(v.id)} className="text-xs text-brand-purple font-medium shrink-0">
                        Check out
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {showForm ? (
              <div className="border border-gray-100 rounded-xl p-4 space-y-2 mb-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm">Schedule Parent Appointment</p>
                  <button onClick={() => setShowForm(false)}><X size={16} className="text-gray-400" /></button>
                </div>
                <input
                  value={apptForm.parent_name}
                  onChange={(e) => setApptForm((f) => ({ ...f, parent_name: e.target.value }))}
                  placeholder="Parent name"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
                />
                <input
                  value={apptForm.meeting_with}
                  onChange={(e) => setApptForm((f) => ({ ...f, meeting_with: e.target.value }))}
                  placeholder="Meeting with (staff member)"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
                />
                <input
                  type="datetime-local"
                  value={apptForm.appointment_time}
                  onChange={(e) => setApptForm((f) => ({ ...f, appointment_time: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
                />
                <button onClick={handleAddAppointment} disabled={saving} className="w-full bg-brand-purple text-white font-medium py-2.5 rounded-lg text-sm disabled:opacity-60">
                  {saving ? 'Scheduling…' : 'Schedule'}
                </button>
              </div>
            ) : (
              <button onClick={() => setShowForm(true)} className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500 mb-3">
                <Plus size={16} /> Schedule Appointment
              </button>
            )}

            {loading ? (
              <p className="text-center text-gray-400 mt-8">Loading…</p>
            ) : appointments.length === 0 ? (
              <p className="text-center text-gray-400 mt-8">No appointments scheduled yet.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {appointments.map((a) => (
                  <div key={a.id} className="py-3 flex items-center gap-3">
                    <span className="w-9 h-9 rounded-full bg-brand-light flex items-center justify-center shrink-0">
                      <CalendarClock size={16} className="text-brand-purple" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{a.parent_name}</p>
                      <p className="text-xs text-gray-400">
                        {a.meeting_with ? `With ${a.meeting_with} · ` : ''}{new Date(a.appointment_time).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
