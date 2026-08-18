import { useEffect, useState } from 'react'
import { Plus, X, ClipboardList } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import BottomNav from '../components/BottomNav.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

function canPost(profile) {
  return ['Teacher / Tutor', 'Headteacher', 'Deputy Head'].includes(profile?.role)
}

function formatDue(dateString) {
  if (!dateString) return null
  return new Date(dateString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function Assignments() {
  const { user, profile } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', subject: '', description: '', due_date: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (profile?.school_id) loadItems()
  }, [profile?.school_id])

  async function loadItems() {
    setLoading(true)
    const { data } = await supabase
      .from('assignments')
      .select('*')
      .eq('school_id', profile.school_id)
      .order('created_at', { ascending: false })
    setItems(data ?? [])
    setLoading(false)
  }

  function updateForm(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleAdd() {
    if (!form.title.trim()) return
    setSaving(true)
    setError('')
    const { error: insertError } = await supabase.from('assignments').insert({
      ...form,
      due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
      school_id: profile.school_id,
      created_by: user.id,
      author_name: profile?.full_name || user.email,
    })
    setSaving(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    setForm({ title: '', subject: '', description: '', due_date: '' })
    setShowForm(false)
    loadItems()
  }

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader title="Homework & Assignments" />

      {canPost(profile) ? (
        <div className="px-4 pt-2">
          {showForm ? (
            <div className="border border-gray-100 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">Add Assignment</p>
                <button onClick={() => setShowForm(false)}>
                  <X size={16} className="text-gray-400" />
                </button>
              </div>
              <input
                value={form.title}
                onChange={(e) => updateForm('title', e.target.value)}
                placeholder="Title"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
              />
              <input
                value={form.subject}
                onChange={(e) => updateForm('subject', e.target.value)}
                placeholder="Subject"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
              />
              <textarea
                value={form.description}
                onChange={(e) => updateForm('description', e.target.value)}
                placeholder="Instructions"
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple resize-none"
              />
              <label className="text-xs text-gray-500">Due date</label>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => updateForm('due_date', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
              />
              {error ? <p className="text-red-500 text-xs">{error}</p> : null}
              <button
                onClick={handleAdd}
                disabled={saving}
                className="w-full bg-brand-purple text-white font-medium py-2.5 rounded-lg text-sm disabled:opacity-60"
              >
                {saving ? 'Posting…' : 'Post Assignment'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500"
            >
              <Plus size={16} /> Add Assignment
            </button>
          )}
        </div>
      ) : null}

      <div className="screen-scroll px-4 pt-3">
        {loading ? (
          <p className="text-center text-gray-400 mt-8">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-center text-gray-400 mt-8">No assignments posted yet.</p>
        ) : (
          <div className="space-y-3">
            {items.map((a) => (
              <div key={a.id} className="border border-gray-100 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <span className="w-9 h-9 rounded-full bg-brand-light flex items-center justify-center shrink-0">
                    <ClipboardList size={16} className="text-brand-purple" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm">{a.title}</p>
                    <p className="text-xs text-gray-400">{a.subject} · {a.author_name}</p>
                    {a.description ? <p className="text-sm mt-2">{a.description}</p> : null}
                    {a.due_date ? (
                      <p className="text-xs text-orange-500 font-medium mt-2">Due {formatDue(a.due_date)}</p>
                    ) : null}
                  </div>
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
