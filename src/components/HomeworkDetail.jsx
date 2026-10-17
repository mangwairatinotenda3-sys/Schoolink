import { useEffect, useRef, useState } from 'react'
import { Share2, Camera, Paperclip, CheckCircle2, Clock, AlertCircle, Award, Loader2, Undo2 } from 'lucide-react'
import ScreenHeader from './ScreenHeader.jsx'
import { ConfirmSheet } from './FamilySheets.jsx'
import { FileList, FileRow, Pill, Toast } from './HomeworkBits.jsx'
import { supabase } from '../lib/supabaseClient.js'
import {
  colorFor, dueOf, dueText, dueTone, filterPicked, gradeShort, gradeTone, idOf, mediaTypeFor, num, percentOf, shareText, stateOf, uploadAll, whenText, MAX_FILES,
} from '../lib/homeworkUtils.js'

function readDraft(key) {
  try { return localStorage.getItem(key) } catch { return null }
}
function writeDraft(key, value) {
  try { if (value) localStorage.setItem(key, value); else localStorage.removeItem(key) } catch { /* private mode */ }
}

function Card({ children, className = '' }) {
  return <div className={`rounded-2xl border border-gray-100 bg-white p-4 ${className}`}>{children}</div>
}

// What a student or a parent sees for one assignment
export default function HomeworkDetail({ a, attachments = [], work, mode, child, user, now, onBack, onReload }) {
  const isStudent = mode === 'student'
  const color = colorFor(a.subject)
  const state = stateOf(a, work, now)
  const due = dueOf(a)
  const past = !!due && now > due
  const blocked = past && a.allow_late === false
  const first = (child?.full_name || 'Your child').split(' ')[0]

  const draftKey = `hw-draft-${user?.id}-${idOf(a)}`
  const [body, setBody] = useState(() => work?.body ?? (isStudent ? readDraft(draftKey) : '') ?? '')
  const [files, setFiles] = useState(work?.files || [])
  const [pending, setPending] = useState([])
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState('')
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [toast, setToast] = useState('')
  const fileRef = useRef(null)
  const camRef = useRef(null)

  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(''), 2400)
    return () => clearTimeout(t)
  }, [toast])

  // When the saved work changes (handed in, taken back), show what was saved
  useEffect(() => {
    setBody(work?.body ?? (isStudent ? readDraft(draftKey) : '') ?? '')
    setFiles(work?.files || [])
    setPending([])
  }, [work?.status, work?.submitted_at, work?.returned_at])

  const locked = work?.status === 'submitted' || work?.status === 'returned'
  const editable = isStudent && a.accepts_work !== false && !locked
  const hasContent = body.trim().length > 0 || files.length + pending.length > 0
  const total = files.length + pending.length

  function onBody(v) {
    setBody(v)
    writeDraft(draftKey, v)
  }

  function pick(e) {
    const { picked, skipped } = filterPicked(Array.from(e.target.files || []), MAX_FILES - total)
    e.target.value = ''
    setPending((p) => [...p, ...picked])
    setError(skipped.join('. '))
  }

  async function persist(submit) {
    setConfirm(null)
    setBusy(true)
    setError('')
    try {
      const uploaded = pending.length ? await uploadAll(pending, `submissions/${a.school_id}/${idOf(a)}/${user.id}`, (i, n) => setStep(`Uploading ${i} of ${n}…`)) : []
      const all = [...files, ...uploaded]
      const { data, error: err } = await supabase.rpc('hw_save_work', { p_assignment: idOf(a), p_body: body, p_files: all, p_submit: submit })
      if (err || !data?.ok) throw new Error(err?.message || data?.error || 'Something went wrong. Try again.')
      setFiles(all)
      setPending([])
      if (submit) writeDraft(draftKey, '')
      await onReload()
      setToast(submit ? (data.is_late ? 'Handed in late' : 'Handed in') : locked ? 'Taken back. You can edit it now' : 'Draft saved')
    } catch (e) {
      setError(e.message)
    }
    setBusy(false)
    setStep('')
  }

  function share() {
    const text = shareText(a, now)
    if (navigator.share) navigator.share({ title: a.title, text }).catch(() => {})
    else navigator.clipboard?.writeText(text).then(() => setToast('Copied'))
  }

  const pct = percentOf(work?.grade, a.points)
  const tone = gradeTone(pct)

  return (
    <div className="app-shell relative">
      <ScreenHeader
        title={a.subject || 'Assignment'}
        sub={isStudent ? (a.class_name ? `Class ${a.class_name}` : undefined) : child?.full_name}
        onBack={onBack}
        right={<button onClick={share} aria-label="Share" className="w-10 h-10 rounded-full flex items-center justify-center"><Share2 size={19} /></button>}
      />

      <div className="flex-1 overflow-y-auto" style={{ paddingBottom: 24 }}>
        <div className={`${color.soft} px-4 pt-5 pb-5`}>
          <div className="flex items-center gap-2">
            <Pill className={state.pill}>{state.label}</Pill>
            {a.points ? <span className="text-xs text-gray-500 font-medium">{num(a.points)} points</span> : null}
          </div>
          <h2 className="text-[22px] font-bold leading-tight mt-3">{a.title}</h2>
          <p className={`text-sm font-medium mt-2 ${dueTone(a, state, now)}`}>{dueText(a, now)}</p>
          <p className="text-xs text-gray-500 mt-1">{[a.author_name, a.created_at ? `Posted ${whenText(a.created_at)}` : null].filter(Boolean).join(' · ')}</p>
        </div>

        <div className="px-4 space-y-3 pt-4">
          {a.description ? (
            <Card>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Instructions</p>
              <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">{a.description}</p>
            </Card>
          ) : null}

          {attachments.length > 0 ? (
            <Card>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">From your teacher</p>
              <FileList files={attachments} />
            </Card>
          ) : null}

          {/* Marked */}
          {work?.status === 'returned' ? (
            <Card className={`${tone.bg} border-transparent`}>
              <div className="flex items-center gap-4">
                <span className="w-16 h-16 rounded-full bg-white flex items-center justify-center shrink-0" style={{ boxShadow: `inset 0 0 0 4px ${tone.ring}` }}>
                  <Award size={26} className={tone.text} />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{isStudent ? 'Your mark' : `${first}'s mark`}</p>
                  <p className={`text-3xl font-bold leading-tight ${tone.text}`}>{work.grade != null ? gradeShort(work.grade, a.points) : 'Marked'}{pct != null ? <span className="text-base font-semibold ml-2">{pct}%</span> : null}</p>
                  {work.returned_at ? <p className="text-xs text-gray-500">Returned {whenText(work.returned_at)}</p> : null}
                </div>
              </div>
              {work.feedback ? (
                <div className="mt-4 rounded-xl bg-white/80 p-3">
                  <p className="text-xs font-semibold text-gray-400 mb-1">Teacher's feedback</p>
                  <p className="text-[15px] whitespace-pre-wrap break-words">{work.feedback}</p>
                </div>
              ) : null}
            </Card>
          ) : null}

          {/* The work itself */}
          {a.accepts_work === false ? (
            <Card>
              <p className="font-semibold">Not handed in on Schoolink</p>
              <p className="text-sm text-gray-500 mt-1">{isStudent ? 'Do this homework the way your teacher asked.' : `${first} does this homework without handing it in here.`}</p>
            </Card>
          ) : (
            <Card>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{isStudent ? 'Your work' : `${first}'s work`}</p>
                {work?.status === 'submitted' ? (
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold ${work.is_late ? 'text-amber-600' : 'text-emerald-600'}`}>
                    <CheckCircle2 size={14} /> {work.is_late ? 'Late' : 'Handed in'} {whenText(work.submitted_at)}
                  </span>
                ) : null}
              </div>

              {!isStudent && !work ? (
                <div className="flex items-center gap-3 text-sm text-gray-500"><Clock size={18} className="text-gray-400" /> {first} has not handed this in yet.</div>
              ) : null}

              {editable ? (
                <textarea value={body} onChange={(e) => onBody(e.target.value)} placeholder="Type your answer here" rows={5} maxLength={8000} className="w-full bg-gray-100 rounded-xl px-4 py-3 text-[15px] outline-none resize-none" />
              ) : body ? (
                <p className="text-[15px] whitespace-pre-wrap break-words bg-gray-50 rounded-xl p-3">{body}</p>
              ) : null}

              {files.length > 0 || pending.length > 0 ? (
                <div className="space-y-2 mt-3">
                  {files.map((f, i) => <FileRow key={`${f.url}-${i}`} file={f} onRemove={editable ? () => setFiles((x) => x.filter((_, j) => j !== i)) : undefined} />)}
                  {pending.map((f, i) => <FileRow key={`${f.name}-${i}`} file={{ name: f.name, size: f.size, type: mediaTypeFor(f) }} onRemove={() => setPending((p) => p.filter((_, j) => j !== i))} />)}
                </div>
              ) : null}

              {editable ? (
                <div className="flex gap-2 mt-3">
                  <button onClick={() => camRef.current?.click()} disabled={total >= MAX_FILES} className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gray-100 py-3 text-sm font-medium text-gray-700 active:bg-gray-200 disabled:opacity-40"><Camera size={17} /> Take photo</button>
                  <button onClick={() => fileRef.current?.click()} disabled={total >= MAX_FILES} className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gray-100 py-3 text-sm font-medium text-gray-700 active:bg-gray-200 disabled:opacity-40"><Paperclip size={17} /> Add file</button>
                  <input ref={camRef} type="file" accept="image/*" capture="environment" onChange={pick} className="hidden" />
                  <input ref={fileRef} type="file" multiple onChange={pick} className="hidden" />
                </div>
              ) : null}

              {isStudent && work?.status === 'submitted' ? (
                <button onClick={() => persist(false)} disabled={busy} className="w-full mt-4 flex items-center justify-center gap-2 rounded-full border border-gray-200 py-3 font-semibold text-gray-700 disabled:opacity-40">
                  {busy ? <Loader2 size={17} className="animate-spin" /> : <><Undo2 size={17} /> Take back to edit</>}
                </button>
              ) : null}

              {isStudent && work?.status === 'returned' ? <p className="text-xs text-gray-400 mt-3">This work is marked. Ask your teacher if you need to do it again.</p> : null}
              {isStudent && !locked && a.accepts_work !== false && blocked ? (
                <p className="flex items-center gap-2 text-sm text-red-500 mt-4"><AlertCircle size={16} /> The deadline has passed and late work is not accepted.</p>
              ) : null}
              {step ? <p className="text-sm text-gray-500 mt-3 text-center">{step}</p> : null}
              {error ? <p className="text-sm text-red-500 mt-3 text-center">{error}</p> : null}
            </Card>
          )}
        </div>
      </div>

      {editable && !blocked ? (
        <div className="shrink-0 border-t border-gray-100 bg-white px-4 pt-3 flex gap-3" style={{ paddingBottom: 'max(14px, env(safe-area-inset-bottom))' }}>
          <button onClick={() => persist(false)} disabled={busy || !hasContent} className="flex-1 rounded-full border border-gray-200 py-3.5 font-semibold text-gray-700 disabled:opacity-40">Save draft</button>
          <button onClick={() => setConfirm('submit')} disabled={busy || !hasContent} className="flex-[1.4] rounded-full bg-brand-purple text-white py-3.5 font-semibold disabled:opacity-40 flex items-center justify-center">
            {busy ? <Loader2 size={18} className="animate-spin" /> : past ? 'Hand in late' : 'Hand in'}
          </button>
        </div>
      ) : null}

      {confirm === 'submit' ? (
        <ConfirmSheet
          title={past ? 'Hand in late work?' : 'Hand in your work?'}
          body={past ? 'This will be marked as late. You can take it back until your teacher marks it.' : 'You can take it back and change it until your teacher marks it.'}
          confirmLabel="Hand in"
          onConfirm={() => persist(true)}
          onClose={() => setConfirm(null)}
        />
      ) : null}
      <Toast text={toast} />
    </div>
  )
}
