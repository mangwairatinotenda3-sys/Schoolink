import { useMemo, useState } from 'react'
import { Loader2, Trash2, AlertTriangle, AlertCircle, MapPin, User, Clock, MessageCircle, Pencil, StickyNote, Copy } from 'lucide-react'
import BottomSheet from './BottomSheet.jsx'
import { ConfirmSheet } from './FamilySheets.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { DAYS, SHORT_DAY, DURATIONS, colorFor, durationText, findConflicts, hhmm, lessonMinutes, toMinutes } from '../lib/timetableUtils.js'

const field = 'w-full border border-gray-200 rounded-xl px-3.5 py-3 text-[15px] outline-none focus:border-brand-purple bg-white'

function Row({ icon: Icon, children }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon size={18} className="text-gray-400 mt-0.5 shrink-0" />
      <div className="text-[15px] min-w-0 flex-1">{children}</div>
    </div>
  )
}

// Everything about one lesson.
export function LessonDetailSheet({ lesson, canEdit, onEdit, onMessage, onClose }) {
  const c = colorFor(lesson.subject)
  const mins = lessonMinutes(lesson)
  return (
    <BottomSheet onClose={onClose}>
      <div className="px-3">
        <div className={`rounded-2xl p-4 ${c.soft} flex items-stretch gap-3`}>
          <span className={`w-1.5 rounded-full ${c.bar}`} />
          <div className="min-w-0">
            <p className={`text-xs font-semibold uppercase tracking-wide ${c.text}`}>{lesson.day_of_week}</p>
            <p className="text-xl font-bold leading-tight truncate">{lesson.subject}</p>
            <p className="text-sm text-gray-600 mt-0.5">{hhmm(lesson.start_time)}–{hhmm(lesson.end_time)}{mins ? ` · ${durationText(mins)}` : ''}</p>
          </div>
        </div>
        <div className="mt-2 divide-y divide-gray-50">
          {lesson.class_name ? <Row icon={Clock}>Class {lesson.class_name}</Row> : null}
          {lesson.teacher_name ? (
            <Row icon={User}>
              <div className="flex items-center gap-2">
                <span className="flex-1 min-w-0 truncate">{lesson.teacher_name}</span>
                {lesson.teacher_id && onMessage ? <button onClick={onMessage} className="flex items-center gap-1.5 text-sm font-semibold text-brand-purple bg-brand-light rounded-full px-3 py-1.5"><MessageCircle size={14} /> Message</button> : null}
              </div>
            </Row>
          ) : null}
          {lesson.room ? <Row icon={MapPin}>{lesson.room}</Row> : null}
          {lesson.note ? <Row icon={StickyNote}><span className="text-gray-600 whitespace-pre-wrap">{lesson.note}</span></Row> : null}
        </div>
        {canEdit ? <button onClick={onEdit} className="w-full mt-3 flex items-center justify-center gap-2 bg-brand-purple text-white font-semibold py-3.5 rounded-full"><Pencil size={16} /> Edit lesson</button> : null}
      </div>
    </BottomSheet>
  )
}

