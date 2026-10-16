import { useEffect, useMemo, useState } from 'react'
import { X, Plus, Search, Check, Loader2, AlertCircle, Trash2, Users, Eye, EyeOff } from 'lucide-react'
import { supabase } from '../lib/supabaseClient.js'
import { TERMS, ASSESSMENTS, currentTerm, gradeFor, tone } from '../lib/resultsUtils.js'

function Avatar({ p, size = 40 }) {
  return p.avatar_url ? <img src={p.avatar_url} alt="" className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} /> : <span className="rounded-full bg-brand-light text-brand-purple font-semibold flex items-center justify-center shrink-0" style={{ width: size, height: size }}>{(p.full_name || '?').slice(0, 1).toUpperCase()}</span>
}

const field = 'w-full border border-gray-200 rounded-xl px-3.5 py-3 text-[15px] outline-none focus:border-brand-purple bg-white'

// Teachers enter marks for a whole class in one go: pick the subject and test, add students, type the scores.
export default function ResultsEntry({ schoolId, user, scale, subjects = [], classes = [], defaultTerm, defaultYear, onClose, onSaved }) {
  const [subject, setSubject] = useState('')
  const [assessment, setAssessment] = useState('Test')
  const [term, setTerm] = useState(defaultTerm || currentTerm())
  const [year, setYear] = useState(defaultYear || String(new Date().getFullYear()))
  const [className, setClassName] = useState(classes[0] || '')
  const [maxScore, setMaxScore] = useState('100')
  const [publish, setPublish] = useState(true)
  const [rows, setRows] = useState([])
  const [picker, setPicker] = useState(false)
  const [roster, setRoster] = useState(null)
  const [query, setQuery] = useState('')
  const [chosen, setChosen] = useState(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const max = Number(maxScore)

  useEffect(() => {
    if (!picker || roster) return
    supabase.from('profiles').select('id, full_name, avatar_url').eq('school_id', schoolId).eq('role', 'Student').order('full_name').then(({ data }) => setRoster(data ?? []))
  }, [picker])

  const available = useMemo(() => {
    const have = new Set(rows.map((r) => r.id))
    const q = query.trim().toLowerCase()
    return (roster ?? []).filter((p) => !have.has(p.id) && (!q || (p.full_name || '').toLowerCase().includes(q)))
  }, [roster, rows, query])

  function addChosen() {
    const add = (roster ?? []).filter((p) => chosen.has(p.id)).map((p) => ({ ...p, score: '', comment: '' }))
    setRows((prev) => [...prev, ...add])
    setChosen(new Set())
    setPicker(false)
    setQuery('')
  }

  function setRow(id, patch) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  const filled = rows.filter((r) => r.score !== '')
  const bad = rows.find((r) => r.score !== '' && (Number.isNaN(Number(r.score)) || Number(r.score) < 0 || Number(r.score) > max))
  const canSave = !saving && subject.trim() && term && year.trim() && max > 0 && filled.length > 0 && !bad

  async function save() {
    if (!canSave) return
    setSaving(true)
    setError('')
    try {
      const subj = subject.trim()
      const ids = filled.map((r) => r.id)
      const { data: existing, error: findError } = await supabase
        .from('exam_results').select('id, student_id')
        .eq('school_id', schoolId).eq('term', term).eq('year', year.trim()).eq('assessment', assessment).ilike('subject', subj).in('student_id', ids)
      if (findError) throw findError
      const existingByStudent = new Map((existing ?? []).map((e) => [e.student_id, e.id]))

      const fresh = []
      for (const r of filled) {
        const score = Number(r.score)
        const g = gradeFor((score / max) * 100, scale)?.grade || ''
        const body = {
          student_id: r.id, student_name: r.full_name, subject: subj, assessment, term, year: year.trim(),
          score, max_score: max, grade: g, comment: r.comment.trim() || null, class_name: className.trim() || null,
          published: publish, updated_at: new Date().toISOString(),
        }
        const existingId = existingByStudent.get(r.id)
        if (existingId) {
          // eslint-disable-next-line no-await-in-loop
          const { error: upError } = await supabase.from('exam_results').update(body).eq('id', existingId)
          if (upError) throw upError
        } else {
          fresh.push({ ...body, school_id: schoolId, entered_by: user.id })
        }
      }
      if (fresh.length) {
        const { error: insError } = await supabase.from('exam_results').insert(fresh)
        if (insError) throw insError
      }
      if (publish) await supabase.rpc('announce_results', { p_term: term, p_year: year.trim(), p_students: ids })
      onSaved({ term, year: year.trim(), count: filled.length, published: publish })
    } catch (e) {
      setError(e?.message || 'Could not save. Try again.')
      setSaving(false)
    }
  }

  function close() {
    if (rows.length && !window.confirm('Discard these marks?')) return
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col max-w-[480px] mx-auto">
      <div className="flex items-center justify-between px-3 shrink-0 border-b border-gray-100" style={{ height: 56 }}>
        <button onClick={close} aria-label="Close" className="w-10 h-10 rounded-full flex items-center justify-center"><X size={22} /></button>
        <h1 className="font-semibold text-lg">Enter marks</h1>
        <button onClick={save} disabled={!canSave} className="min-w-[72px] h-9 px-4 rounded-full bg-brand-purple text-white text-sm font-semibold disabled:opacity-35 flex items-center justify-center">
          {saving ? <Loader2 size={16} className="animate-spin" /> : 'Save'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-10">
        <div className="mt-4">
          <label className="text-sm font-semibold">Subject</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} list="sl-subjects" placeholder="e.g. Mathematics" className={`${field} mt-1.5`} />
          <datalist id="sl-subjects">{subjects.map((s) => <option key={s} value={s} />)}</datalist>
        </div>

        <div className="mt-4">
          <label className="text-sm font-semibold">What kind of assessment</label>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {ASSESSMENTS.map((a) => (
              <button key={a} onClick={() => setAssessment(a)} className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${assessment === a ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-600'}`}>{a}</button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div>
            <label className="text-sm font-semibold">Term</label>
            <select value={term} onChange={(e) => setTerm(e.target.value)} className={`${field} mt-1.5`}>{TERMS.map((t) => <option key={t}>{t}</option>)}</select>
          </div>
          <div>
            <label className="text-sm font-semibold">Year</label>
            <input value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" className={`${field} mt-1.5`} />
          </div>
          <div>
            <label className="text-sm font-semibold">Class</label>
            <input value={className} onChange={(e) => setClassName(e.target.value)} list="sl-classes" placeholder="e.g. 3A" className={`${field} mt-1.5`} />
            <datalist id="sl-classes">{classes.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
          <div>
            <label className="text-sm font-semibold">Marked out of</label>
            <input value={maxScore} onChange={(e) => setMaxScore(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" className={`${field} mt-1.5`} />
          </div>
        </div>

        <button onClick={() => setPublish(!publish)} className="w-full mt-4 flex items-center gap-3 rounded-2xl bg-gray-50 px-4 py-3 text-left">
          {publish ? <Eye size={20} className="text-brand-purple" /> : <EyeOff size={20} className="text-amber-500" />}
          <span className="flex-1">
            <span className="block text-sm font-semibold">{publish ? 'Show to students and parents now' : 'Keep hidden for now'}</span>
            <span className="block text-xs text-gray-400">{publish ? 'They will get a notification.' : 'Only teachers see these until you publish.'}</span>
          </span>
          <span className={`w-11 h-6 rounded-full relative shrink-0 transition-colors ${publish ? 'bg-brand-purple' : 'bg-gray-300'}`}><span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${publish ? 'translate-x-5' : 'translate-x-0.5'}`} /></span>
        </button>

        <div className="flex items-center justify-between mt-6 mb-2">
          <p className="text-sm font-semibold flex items-center gap-1.5"><Users size={16} /> Students {rows.length ? `(${rows.length})` : ''}</p>
          <button onClick={() => setPicker(true)} className="flex items-center gap-1 text-sm font-semibold text-brand-purple"><Plus size={16} /> Add students</button>
        </div>

        {rows.length === 0 ? (
          <button onClick={() => setPicker(true)} className="w-full border border-dashed border-gray-300 rounded-2xl py-8 text-sm text-gray-400">Tap to choose the students in this class</button>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => {
              const p = r.score !== '' && max > 0 ? (Number(r.score) / max) * 100 : null
              const invalid = r.score !== '' && (Number.isNaN(Number(r.score)) || Number(r.score) < 0 || Number(r.score) > max)
              const g = p != null && !invalid ? gradeFor(p, scale)?.grade : null
              return (
                <div key={r.id} className="rounded-2xl border border-gray-100 p-3">
                  <div className="flex items-center gap-3">
                    <Avatar p={r} />
                    <p className="flex-1 min-w-0 text-sm font-medium truncate">{r.full_name}</p>
                    <input
                      value={r.score}
                      onChange={(e) => setRow(r.id, { score: e.target.value.replace(/[^0-9.]/g, '') })}
                      inputMode="decimal"
                      placeholder="—"
                      aria-label={`Score for ${r.full_name}`}
                      className={`w-16 text-center border rounded-xl py-2 text-[15px] font-semibold outline-none ${invalid ? 'border-red-400 text-red-600' : 'border-gray-200 focus:border-brand-purple'}`}
                    />
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${g ? `${tone(p).bg} ${tone(p).text}` : 'bg-gray-50 text-gray-300'}`}>{g || '·'}</span>
                    <button onClick={() => setRows((prev) => prev.filter((x) => x.id !== r.id))} aria-label="Remove" className="text-gray-300 -mr-1 p-1"><Trash2 size={16} /></button>
                  </div>
                  <input value={r.comment} onChange={(e) => setRow(r.id, { comment: e.target.value })} maxLength={140} placeholder="Comment (optional)" className="w-full mt-2 text-sm bg-gray-50 rounded-lg px-3 py-2 outline-none" />
                  {invalid ? <p className="text-xs text-red-500 mt-1">Enter a mark from 0 to {max}.</p> : null}
                </div>
              )
            })}
          </div>
        )}

        {rows.length > filled.length && filled.length > 0 ? <p className="text-xs text-gray-400 mt-3">{rows.length - filled.length} without a mark will be skipped.</p> : null}
        {error ? <p className="text-sm text-red-500 mt-4 flex items-start gap-1.5"><AlertCircle size={15} className="shrink-0 mt-0.5" /> {error}</p> : null}
      </div>

      {picker ? (
        <div className="absolute inset-0 z-10 bg-white flex flex-col">
          <div className="flex items-center gap-2 px-3 shrink-0 border-b border-gray-100" style={{ height: 56 }}>
            <button onClick={() => { setPicker(false); setChosen(new Set()) }} aria-label="Back" className="w-10 h-10 rounded-full flex items-center justify-center"><X size={22} /></button>
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} autoFocus placeholder="Search students" className="w-full bg-gray-100 rounded-full pl-10 pr-4 py-2.5 text-sm outline-none" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {!roster ? <p className="text-center text-gray-400 text-sm mt-10"><Loader2 size={18} className="animate-spin inline" /></p> : available.length === 0 ? <p className="text-center text-gray-400 text-sm mt-10 px-8">{roster.length === 0 ? 'No students have joined your school yet.' : 'No students match.'}</p> : (
              <>
                <button onClick={() => setChosen(new Set(available.map((p) => p.id)))} className="px-4 py-3 text-sm font-semibold text-brand-purple">Select all {available.length}</button>
                {available.map((p) => (
                  <button key={p.id} onClick={() => setChosen((prev) => { const n = new Set(prev); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n })} className="w-full flex items-center gap-3 px-4 py-2.5 text-left active:bg-gray-50">
                    <Avatar p={p} />
                    <span className="flex-1 min-w-0 text-sm font-medium truncate">{p.full_name}</span>
                    <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${chosen.has(p.id) ? 'bg-brand-purple border-brand-purple' : 'border-gray-300'}`}>{chosen.has(p.id) ? <Check size={14} className="text-white" strokeWidth={3} /> : null}</span>
                  </button>
                ))}
              </>
            )}
          </div>
          <div className="p-4 border-t border-gray-100">
            <button onClick={addChosen} disabled={chosen.size === 0} className="w-full bg-brand-purple text-white font-semibold py-3.5 rounded-full disabled:opacity-35">{chosen.size ? `Add ${chosen.size} student${chosen.size > 1 ? 's' : ''}` : 'Choose students'}</button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
