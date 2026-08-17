import { useEffect, useState } from 'react'
import { Plus, X, Trophy } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { canManageSports } from '../lib/permissions.js'

export default function CoachDashboard() {
  const { user, profile } = useAuth()
  const [fixtures, setFixtures] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', opponent: '', sport: '', location: '', status: 'upcoming', result: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (profile?.school_id) loadFixtures()
  }, [profile?.school_id])

  async function loadFixtures() {
    setLoading(true)
    const { data } = await supabase
      .from('sports_fixtures')
      .select('*')
      .eq('school_id', profile.school_id)
      .order('created_at', { ascending: false })
    setFixtures(data ?? [])
    setLoading(false)
  }

  function updateForm(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleAdd() {
    if (!form.title.trim()) return
    setSaving(true)
    setError('')
    const { error: insertError } = await supabase.from('sports_fixtures').insert({
      ...form,
      school_id: profile.school_id,
      created_by: user.id,
    })
    setSaving(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    setForm({ title: '', opponent: '', sport: '', location: '', status: 'upcoming', result: '' })
    setShowForm(false)
    loadFixtures()
  }

  if (!canManageSports(profile)) {
    return (
      <div className="flex-1 flex flex-col">
        <BackHeader title="Coach Dashboard" />
        <div className="screen-scroll px-6 flex items-center justify-center text-center text-gray-400">
          Only the School Coach and school leadership can view this.
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader title="Coach Dashboard" />
      <div className="screen-scroll px-4">
        <div className="mt-2">
          {showForm ? (
            <div className="border border-gray-100 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">Add Fixture</p>
                <button onClick={() => setShowForm(false)}>
                  <X size={16} className="text-gray-400" />
                </button>
              </div>
              <input
                value={form.title}
                onChange={(e) => updateForm('title', e.target.value)}
                placeholder="Fixture title (e.g. Inter-house Final)"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
              />
              <input
                value={form.sport}
                onChange={(e) => updateForm('sport', e.target.value)}
                placeholder="Sport (e.g. Football)"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
              />
              <input
                value={form.opponent}
                onChange={(e) => updateForm('opponent', e.target.value)}
                placeholder="Opponent (optional)"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
              />
              <input
                value={form.location}
                onChange={(e) => updateForm('location', e.target.value)}
                placeholder="Location"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
              />
              <select
                value={form.status}
                onChange={(e) => updateForm('status', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
              >
                <option value="upcoming">Upcoming</option>
                <option value="completed">Completed</option>
              </select>
              {form.status === 'completed' ? (
                <input
                  value={form.result}
                  onChange={(e) => updateForm('result', e.target.value)}
                  placeholder="Result (e.g. Won 3-1)"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
                />
              ) : null}
              {error ? <p className="text-red-500 text-xs">{error}</p> : null}
              <button
                onClick={handleAdd}
                disabled={saving}
                className="w-full bg-brand-purple text-white font-medium py-2.5 rounded-lg text-sm disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Add Fixture'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500"
            >
              <Plus size={16} /> Add Fixture
            </button>
          )}
        </div>

        <div className="mt-4">
          {loading ? (
            <p className="text-center text-gray-400 mt-8">Loading…</p>
          ) : fixtures.length === 0 ? (
            <p className="text-center text-gray-400 mt-8">No fixtures yet.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {fixtures.map((f) => (
                <div key={f.id} className="py-3 flex items-center gap-3">
                  <span className="w-9 h-9 rounded-full bg-brand-light flex items-center justify-center shrink-0">
                    <Trophy size={16} className="text-brand-purple" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{f.title}</p>
                    <p className="text-xs text-gray-400">
                      {[f.sport, f.opponent, f.location].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-[10px] font-medium ${f.status === 'completed' ? 'text-green-600' : 'text-brand-purple'}`}>
                      {f.status}
                    </p>
                    {f.result ? <p className="text-xs text-gray-500">{f.result}</p> : null}
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