// Add a lesson (on several days at once) or change one.
export function LessonEditorSheet({ lesson, defaultDay, defaultClass, entries, schoolId, user, profile, staff, subjects, classes, onClose, onSaved, onDeleted }) {
  const editing = !!lesson
  const [subject, setSubject] = useState(lesson?.subject || '')
  const [className, setClassName] = useState(lesson?.class_name || defaultClass || '')
  const [days, setDays] = useState([lesson?.day_of_week || defaultDay || 'Monday'])
  const [start, setStart] = useState(lesson ? hhmm(lesson.start_time) : '')
  const [end, setEnd] = useState(lesson ? hhmm(lesson.end_time) : '')
  const [room, setRoom] = useState(lesson?.room || '')
  const [teacher, setTeacher] = useState(lesson?.teacher_name || '')
  const [note, setNote] = useState(lesson?.note || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const s = toMinutes(start)
  const e = toMinutes(end)
  const timesOk = s != null && e != null && e > s
  const teacherMatch = (staff || []).find((p) => (p.full_name || '').trim().toLowerCase() === teacher.trim().toLowerCase())
  const canSave = !busy && subject.trim() && className.trim() && timesOk && days.length > 0

  const conflicts = useMemo(() => {
    if (!timesOk) return []
    const out = []
    days.forEach((d) => {
      findConflicts(entries, { day_of_week: d, start_time: start, end_time: end, class_name: className, teacher_id: teacherMatch?.id || null, teacher_name: teacher }, lesson?.id).forEach((c) => out.push({ day: d, c }))
    })
    return out
  }, [entries, days, start, end, className, teacher, teacherMatch, lesson, timesOk])

  function toggleDay(d) {
    if (editing) { setDays([d]); return }
    setDays((prev) => (prev.includes(d) ? (prev.length > 1 ? prev.filter((x) => x !== d) : prev) : [...prev, d]))
  }

  function setLength(min) {
    if (s == null) return
    const t = s + min
    if (t < 24 * 60) setEnd(hhmm(t))
  }

  async function save() {
    if (!canSave) return
    setBusy(true)
    setError('')
    const base = {
      subject: subject.trim(),
      class_name: className.trim(),
      start_time: hhmm(start),
      end_time: hhmm(end),
      room: room.trim() || null,
      teacher_name: teacher.trim() || null,
      teacher_id: teacherMatch?.id || null,
      note: note.trim() || null,
      updated_at: new Date().toISOString(),
    }
    let err = null
    if (editing) {
      const { error: ue } = await supabase.from('timetable_entries').update({ ...base, day_of_week: days[0] }).eq('id', lesson.id)
      err = ue
    } else {
      const rows = days.map((d) => ({ ...base, day_of_week: d, school_id: schoolId, created_by: user.id }))
      const { error: ie } = await supabase.from('timetable_entries').insert(rows)
      err = ie
    }
    setBusy(false)
    if (err) { setError(err.message); return }
    onSaved({ count: days.length, editing })
  }

  async function remove() {
    setBusy(true)
    const { error: de } = await supabase.from('timetable_entries').delete().eq('id', lesson.id)
    setBusy(false)
    if (de) { setError(de.message); setConfirmDelete(false); return }
    onDeleted(lesson.id)
  }

  if (confirmDelete) {
    return <ConfirmSheet title="Delete this lesson?" body={`${lesson.subject} on ${lesson.day_of_week} at ${hhmm(lesson.start_time)} will be removed for everyone.`} confirmLabel="Delete" danger busy={busy} onConfirm={remove} onClose={() => setConfirmDelete(false)} />
  }

  return (
    <BottomSheet onClose={onClose}>
      <div className="px-3 overflow-y-auto" style={{ maxHeight: '78vh' }}>
        <p className="font-semibold text-lg">{editing ? 'Edit lesson' : 'Add a lesson'}</p>

        <label className="text-sm font-semibold block mt-4">Subject</label>
        <input value={subject} onChange={(ev) => setSubject(ev.target.value)} list="sl-tt-subjects" placeholder="e.g. Mathematics, Break" className={`${field} mt-1.5`} />
        <datalist id="sl-tt-subjects">{(subjects || []).map((x) => <option key={x} value={x} />)}</datalist>

        <label className="text-sm font-semibold block mt-4">Class</label>
        <input value={className} onChange={(ev) => setClassName(ev.target.value)} placeholder="e.g. 3A" className={`${field} mt-1.5`} />
        {classes?.length ? (
          <div className="flex gap-2 overflow-x-auto mt-2" style={{ scrollbarWidth: 'none' }}>
            {classes.map((c) => <button key={c} onClick={() => setClassName(c)} className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${className === c ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-600'}`}>{c}</button>)}
          </div>
        ) : null}

        <label className="text-sm font-semibold block mt-4">{editing ? 'Day' : 'Days'}</label>
        <div className="flex flex-wrap gap-2 mt-1.5">
          {DAYS.map((d) => <button key={d} onClick={() => toggleDay(d)} className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${days.includes(d) ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-600'}`}>{SHORT_DAY[d]}</button>)}
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div>
            <label className="text-sm font-semibold">Starts</label>
            <input type="time" value={start} onChange={(ev) => setStart(ev.target.value)} className={`${field} mt-1.5`} />
          </div>
          <div>
            <label className="text-sm font-semibold">Ends</label>
            <input type="time" value={end} onChange={(ev) => setEnd(ev.target.value)} className={`${field} mt-1.5`} />
          </div>
        </div>
        {s != null ? (
          <div className="flex gap-2 mt-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {DURATIONS.map((m) => <button key={m} onClick={() => setLength(m)} className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${e != null && e - s === m ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-600'}`}>{m} min</button>)}
          </div>
        ) : null}
        {s != null && e != null && e <= s ? <p className="text-xs text-red-500 mt-2">The end time must be after the start time.</p> : null}

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div>
            <label className="text-sm font-semibold">Room</label>
            <input value={room} onChange={(ev) => setRoom(ev.target.value)} placeholder="Optional" className={`${field} mt-1.5`} />
          </div>
          <div>
            <label className="text-sm font-semibold">Teacher</label>
            <input value={teacher} onChange={(ev) => setTeacher(ev.target.value)} list="sl-tt-staff" placeholder="Optional" className={`${field} mt-1.5`} />
            <datalist id="sl-tt-staff">{(staff || []).map((p) => <option key={p.id} value={p.full_name} />)}</datalist>
          </div>
        </div>
        {profile && !teacher ? <button onClick={() => setTeacher(profile.full_name || '')} className="mt-2 text-xs font-semibold text-brand-purple">I teach this</button> : null}

        <input value={note} onChange={(ev) => setNote(ev.target.value)} maxLength={200} placeholder="Note, like “bring your calculator” (optional)" className={`${field} mt-4`} />

        {conflicts.length > 0 ? (
          <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3">
            <p className="text-sm font-semibold text-amber-800 flex items-center gap-1.5"><AlertTriangle size={16} /> This clashes with another lesson</p>
            {conflicts.slice(0, 4).map(({ day, c }) => <p key={`${day}-${c.id}`} className="text-xs text-amber-700 mt-1">{SHORT_DAY[day]} · {c.subject}{c.class_name ? ` (${c.class_name})` : ''} {hhmm(c.start_time)}–{hhmm(c.end_time)}</p>)}
            {conflicts.length > 4 ? <p className="text-xs text-amber-700 mt-1">and {conflicts.length - 4} more</p> : null}
            <p className="text-xs text-amber-700/80 mt-1.5">You can still save it.</p>
          </div>
        ) : null}

        {error ? <p className="text-sm text-red-500 mt-3 flex items-start gap-1.5"><AlertCircle size={15} className="shrink-0 mt-0.5" /> {error}</p> : null}

        <button onClick={save} disabled={!canSave} className="w-full mt-5 bg-brand-purple text-white font-semibold py-3.5 rounded-full disabled:opacity-40 flex items-center justify-center">
          {busy ? <Loader2 size={18} className="animate-spin" /> : editing ? 'Save changes' : days.length > 1 ? `Add to ${days.length} days` : 'Add lesson'}
        </button>
        {editing ? <button onClick={() => setConfirmDelete(true)} disabled={busy} className="w-full mt-1 py-3.5 text-red-500 font-medium flex items-center justify-center gap-2"><Trash2 size={17} /> Delete this lesson</button> : null}
      </div>
    </BottomSheet>
  )
}

// Repeat one day's lessons on other days.
export function CopyDaySheet({ from, count, label, onClose, onCopy }) {
  const [picked, setPicked] = useState([])
  const [busy, setBusy] = useState(false)
  async function go() {
    setBusy(true)
    await onCopy(picked)
    setBusy(false)
  }
  return (
    <BottomSheet onClose={onClose}>
      <div className="px-3">
        <p className="font-semibold text-lg">Copy {from}</p>
        <p className="text-sm text-gray-500 mt-1">{count} lesson{count === 1 ? '' : 's'} {label ? `for ${label} ` : ''}will be added to the days you choose. Lessons that are already there are skipped.</p>
        <div className="flex flex-wrap gap-2 mt-4">
          {DAYS.filter((d) => d !== from).map((d) => (
            <button key={d} onClick={() => setPicked((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))} className={`rounded-full px-4 py-2 text-sm font-medium ${picked.includes(d) ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-600'}`}>{d}</button>
          ))}
        </div>
        <button onClick={go} disabled={!picked.length || busy || !count} className="w-full mt-5 bg-brand-purple text-white font-semibold py-3.5 rounded-full disabled:opacity-40 flex items-center justify-center gap-2">
          {busy ? <Loader2 size={18} className="animate-spin" /> : <><Copy size={16} /> {picked.length ? `Copy to ${picked.length} day${picked.length > 1 ? 's' : ''}` : 'Choose days'}</>}
        </button>
      </div>
    </BottomSheet>
  )
}
