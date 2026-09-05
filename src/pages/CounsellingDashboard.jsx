import { useEffect, useState } from 'react'
import { Plus, X, HeartHandshake } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

function canManage(profile) {
  return ['Guidance & Counselling', 'Headteacher', 'Deputy Head'].includes(profile?.role)
}

export default function CounsellingDashboard() {
  const { user, profile } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ student_name: '', appointment_date: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (profile?.school_id) loadItems()
  }, [profile?.school_id])

  async function loadItems() {
    setLoading(true)
    const { data } = await supabase
      .from('counselling_appointments')
      .select('*')
      .eq('school_id', profile.school_id)
      .order('appointment_date', { ascending: true })
    setItems(data ?? [])
    setLoading(false)
  }

  function updateForm(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleAdd() {
    if (!form.student_name.trim() || !form.appointment_date) return
    setSaving(true)
    setError('')
    const { error: insertError } = await supabase.from('counselling_appointments').insert({
      ...form,
      appointment_date: new Date(form.appointment_date).toISOString(),
      school_id: profile.school_id,
      counselor_id: user.id,
      created_by: user.id,
    })
    setSaving(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    setForm({ student_name: '', appointment_date: '', notes: '' })
    setShowForm(false)
    loadItems()
  }

  async function updateStatus(id, status) {
    await supabase.from('counselling_appointments').update({ status }).eq('id', id)
    loadItems()
  }

  if (!canManage(profile)) {
    return (
      <div className="app-shell">
        <BackHeader title="Guidance & Counselling" />
        <div className="screen-scroll px-6 flex items-center justify-center text-center text-gray-400">
          Only the Guidance & Counselling team and school leadership can view this.
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <BackHeader title="Guidance & Counselling" />
      <div className="screen-scroll px-4">
        <div className="mt-2">
          {showForm ? (
            <div className="border border-gray-100 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">Schedule Appointment</p>
                <button onClick={() => setShowForm(false)}>
                  <X size={16} className="text-gray-400" />
                </button>
              </div>
              <input
                value={form.student_name}
                onChange={(e) => updateForm('student_name', e.target.value)}
                placeholder="Student name"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
              />
              <input
                type="datetime-local"
                value={form.appointment_date}
                onChange={(e) => updateForm('appointment_date', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
              />
              <textarea
                value={form.notes}
                onChange={(e) => updateForm('notes', e.target.value)}
                placeholder="Notes (private, only visible to counselling team)"
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple resize-none"
              />
              {error ? <p className="text-red-500 text-xs">{error}</p> : null}
              <button
                onClick={handleAdd}
                disabled={saving}
                className="w-full bg-brand-purple text-white font-medium py-2.5 rounded-lg text-sm disabled:opacity-60"
              >
                {saving ? 'Scheduling…' : 'Schedule Appointment'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500"
            >
              <Plus size={16} /> Schedule Appointment
            </button>
          )}
        </div>

        <div className="mt-4">
          {loading ? (
            <p className="text-center text-gray-400 mt-8">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-center text-gray-400 mt-8">No appointments scheduled yet.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {items.map((i) => (
                <div key={i.id} className="py-3 flex items-center gap-3">
                  <span className="w-9 h-9 rounded-full bg-brand-light flex items-center justify-center shrink-0">
                    <HeartHandshake size={16} className="text-brand-purple" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{i.student_name}</p>
                    <p className="text-xs text-gray-400">{new Date(i.appointment_date).toLocaleString()}</p>
                    {i.notes ? <p className="text-xs text-gray-500 mt-1">{i.notes}</p> : null}
                  </div>
                  <select
                    value={i.status}
                    onChange={(e) => updateStatus(i.id, e.target.value)}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1 shrink-0"
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
  }
