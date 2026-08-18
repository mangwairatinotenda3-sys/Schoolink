import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import BottomNav from '../components/BottomNav.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

function canEdit(profile) {
  return ['Teacher / Tutor', 'Headteacher', 'Deputy Head'].includes(profile?.role)
}

export default function Timetable() {
  const { user, profile } = useAuth()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeDay, setActiveDay] = useState('Monday')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    subject: '', day_of_week: 'Monday', start_time: '', end_time: '', class_name: '', teacher_name: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (profile?.school_id) loadEntries()
  }, [profile?.school_id])

  async function loadEntries() {
    setLoading(true)
    const { data } = await supabase
      .from('timetable_entries')
      .select('*')
      .eq('school_id', profile.school_id)
      .order('start_time', { ascending: true })
    setEntries(data ?? [])
    setLoading(false)
  }

  function updateForm(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleAdd() {
    if (!form.subject.trim() || !form.start_time || !form.end_time) return
    setSaving(true)
    setError('')
    const { error: insertError } = await supabase.from('timetable_entries').insert({
      ...form,
      school_id: profile.school_id,
      created_by: user.id,
    })
    setSaving(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    setForm({ subject: '', day_of_week: activeDay, start_time: '', end_time: '', class_name: '', teacher_name: '' })
    setShowForm(false)
    loadEntries()
  }

  const dayEntries = entries.filter((e) => e.day_of_week === activeDay)

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader title="Timetable" />

      <div className="flex gap-2 overflow-x-auto px-4 pt-2 pb-2">
        {days.map((d) => (
          <button
            key={d}
            onClick={() => setActiveDay(d)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border ${
              activeDay === d ? 'bg-brand-purple text-white border-brand-purple' : 'border-gray-200 text-gray-600'
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      {canEdit(profile) ? (
        <div className="px-4 pb-2">
          {showForm ? (
            <div className="border border-gray-100 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">Add Timetable Entry</p>
                <button onClick={() => setShowForm(false)}>
                  <X size={16} className="text-gray-400" />
                </button>
              </div>
              <input
                value={form.subject}
                onChange={(e) => updateForm('subject', e.target.value)}
                placeholder="Subject"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
              />
              <select
                value={form.day_of_week}
                onChange={(e) => updateForm('day_of_week', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
              >
                {days.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <div className="flex gap-2">
                <input
                  type="time"
                  value={form.start_time}
                  onChange={(e) => updateForm('start_time', e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
                />
                <input
                  type="time"
                  value={form.end_time}
                  onChange={(e) => updateForm('end_time', e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
                />
              </div>
              <input
                value={form.class_name}
                onChange={(e) => updateForm('class_name', e.target.value)}
                placeholder="Class (e.g. Form 3A)"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
              />
              <input
                value={form.teacher_name}
                onChange={(e) => updateForm('teacher_name', e.target.value)}
                placeholder="Teacher (optional)"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
              />
              {error ? <p className="text-red-500 text-xs">{error}</p> : null}
              <button
                onClick={handleAdd}
                disabled={saving}
                className="w-full bg-brand-purple text-white font-medium py-2.5 rounded-lg text-sm disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Add Entry'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500"
            >
              <Plus size={16} /> Add Entry
            </button>
          )}
        </div>
      ) : null}

      <div className="screen-scroll px-4">
        {loading ? (
          <p className="text-center text-gray-400 mt-8">Loading…</p>
        ) : dayEntries.length === 0 ? (
          <p className="text-center text-gray-400 mt-8">No classes scheduled for {activeDay}.</p>
        ) : (
          <div className="space-y-2">
            {dayEntries.map((e) => (
              <div key={e.id} className="flex items-center gap-3 border border-gray-100 rounded-xl p-3">
                <div className="text-center shrink-0 w-16">
                  <p className="text-xs font-semibold text-brand-purple">{e.start_time}</p>
                  <p className="text-[10px] text-gray-400">{e.end_time}</p>
                </div>
                <div className="border-l border-gray-100 pl-3 flex-1 min-w-0">
                  <p className="font-medium text-sm">{e.subject}</p>
                  <p className="text-xs text-gray-400">
                    {[e.class_name, e.teacher_name].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  )
  }
