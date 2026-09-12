import { useEffect, useState } from 'react'
import { Plus, X, Award } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

function canEnter(profile) {
  return ['Teacher / Tutor', 'Headteacher', 'Deputy Head'].includes(profile?.role)
}

export default function ExamResults() {
  const { user, profile } = useAuth()
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ student_name: '', subject: '', grade: '', term: '', year: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (profile?.school_id) loadResults()
  }, [profile?.school_id])

  async function loadResults() {
    setLoading(true)
    const { data } = await supabase.from('exam_results').select('*').eq('school_id', profile.school_id).order('created_at', { ascending: false })
    setResults(data ?? [])
    setLoading(false)
  }

  function updateForm(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleAdd() {
    if (!form.student_name.trim() || !form.subject.trim() || !form.grade.trim()) return
    setSaving(true)
    setError('')
    const { error: insertError } = await supabase.from('exam_results').insert({ ...form, school_id: profile.school_id, entered_by: user.id })
    setSaving(false)
    if (insertError) { setError(insertError.message); return }
    setForm({ student_name: '', subject: '', grade: '', term: '', year: '' })
    setShowForm(false)
    loadResults()
  }

  const isStudent = profile?.role === 'Student'
  const myName = (profile?.full_name || '').toLowerCase()
  const visibleResults = isStudent ? results.filter((r) => r.student_name.toLowerCase() === myName) : results

  return (
    <div className="app-shell">
      <BackHeader title="Exam Results" />

      {canEnter(profile) ? (
        <div className="px-4 pt-2">
          {showForm ? (
            <div className="border border-gray-100 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">Add Result</p>
                <button onClick={() => setShowForm(false)}><X size={16} className="text-gray-400" /></button>
              </div>
              <input value={form.student_name} onChange={(e) => updateForm('student_name', e.target.value)} placeholder="Student full name" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple" />
              <input value={form.subject} onChange={(e) => updateForm('subject', e.target.value)} placeholder="Subject" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple" />
              <input value={form.grade} onChange={(e) => updateForm('grade', e.target.value)} placeholder="Grade (e.g. A, 85%)" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple" />
              <input value={form.term} onChange={(e) => updateForm('term', e.target.value)} placeholder="Term" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple" />
              <input value={form.year} onChange={(e) => updateForm('year', e.target.value)} placeholder="Year" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple" />
              {error ? <p className="text-red-500 text-xs">{error}</p> : null}
              <button onClick={handleAdd} disabled={saving} className="w-full bg-brand-purple text-white font-medium py-2.5 rounded-lg text-sm disabled:opacity-60">
                {saving ? 'Saving…' : 'Add Result'}
              </button>
            </div>
          ) : (
            <button onClick={() => setShowForm(true)} className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500">
              <Plus size={16} /> Add Result
            </button>
          )}
        </div>
      ) : null}

      <div className="screen-scroll px-4 pt-3">
        {loading ? (
          <p className="text-center text-gray-400 mt-8">Loading…</p>
        ) : visibleResults.length === 0 ? (
          <p className="text-center text-gray-400 mt-8">No results {isStudent ? 'for you' : ''} yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {visibleResults.map((r) => (
              <div key={r.id} className="flex items-center gap-3 py-3">
                <span className="w-9 h-9 rounded-full bg-brand-light flex items-center justify-center shrink-0"><Award size={16} className="text-brand-purple" /></span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{isStudent ? r.subject : `${r.student_name} — ${r.subject}`}</p>
                  <p className="text-xs text-gray-400">{r.term} {r.year}</p>
                </div>
                <span className="font-bold text-sm text-brand-purple shrink-0">{r.grade}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
