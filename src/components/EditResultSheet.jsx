import { useState } from 'react'
import { Loader2, Trash2, Plus, RotateCcw, AlertCircle } from 'lucide-react'
import BottomSheet from './BottomSheet.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { ASSESSMENTS, DEFAULT_SCALE, gradeFor, normaliseScale, tone } from '../lib/resultsUtils.js'

const field = 'w-full border border-gray-200 rounded-xl px-3.5 py-3 text-[15px] outline-none focus:border-brand-purple bg-white'

// Change or delete one mark.
export function EditResultSheet({ row, scale, onClose, onSaved, onDeleted }) {
  const [score, setScore] = useState(row.score == null ? '' : String(row.score))
  const [max, setMax] = useState(String(row.max_score || 100))
  const [assessment, setAssessment] = useState(row.assessment || 'Exam')
  const [comment, setComment] = useState(row.comment || '')
  const [published, setPublished] = useState(row.published !== false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const s = Number(score)
  const m = Number(max)
  const valid = score !== '' && !Number.isNaN(s) && m > 0 && s >= 0 && s <= m
  const g = valid ? gradeFor((s / m) * 100, scale) : null

  async function save() {
    if (!valid || busy) return
    setBusy(true)
    setError('')
    const patch = { score: s, max_score: m, assessment, comment: comment.trim() || null, published, grade: g?.grade || row.grade, updated_at: new Date().toISOString() }
    const { error: e } = await supabase.from('exam_results').update(patch).eq('id', row.id)
    if (e) { setError(e.message); setBusy(false); return }
    if (published && !row.published && row.student_id) await supabase.rpc('announce_results', { p_term: row.term, p_year: row.year, p_students: [row.student_id] })
    onSaved({ ...row, ...patch })
  }

  async function remove() {
    if (!window.confirm('Delete this mark? This cannot be undone.')) return
    setBusy(true)
    const { error: e } = await supabase.from('exam_results').delete().eq('id', row.id)
    if (e) { setError(e.message); setBusy(false); return }
    onDeleted(row.id)
  }

  return (
    <BottomSheet onClose={onClose}>
      <div className="px-3">
        <p className="font-semibold text-lg">{row.subject}</p>
        <p className="text-sm text-gray-400">{row.student_name} · {row.term} {row.year}</p>

        <div className="flex items-end gap-3 mt-4">
          <div className="flex-1"><label className="text-sm font-semibold">Mark</label><input value={score} onChange={(e) => setScore(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" className={`${field} mt-1.5`} /></div>
          <span className="pb-3.5 text-gray-400">out of</span>
          <div className="flex-1"><input value={max} onChange={(e) => setMax(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" className={field} /></div>
          <span className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold ${g ? `${tone((s / m) * 100).bg} ${tone((s / m) * 100).text}` : 'bg-gray-100 text-gray-300'}`}>{g?.grade || '·'}</span>
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          {ASSESSMENTS.map((a) => <button key={a} onClick={() => setAssessment(a)} className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${assessment === a ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-600'}`}>{a}</button>)}
        </div>

        <input value={comment} onChange={(e) => setComment(e.target.value)} maxLength={140} placeholder="Comment (optional)" className={`${field} mt-4`} />

        <label className="flex items-center justify-between mt-4 text-sm">
          <span className="font-medium">Visible to students and parents</span>
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="w-5 h-5 accent-[var(--brand-purple)]" />
        </label>

        {error ? <p className="text-sm text-red-500 mt-3 flex items-center gap-1.5"><AlertCircle size={15} /> {error}</p> : null}
        <button onClick={save} disabled={!valid || busy} className="w-full mt-5 bg-brand-purple text-white font-semibold py-3.5 rounded-full disabled:opacity-40 flex items-center justify-center">{busy ? <Loader2 size={18} className="animate-spin" /> : 'Save changes'}</button>
        <button onClick={remove} disabled={busy} className="w-full mt-1 py-3.5 text-red-500 font-medium flex items-center justify-center gap-2"><Trash2 size={17} /> Delete this mark</button>
      </div>
    </BottomSheet>
  )
}

// The teacher's and the headteacher's words at the bottom of the report card.
export function RemarksSheet({ student, schoolId, term, year, remarks, isAdmin, userId, onClose, onSaved }) {
  const [teacher, setTeacher] = useState(remarks?.teacher_remark || '')
  const [head, setHead] = useState(remarks?.head_remark || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setBusy(true)
    setError('')
    const row = {
      school_id: schoolId, student_id: student.id, term, year,
      teacher_remark: teacher.trim() || null,
      head_remark: isAdmin ? head.trim() || null : remarks?.head_remark || null,
      updated_by: userId, updated_at: new Date().toISOString(),
    }
    const { error: e } = await supabase.from('report_remarks').upsert(row, { onConflict: 'student_id,term,year' })
    if (e) { setError(e.message); setBusy(false); return }
    onSaved(row)
  }

  return (
    <BottomSheet onClose={onClose}>
      <div className="px-3">
        <p className="font-semibold text-lg">Remarks</p>
        <p className="text-sm text-gray-400">{student.full_name} · {term} {year}</p>
        <label className="text-sm font-semibold block mt-4">Class teacher</label>
        <textarea value={teacher} onChange={(e) => setTeacher(e.target.value)} rows={3} maxLength={400} placeholder="How did they do this term?" className={`${field} mt-1.5 resize-none`} />
        <label className="text-sm font-semibold block mt-4">Headteacher {isAdmin ? '' : <span className="font-normal text-gray-400">(only the head can write this)</span>}</label>
        <textarea value={head} onChange={(e) => setHead(e.target.value)} disabled={!isAdmin} rows={3} maxLength={400} placeholder={isAdmin ? 'A few words for the report' : ''} className={`${field} mt-1.5 resize-none disabled:bg-gray-50 disabled:text-gray-400`} />
        {error ? <p className="text-sm text-red-500 mt-3">{error}</p> : null}
        <button onClick={save} disabled={busy} className="w-full mt-5 bg-brand-purple text-white font-semibold py-3.5 rounded-full disabled:opacity-40 flex items-center justify-center">{busy ? <Loader2 size={18} className="animate-spin" /> : 'Save remarks'}</button>
      </div>
    </BottomSheet>
  )
}

// The head decides what mark earns which grade.
export function GradingScaleSheet({ scale, schoolId, onClose, onSaved }) {
  const [rows, setRows] = useState(() => normaliseScale(scale).map((r) => ({ ...r, min: String(r.min) })))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function setRow(i, patch) {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  }

  async function save() {
    const parsed = rows.map((r) => ({ min: Number(r.min), grade: r.grade.trim(), label: r.label.trim() }))
    if (parsed.some((r) => !r.grade || Number.isNaN(r.min) || r.min < 0 || r.min > 100)) { setError('Every row needs a grade and a mark from 0 to 100.'); return }
    if (new Set(parsed.map((r) => r.min)).size !== parsed.length) { setError('Two rows have the same starting mark.'); return }
    if (!parsed.some((r) => r.min === 0)) { setError('The lowest grade must start at 0.'); return }
    setBusy(true)
    const clean = normaliseScale(parsed)
    const { error: e } = await supabase.from('schools').update({ grading_scale: clean }).eq('id', schoolId)
    if (e) { setError(e.message); setBusy(false); return }
    onSaved(clean)
  }

  return (
    <BottomSheet onClose={onClose}>
      <div className="px-3">
        <p className="font-semibold text-lg">Grading scale</p>
        <p className="text-sm text-gray-400 mb-3">A student gets the grade whose starting mark they reach.</p>
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={r.min} onChange={(e) => setRow(i, { min: e.target.value.replace(/\D/g, '').slice(0, 3) })} inputMode="numeric" aria-label="Starting mark" className="w-16 text-center border border-gray-200 rounded-xl py-2.5 outline-none focus:border-brand-purple" />
              <span className="text-gray-400 text-sm">% +</span>
              <input value={r.grade} onChange={(e) => setRow(i, { grade: e.target.value.slice(0, 3) })} aria-label="Grade" className="w-14 text-center font-bold border border-gray-200 rounded-xl py-2.5 outline-none focus:border-brand-purple" />
              <input value={r.label} onChange={(e) => setRow(i, { label: e.target.value })} placeholder="Meaning" className="flex-1 min-w-0 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-brand-purple" />
              <button onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))} disabled={rows.length <= 2} aria-label="Remove" className="text-gray-300 disabled:opacity-30 p-1"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between mt-3">
          <button onClick={() => setRows((prev) => [...prev, { min: '', grade: '', label: '' }])} className="flex items-center gap-1 text-sm font-semibold text-brand-purple"><Plus size={16} /> Add a grade</button>
          <button onClick={() => setRows(DEFAULT_SCALE.map((r) => ({ ...r, min: String(r.min) })))} className="flex items-center gap-1 text-sm text-gray-500"><RotateCcw size={14} /> Reset</button>
        </div>
        {error ? <p className="text-sm text-red-500 mt-3">{error}</p> : null}
        <button onClick={save} disabled={busy} className="w-full mt-5 bg-brand-purple text-white font-semibold py-3.5 rounded-full disabled:opacity-40 flex items-center justify-center">{busy ? <Loader2 size={18} className="animate-spin" /> : 'Save scale'}</button>
      </div>
    </BottomSheet>
  )
}
