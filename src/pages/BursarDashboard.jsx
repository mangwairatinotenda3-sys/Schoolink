import { useEffect, useState } from 'react'
import { Plus, X, DollarSign } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { canManageFees } from '../lib/permissions.js'

export default function BursarDashboard() {
  const { user, profile } = useAuth()
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ student_name: '', amount: '', term: '', status: 'pending', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (profile?.school_id) loadRecords()
  }, [profile?.school_id])

  async function loadRecords() {
    setLoading(true)
    const { data } = await supabase
      .from('fee_records')
      .select('*')
      .eq('school_id', profile.school_id)
      .order('created_at', { ascending: false })
    setRecords(data ?? [])
    setLoading(false)
  }

  function updateForm(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleAdd() {
    if (!form.student_name.trim() || !form.amount) return
    setSaving(true)
    setError('')
    const { error: insertError } = await supabase.from('fee_records').insert({
      ...form,
      amount: parseFloat(form.amount),
      school_id: profile.school_id,
      recorded_by: user.id,
    })
    setSaving(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    setForm({ student_name: '', amount: '', term: '', status: 'pending', notes: '' })
    setShowForm(false)
    loadRecords()
  }

  const totalCollected = records.filter((r) => r.status === 'paid').reduce((sum, r) => sum + Number(r.amount), 0)
  const totalPending = records.filter((r) => r.status === 'pending').reduce((sum, r) => sum + Number(r.amount), 0)

  if (!canManageFees(profile)) {
    return (
      <div className="flex-1 flex flex-col">
        <BackHeader title="Bursar Dashboard" />
        <div className="screen-scroll px-6 flex items-center justify-center text-center text-gray-400">
          Only the Bursar and school leadership can view this.
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader title="Bursar Dashboard" />
      <div className="screen-scroll px-4">
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div className="border border-gray-100 rounded-xl p-4">
            <p className="text-sm text-gray-500">Collected</p>
            <p className="text-xl font-bold text-green-600">${totalCollected.toFixed(2)}</p>
          </div>
          <div className="border border-gray-100 rounded-xl p-4">
            <p className="text-sm text-gray-500">Pending</p>
            <p className="text-xl font-bold text-orange-500">${totalPending.toFixed(2)}</p>
          </div>
        </div>

        <div className="mt-4">
          {showForm ? (
            <div className="border border-gray-100 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">Add Fee Record</p>
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
                value={form.amount}
                onChange={(e) => updateForm('amount', e.target.value)}
                placeholder="Amount"
                type="number"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
              />
              <input
                value={form.term}
                onChange={(e) => updateForm('term', e.target.value)}
                placeholder="Term (e.g. Term 1 2026)"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
              />
              <select
                value={form.status}
                onChange={(e) => updateForm('status', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
              >
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
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
                {saving ? 'Saving…' : 'Add Record'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500"
            >
              <Plus size={16} /> Add Fee Record
            </button>
          )}
        </div>

        <div className="mt-4">
          {loading ? (
            <p className="text-center text-gray-400 mt-8">Loading…</p>
          ) : records.length === 0 ? (
            <p className="text-center text-gray-400 mt-8">No fee records yet.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {records.map((r) => (
                <div key={r.id} className="py-3 flex items-center gap-3">
                  <span className="w-9 h-9 rounded-full bg-brand-light flex items-center justify-center shrink-0">
                    <DollarSign size={16} className="text-brand-purple" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{r.student_name}</p>
                    <p className="text-xs text-gray-400">{r.term} {r.notes ? `· ${r.notes}` : ''}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold text-sm">${Number(r.amount).toFixed(2)}</p>
                    <p className={`text-[10px] font-medium ${r.status === 'paid' ? 'text-green-600' : 'text-orange-500'}`}>
                      {r.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
  }
