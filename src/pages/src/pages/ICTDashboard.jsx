import { useEffect, useState } from 'react'
import { Plus, X, Laptop } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { canManageDevices } from '../lib/permissions.js'

export default function ICTDashboard() {
  const { user, profile } = useAuth()
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', device_type: '', assigned_to: '', status: 'active', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (profile?.school_id) loadDevices()
  }, [profile?.school_id])

  async function loadDevices() {
    setLoading(true)
    const { data } = await supabase
      .from('devices')
      .select('*')
      .eq('school_id', profile.school_id)
      .order('created_at', { ascending: false })
    setDevices(data ?? [])
    setLoading(false)
  }

  function updateForm(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleAdd() {
    if (!form.name.trim()) return
    setSaving(true)
    setError('')
    const { error: insertError } = await supabase.from('devices').insert({
      ...form,
      school_id: profile.school_id,
      recorded_by: user.id,
    })
    setSaving(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    setForm({ name: '', device_type: '', assigned_to: '', status: 'active', notes: '' })
    setShowForm(false)
    loadDevices()
  }

  if (!canManageDevices(profile)) {
    return (
      <div className="flex-1 flex flex-col">
        <BackHeader title="ICT Dashboard" />
        <div className="screen-scroll px-6 flex items-center justify-center text-center text-gray-400">
          Only the ICT Administrator and school leadership can view this.
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader title="ICT Dashboard" />
      <div className="screen-scroll px-4">
        <div className="mt-2">
          {showForm ? (
            <div className="border border-gray-100 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">Add Device</p>
                <button onClick={() => setShowForm(false)}>
                  <X size={16} className="text-gray-400" />
                </button>
              </div>
              <input
                value={form.name}
                onChange={(e) => updateForm('name', e.target.value)}
                placeholder="Device name / ID"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
              />
              <input
                value={form.device_type}
                onChange={(e) => updateForm('device_type', e.target.value)}
                placeholder="Type (e.g. Laptop, Projector)"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
              />
              <input
                value={form.assigned_to}
                onChange={(e) => updateForm('assigned_to', e.target.value)}
                placeholder="Assigned to (optional)"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
              />
              <select
                value={form.status}
                onChange={(e) => updateForm('status', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
              >
                <option value="active">Active</option>
                <option value="under repair">Under Repair</option>
                <option value="retired">Retired</option>
              </select>
              <input
                value={form.notes}
                onChange={(e) => updateForm('notes', e.target.value)}
                placeholder="Notes (optional)"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
              />
              {error ? <p className="text-red-500 text-xs">{error}</p> : null}
              <button
                onClick={handleAdd}
                disabled={saving}
                className="w-full bg-brand-purple text-white font-medium py-2.5 rounded-lg text-sm disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Add Device'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500"
            >
              <Plus size={16} /> Add Device
            </button>
          )}
        </div>

        <div className="mt-4">
          {loading ? (
            <p className="text-center text-gray-400 mt-8">Loading…</p>
          ) : devices.length === 0 ? (
            <p className="text-center text-gray-400 mt-8">No devices logged yet.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {devices.map((d) => (
                <div key={d.id} className="py-3 flex items-center gap-3">
                  <span className="w-9 h-9 rounded-full bg-brand-light flex items-center justify-center shrink-0">
                    <Laptop size={16} className="text-brand-purple" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{d.name}</p>
                    <p className="text-xs text-gray-400">
                      {[d.device_type, d.assigned_to].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
                      d.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-500'
                    }`}
                  >
                    {d.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
