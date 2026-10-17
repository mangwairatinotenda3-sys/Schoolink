import { useState } from 'react'
import { X, ChevronLeft, ChevronRight, Loader2, CheckCircle2, Clock, Undo2 } from 'lucide-react'
import PersonAvatar from './PersonAvatar.jsx'
import BottomSheet from './BottomSheet.jsx'
import { FileList, Pill } from './HomeworkBits.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { QUICK_COMMENTS, idOf, num, percentOf, whenText, gradeTone } from '../lib/homeworkUtils.js'

function statusOf(row) {
  if (row.status === 'returned') return { label: 'Marked', pill: 'bg-emerald-50 text-emerald-700' }
  if (row.status === 'submitted') return row.is_late ? { label: 'Handed in late', pill: 'bg-amber-50 text-amber-700' } : { label: 'Handed in', pill: 'bg-brand-light text-brand-purple' }
  return { label: 'Not handed in', pill: 'bg-gray-100 text-gray-500' }
}

// Full-screen marking view for one student, with next and back through the class
export default function HomeworkGrade({ a, rows, index, onIndex, onClose, onSaved }) {
  const row = rows[index]
  const [grade, setGrade] = useState(row.grade != null ? num(row.grade) : '')
  const [feedback, setFeedback] = useState(row.feedback || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [redo, setRedo] = useState(null)

  const st = statusOf(row)
  const hasWork = !!row.body || (row.files || []).length > 0
  const g = grade.trim() === '' ? null : Number(grade)
  const pct = percentOf(g, a.points)
  const tone = gradeTone(pct)
  const gradeBad = g != null && (!Number.isFinite(g) || g < 0)
  const over = g != null && a.points && g > Number(a.points)
  const canReturn = !busy && !gradeBad && (g != null || feedback.trim().length > 0)

  function addComment(c) {
    setFeedback((f) => (f.trim() ? `${f.trim()} ${c}` : c))
  }

  async function save(returnIt) {
    setBusy(true)
    setError('')
    const { data, error: err } = await supabase.rpc('hw_grade', { p_assignment: idOf(a), p_student: row.student_id, p_grade: g, p_feedback: feedback, p_return: returnIt })
    setBusy(false)
    if (err || !data?.ok) { setError(err?.message || data?.error || 'Could not save. Try again.'); return }
    onSaved(returnIt ? `Returned to ${row.full_name.split(' ')[0]}` : 'Saved. The student cannot see it yet', returnIt)
  }

  async function sendRedo() {
    setBusy(true)
    const { data, error: err } = await supabase.rpc('hw_reopen', { p_assignment: idOf(a), p_student: row.student_id, p_note: redo.note })
    setBusy(false)
    if (err || !data?.ok) { setError(err?.message || data?.error || 'Could not send it back.'); setRedo(null); return }
    setRedo(null)
    onSaved(`Sent back to ${row.full_name.split(' ')[0]}`, false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col max-w-[480px] mx-auto">
      <div className="flex items-center justify-between px-3 shrink-0 border-b border-gray-100" style={{ height: 56 }}>
        <div className="flex items-center gap-1 min-w-0">
          <button onClick={onClose} aria-label="Close" className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"><X size={22} /></button>
          <div className="min-w-0">
            <p className="font-semibold leading-tight truncate">{row.full_name}</p>
            <p className="text-[11px] text-gray-400 leading-tight">{index + 1} of {rows.length}{row.class_name ? ` · ${row.class_name}` : ''}</p>
          </div>
        </div>
        <div className="flex items-center">
          <button onClick={() => onIndex(index - 1)} disabled={index === 0} aria-label="Previous student" className="w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-30"><ChevronLeft size={22} /></button>
          <button onClick={() => onIndex(index + 1)} disabled={index >= rows.length - 1} aria-label="Next student" className="w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-30"><ChevronRight size={22} /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8">
        <div className="flex items-center gap-3 pt-4">
          <PersonAvatar p={{ full_name: row.full_name, avatar_url: row.avatar_url }} size={48} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold truncate">{row.full_name}</p>
            <p className="text-xs text-gray-400">{row.submitted_at ? `${row.is_late ? 'Late · ' : ''}${whenText(row.submitted_at)}` : 'Nothing handed in yet'}</p>
          </div>
          <Pill className={st.pill}>{st.label}</Pill>
        </div>

        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mt-6 mb-2">Their work</p>
        {hasWork ? (
          <div className="space-y-3">
            {row.body ? <p className="text-[15px] whitespace-pre-wrap break-words bg-gray-50 rounded-xl p-3.5">{row.body}</p> : null}
            <FileList files={row.files} />
            {row.status === 'draft' ? <p className="flex items-center gap-2 text-xs text-gray-400"><Clock size={13} /> This is a draft. The student has not handed it in.</p> : null}
          </div>
        ) : (
          <p className="text-sm text-gray-400 bg-gray-50 rounded-xl p-4">{a.accepts_work === false ? 'This assignment is not collected in the app. You can still enter a mark.' : 'The student has not handed in anything.'}</p>
        )}

        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mt-6 mb-2">Mark</p>
        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center bg-gray-100 rounded-xl px-4">
            <input value={grade} onChange={(e) => setGrade(e.target.value.replace(/[^0-9.]/g, '').slice(0, 6))} inputMode="decimal" placeholder="Mark" className="flex-1 bg-transparent py-3.5 text-lg font-semibold outline-none min-w-0" />
            {a.points ? <span className="text-gray-400 font-medium">/ {num(a.points)}</span> : null}
          </div>
          {pct != null ? <span className={`rounded-xl px-3.5 py-3.5 text-lg font-bold ${tone.bg} ${tone.text}`}>{pct}%</span> : null}
        </div>
        {a.points ? (
          <div className="flex gap-2 mt-2.5">
            <button onClick={() => setGrade(num(a.points))} className="rounded-full bg-gray-100 px-3.5 py-1.5 text-sm font-medium text-gray-600">Full marks</button>
            <button onClick={() => setGrade('0')} className="rounded-full bg-gray-100 px-3.5 py-1.5 text-sm font-medium text-gray-600">Zero</button>
            {grade ? <button onClick={() => setGrade('')} className="rounded-full bg-gray-100 px-3.5 py-1.5 text-sm font-medium text-gray-600">Clear</button> : null}
          </div>
        ) : null}
        {over ? <p className="text-xs text-amber-600 mt-2">This is more than the {num(a.points)} points.</p> : null}
        {gradeBad ? <p className="text-xs text-red-500 mt-2">Type a valid mark.</p> : null}

        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mt-6 mb-2">Feedback</p>
        <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Write something helpful" rows={4} maxLength={2000} className="w-full bg-gray-100 rounded-xl px-4 py-3 text-[15px] outline-none resize-none" />
        <div className="flex gap-2 overflow-x-auto mt-2.5" style={{ scrollbarWidth: 'none' }}>
          {QUICK_COMMENTS.map((c) => <button key={c} onClick={() => addComment(c)} className="shrink-0 rounded-full bg-brand-light text-brand-purple px-3.5 py-1.5 text-sm font-medium">{c}</button>)}
        </div>

        {row.status === 'returned' ? <p className="flex items-center gap-2 text-xs text-emerald-600 mt-4"><CheckCircle2 size={14} /> Returned {whenText(row.returned_at)}. Returning again updates what they see.</p> : null}
        {error ? <p className="text-sm text-red-500 mt-4">{error}</p> : null}

        <button onClick={() => save(true)} disabled={!canReturn} className="w-full mt-6 bg-brand-purple text-white font-semibold py-3.5 rounded-full disabled:opacity-40 flex items-center justify-center">
          {busy ? <Loader2 size={18} className="animate-spin" /> : row.status === 'returned' ? 'Return again' : 'Return to student'}
        </button>
        <button onClick={() => save(false)} disabled={busy || gradeBad || (g == null && !feedback.trim())} className="w-full mt-2 py-3.5 font-semibold text-gray-600 disabled:opacity-40">Save without showing</button>
        {row.status === 'submitted' || row.status === 'returned' ? (
          <button onClick={() => setRedo({ note: '' })} disabled={busy} className="w-full py-3 text-sm font-medium text-red-500 flex items-center justify-center gap-2"><Undo2 size={15} /> Ask them to do it again</button>
        ) : null}
      </div>

      {redo ? (
        <BottomSheet onClose={() => setRedo(null)}>
          <div className="px-3">
            <p className="font-semibold text-lg">Send back to {row.full_name.split(' ')[0]}?</p>
            <p className="text-sm text-gray-500 mt-1">Their work goes back to draft so they can change it and hand it in again. They get a notification.</p>
            <input value={redo.note} onChange={(e) => setRedo({ note: e.target.value })} placeholder="What should they change? (optional)" maxLength={300} className="w-full mt-4 bg-gray-100 rounded-xl px-4 py-3 text-[15px] outline-none" />
            <button onClick={sendRedo} disabled={busy} className="w-full mt-4 bg-brand-purple text-white font-semibold py-3.5 rounded-full disabled:opacity-40 flex items-center justify-center">
              {busy ? <Loader2 size={18} className="animate-spin" /> : 'Send back'}
            </button>
            <button onClick={() => setRedo(null)} className="w-full mt-1 py-3.5 text-gray-500 font-medium">Cancel</button>
          </div>
        </BottomSheet>
      ) : null}
    </div>
  )
}
