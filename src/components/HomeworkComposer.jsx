import { useRef, useState } from 'react'
import { X, Paperclip, Loader2, CalendarDays } from 'lucide-react'
import { Switch, FileRow } from './HomeworkBits.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { dueOf, filterPicked, mediaTypeFor, presetDue, toInputValue, MAX_FILES, idOf } from '../lib/homeworkUtils.js'

function Label({ children }) {
  return <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2 mt-6">{children}</p>
}

function Chip({ active, onClick, children }) {
  return <button type="button" onClick={onClick} className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-medium ${active ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-600'}`}>{children}</button>
}

// Full-screen form to post or change an assignment.
export default function HomeworkComposer({ assignment, attachments = [], schoolId, user, profile, classes = [], subjects = [], onClose, onSaved }) {
  const editing = !!assignment
  const fileRef = useRef(null)
  const startDue = editing ? dueOf(assignment) : null

  const [title, setTitle] = useState(assignment?.title || '')
  const [subject, setSubject] = useState(assignment?.subject || '')
  const [className, setClassName] = useState(assignment?.class_name || '')
  const [description, setDescription] = useState(assignment?.description || '')
  const [due, setDue] = useState(editing ? (startDue ? toInputValue(startDue) : '') : presetDue('tomorrow'))
  const [points, setPoints] = useState(assignment?.points != null ? String(Number(assignment.points)) : '')
  const [acceptsWork, setAcceptsWork] = useState(assignment ? assignment.accepts_work !== false : true)
  const [allowLate, setAllowLate] = useState(assignment ? assignment.allow_late !== false : true)
  const [notify, setNotify] = useState(true)
  const [kept, setKept] = useState(attachments)
  const [removed, setRemoved] = useState([])
  const [pending, setPending] = useState([])
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState('')
  const [error, setError] = useState('')

  const total = kept.length + pending.length
  const canSave = title.trim().length > 0 && !busy

  function pick(e) {
    const { picked, skipped } = filterPicked(Array.from(e.target.files || []), MAX_FILES - total)
    e.target.value = ''
    setPending((p) => [...p, ...picked])
    setError(skipped.join('. '))
  }

  function removeKept(att) {
    setKept((k) => k.filter((x) => x.id !== att.id))
    setRemoved((r) => [...r, att.id])
  }

  async function save() {
    if (!canSave) return
    setBusy(true)
    setError('')
    const pts = points.trim() === '' ? null : Number(points)
    if (pts != null && (!Number.isFinite(pts) || pts < 0)) { setBusy(false); setError('Points must be a number.'); return }
    const dueIso = due ? new Date(due).toISOString() : null
    const fields = {
      title: title.trim(),
      subject: subject.trim() || null,
      description: description.trim() || null,
      class_name: className || null,
      points: pts,
      due_at: dueIso,
      due_date: dueIso,
      accepts_work: acceptsWork,
      allow_late: allowLate,
    }

    let id = assignment ? assignment.id : null
    if (editing) {
      const { error: upErr } = await supabase.from('assignments').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id)
      if (upErr) { setBusy(false); setError(upErr.message); return }
    } else {
      const { data: row, error: inErr } = await supabase
        .from('assignments')
        .insert({ ...fields, school_id: schoolId, created_by: user.id, author_name: profile?.full_name || user.email })
        .select()
        .maybeSingle()
      if (inErr || !row) { setBusy(false); setError(inErr?.message || 'Could not post the assignment.'); return }
      id = row.id
    }

    const failed = []
    if (removed.length) await supabase.from('assignment_attachments').delete().in('id', removed)
    for (let i = 0; i < pending.length; i += 1) {
      const file = pending[i]
      setStep(`Uploading ${i + 1} of ${pending.length}…`)
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `assignments/${schoolId}/${idOf(id)}/${Date.now()}-${i}-${safe}`
      const { error: upErr } = await supabase.storage.from('school-media').upload(path, file)
      if (upErr) { failed.push(file.name); continue }
      const { data: pub } = supabase.storage.from('school-media').getPublicUrl(path)
      await supabase.from('assignment_attachments').insert({ assignment_id: id, file_url: pub.publicUrl, file_name: file.name, media_type: mediaTypeFor(file) })
    }

    if (!editing && notify) await supabase.rpc('hw_announce', { p_assignment: idOf(id) })
    setBusy(false)
    onSaved({ id, isNew: !editing, failed })
  }

  return (
    <div className="fixed inset-0 z-40 bg-white flex flex-col max-w-[480px] mx-auto">
      <div className="flex items-center justify-between px-3 shrink-0 border-b border-gray-100" style={{ height: 56 }}>
        <div className="flex items-center gap-1">
          <button onClick={onClose} disabled={busy} aria-label="Close" className="w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-40"><X size={22} /></button>
          <h1 className="font-semibold text-lg">{editing ? 'Edit assignment' : 'New assignment'}</h1>
        </div>
        <button onClick={save} disabled={!canSave} className="bg-brand-purple text-white font-semibold rounded-full px-5 py-2 text-sm disabled:opacity-40 flex items-center gap-2">
          {busy ? <Loader2 size={16} className="animate-spin" /> : null}{editing ? 'Save' : 'Post'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-10">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" maxLength={120} className="w-full text-xl font-semibold pt-5 pb-3 outline-none border-b border-gray-100 placeholder:text-gray-300" />

        <Label>Subject</Label>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="For example Maths" maxLength={40} className="w-full bg-gray-100 rounded-xl px-4 py-3 text-[15px] outline-none" />
        {subjects.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto mt-2.5" style={{ scrollbarWidth: 'none' }}>
            {subjects.slice(0, 10).map((s) => <Chip key={s} active={subject.trim().toLowerCase() === s.toLowerCase()} onClick={() => setSubject(s)}>{s}</Chip>)}
          </div>
        ) : null}

        <Label>Who is it for</Label>
        <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <Chip active={!className} onClick={() => setClassName('')}>Whole school</Chip>
          {classes.map((c) => <Chip key={c} active={className === c} onClick={() => setClassName(c)}>{c}</Chip>)}
        </div>
        {classes.length === 0 ? <p className="text-xs text-gray-400 mt-2">Put students in classes from More → Parent Links → Classes and you can choose a class here.</p> : null}

        <Label>Instructions</Label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What should students do?" rows={5} maxLength={4000} className="w-full bg-gray-100 rounded-xl px-4 py-3 text-[15px] outline-none resize-none" />

        <Label>Due</Label>
        <div className="flex gap-2 overflow-x-auto mb-3" style={{ scrollbarWidth: 'none' }}>
          <Chip active={due === presetDue('tomorrow')} onClick={() => setDue(presetDue('tomorrow'))}>Tomorrow</Chip>
          <Chip active={due === presetDue('three')} onClick={() => setDue(presetDue('three'))}>In 3 days</Chip>
          <Chip active={due === presetDue('week')} onClick={() => setDue(presetDue('week'))}>Next week</Chip>
          <Chip active={!due} onClick={() => setDue('')}>No due date</Chip>
        </div>
        <div className="flex items-center gap-3 bg-gray-100 rounded-xl px-4 py-3">
          <CalendarDays size={18} className="text-gray-400 shrink-0" />
          <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className="flex-1 bg-transparent outline-none text-[15px] min-w-0" />
        </div>

        <Label>Points</Label>
        <input value={points} onChange={(e) => setPoints(e.target.value.replace(/[^0-9.]/g, '').slice(0, 6))} inputMode="decimal" placeholder="Out of (optional)" className="w-full bg-gray-100 rounded-xl px-4 py-3 text-[15px] outline-none" />

        <Label>Attachments</Label>
        <div className="space-y-2">
          {kept.map((att) => <FileRow key={att.id} file={att} onRemove={() => removeKept(att)} />)}
          {pending.map((f, i) => <FileRow key={`${f.name}-${i}`} file={{ name: f.name, size: f.size, type: mediaTypeFor(f) }} onRemove={() => setPending((p) => p.filter((_, j) => j !== i))} />)}
        </div>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={total >= MAX_FILES} className="w-full mt-2 flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500 disabled:opacity-40">
          <Paperclip size={16} /> Add photos, videos or files
        </button>
        <input ref={fileRef} type="file" multiple onChange={pick} className="hidden" />

        <div className="mt-4 divide-y divide-gray-100">
          <Switch on={acceptsWork} onChange={setAcceptsWork} label="Students hand in work here" sub="They can type an answer or add photos and files" />
          <Switch on={allowLate} onChange={setAllowLate} disabled={!acceptsWork} label="Accept late work" sub="Late work is marked as late" />
          {!editing ? <Switch on={notify} onChange={setNotify} label="Notify students and parents" sub="They get a notification now" /> : null}
        </div>

        {step && busy ? <p className="text-sm text-gray-500 mt-4 text-center">{step}</p> : null}
        {error ? <p className="text-sm text-red-500 mt-4 text-center">{error}</p> : null}
      </div>
    </div>
  )
}
