import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, MoreVertical, Award, Table, Users, Loader2, Clock, Trash2, UserMinus, XCircle, Hourglass } from 'lucide-react'
import ScreenHeader from './ScreenHeader.jsx'
import PersonAvatar from './PersonAvatar.jsx'
import BottomSheet, { SheetAction } from './BottomSheet.jsx'
import { AddChildSheet, ConfirmSheet } from './FamilySheets.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { agoText } from '../lib/familyUtils.js'
import { averageOf, gradeFor, listTerms, termKey, termLabel, tone, normaliseScale } from '../lib/resultsUtils.js'
import { colorFor, hhmm, nextUp, minutesText, SHORT_DAY } from '../lib/timetableUtils.js'

function Stat({ label, value, toneClass }) {
  return (
    <div className="flex-1 rounded-2xl bg-gray-50 px-3 py-2.5 text-center">
      <p className={`text-xl font-bold leading-tight ${toneClass || ''}`}>{value}</p>
      <p className="text-[11px] text-gray-400 mt-0.5">{label}</p>
    </div>
  )
}

// One child: how they are doing, what is next, and the shortcuts.
export function ChildCard({ child, school, results, lessons, onOpen, onMenu, now }) {
  const scale = normaliseScale(school?.grading_scale)
  const terms = listTerms(results)
  const latest = terms[0] || null
  const rows = latest ? results.filter((r) => termKey(r) === latest) : []
  const avg = averageOf(rows)
  const grade = gradeFor(avg, scale)
  const subjects = new Set(rows.map((r) => (r.subject || '').trim().toLowerCase())).size
  const t = tone(avg)
  const up = child.class_name ? nextUp(lessons, now) : null
  const c = up ? colorFor(up.lesson.subject) : null

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden mb-4">
      <div className="flex items-center gap-3 px-4 pt-4">
        <PersonAvatar p={child} size={56} />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-lg leading-tight truncate">{child.full_name}</p>
          <p className="text-sm text-gray-400 truncate">{[child.class_name ? `Class ${child.class_name}` : 'Class not set', school?.name].filter(Boolean).join(' · ')}</p>
        </div>
        <button onClick={onMenu} aria-label={`Options for ${child.full_name}`} className="w-10 h-10 -mr-2 rounded-full flex items-center justify-center text-gray-400 active:bg-gray-100"><MoreVertical size={20} /></button>
      </div>

      <div className="px-4 mt-4">
        {rows.length ? (
          <>
            <div className="flex gap-2">
              <Stat label="Average" value={avg != null ? `${Math.round(avg)}%` : '—'} toneClass={t.text} />
              <Stat label="Grade" value={grade?.grade || '—'} toneClass={t.text} />
              <Stat label="Subjects" value={subjects} />
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5 text-center">{termLabel(latest)}</p>
          </>
        ) : (
          <p className="text-sm text-gray-400 bg-gray-50 rounded-2xl px-4 py-3 text-center">No results published yet.</p>
        )}
      </div>

      {up ? (
        <button onClick={() => onOpen('timetable')} className={`mx-4 mt-3 w-[calc(100%-32px)] flex items-center gap-3 rounded-2xl px-3.5 py-3 text-left ${c.soft}`}>
          <span className={`w-1.5 self-stretch rounded-full ${c.bar}`} />
          <span className="min-w-0 flex-1">
            <span className={`block text-[11px] font-semibold uppercase tracking-wide ${c.text}`}>
              {up.state === 'now' ? `Now · ends in ${minutesText(up.minutes)}` : up.state === 'next' ? `Next · in ${minutesText(up.minutes)}` : up.daysAhead === 1 ? 'Tomorrow' : SHORT_DAY[up.day] || up.day}
            </span>
            <span className="block font-semibold text-[15px] truncate">{up.lesson.subject}</span>
            <span className="block text-xs text-gray-500 truncate">{[`${hhmm(up.lesson.start_time)}–${hhmm(up.lesson.end_time)}`, up.lesson.room, up.lesson.teacher_name].filter(Boolean).join(' · ')}</span>
          </span>
          <Clock size={18} className={c.text} />
        </button>
      ) : null}

      <div className="flex gap-3 px-4 py-4">
        <button onClick={() => onOpen('results')} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-full bg-brand-purple text-white font-semibold text-sm"><Award size={16} /> Report card</button>
        <button onClick={() => onOpen('timetable')} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-full bg-gray-100 font-semibold text-sm"><Table size={16} /> Timetable</button>
      </div>
    </div>
  )
}

// What a parent sees: their children and the requests they have made.
export default function FamilyParent({ user, navigate, onBack }) {
  const [loading, setLoading] = useState(true)
  const [children, setChildren] = useState([])
  const [links, setLinks] = useState([])
  const [schools, setSchools] = useState(new Map())
  const [results, setResults] = useState([])
  const [lessons, setLessons] = useState([])
  const [requests, setRequests] = useState([])
  const [reqSchools, setReqSchools] = useState(new Map())
  const [adding, setAdding] = useState(false)
  const [menuFor, setMenuFor] = useState(null)
  const [removing, setRemoving] = useState(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  const [now, setNow] = useState(new Date())
  const channelName = useRef(`family-parent-${Math.random().toString(36).slice(2)}`)

  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(''), 2600)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  async function load() {
    const [l, r] = await Promise.all([
      supabase.from('family_links').select('*').eq('parent_id', user.id).order('created_at', { ascending: true }),
      supabase.from('family_requests').select('*').eq('parent_id', user.id).order('created_at', { ascending: false }),
    ])
    const lk = l.data ?? []
    setLinks(lk)
    const reqs = r.data ?? []
    setRequests(reqs)

    const ids = lk.map((x) => x.student_id)
    if (ids.length) {
      const { data: kids } = await supabase.from('profiles').select('id, full_name, avatar_url, school_id, class_name').in('id', ids)
      const ordered = ids.map((id) => (kids ?? []).find((k) => k.id === id)).filter(Boolean)
      setChildren(ordered)
      const schoolIds = [...new Set(ordered.map((k) => k.school_id).filter(Boolean))]
      const [sc, res, tt] = await Promise.all([
        schoolIds.length ? supabase.from('schools').select('id, name, logo_url, grading_scale').in('id', schoolIds) : { data: [] },
        supabase.from('exam_results').select('id, student_id, subject, term, year, score, max_score, published').in('student_id', ids),
        schoolIds.length ? supabase.from('timetable_entries').select('*').in('school_id', schoolIds) : { data: [] },
      ])
      setSchools(new Map((sc.data ?? []).map((s) => [String(s.id), s])))
      setResults((res.data ?? []).filter((x) => x.published !== false))
      setLessons(tt.data ?? [])
    } else {
      setChildren([])
    }

    const reqSchoolIds = [...new Set(reqs.map((x) => x.school_id).filter(Boolean))]
    if (reqSchoolIds.length) {
      const { data } = await supabase.from('schools').select('id, name').in('id', reqSchoolIds)
      setReqSchools(new Map((data ?? []).map((s) => [String(s.id), s])))
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
    const ch = supabase
      .channel(channelName.current)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'family_links', filter: `parent_id=eq.${user.id}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'family_requests', filter: `parent_id=eq.${user.id}` }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [user.id])

  const perChild = useMemo(() => children.map((c) => ({
    child: c,
    school: schools.get(String(c.school_id)),
    results: results.filter((r) => r.student_id === c.id),
    lessons: lessons.filter((x) => String(x.school_id) === String(c.school_id) && (x.class_name || '').trim().toLowerCase() === (c.class_name || '').trim().toLowerCase()),
  })), [children, schools, results, lessons])

  function open(child, where) {
    navigate(`${where === 'timetable' ? '/timetable' : '/exam-results'}?child=${child.id}`)
  }

  async function removeLink() {
    const link = links.find((l) => l.student_id === removing?.id)
    if (!link) { setRemoving(null); return }
    setBusy(true)
    const { error } = await supabase.from('family_links').delete().eq('id', link.id)
    setBusy(false)
    if (error) { setToast(error.message); return }
    setChildren((prev) => prev.filter((c) => c.id !== removing.id))
    setLinks((prev) => prev.filter((l) => l.id !== link.id))
    setRemoving(null)
    setToast('Child removed')
  }

  async function dismissRequest(req) {
    const { error } = await supabase.from('family_requests').delete().eq('id', req.id)
    if (error) { setToast(error.message); return }
    setRequests((prev) => prev.filter((x) => x.id !== req.id))
  }

  const empty = !loading && children.length === 0 && requests.length === 0

  return (
    <div className="app-shell relative">
      <ScreenHeader title="My Children" onBack={onBack} right={<button onClick={() => setAdding(true)} aria-label="Add a child" className="w-10 h-10 rounded-full bg-brand-purple text-white flex items-center justify-center"><Plus size={20} /></button>} />

      <div className="flex-1 overflow-y-auto px-4 pt-4" style={{ paddingBottom: 40 }}>
        {loading ? <p className="text-center text-gray-400 mt-16"><Loader2 className="animate-spin inline" /></p> : null}

        {empty ? (
          <div className="flex flex-col items-center text-center px-6 pt-20">
            <span className="w-20 h-20 rounded-full bg-brand-light flex items-center justify-center mb-4"><Users size={34} className="text-brand-purple" /></span>
            <p className="font-semibold text-lg">Follow your child's school life</p>
            <p className="text-sm text-gray-400 mt-1">See their report cards and timetable. Link with a code from your child, or ask the school.</p>
            <button onClick={() => setAdding(true)} className="mt-5 bg-brand-purple text-white font-semibold rounded-full px-7 py-3">Add a child</button>
          </div>
        ) : null}

        {perChild.map((p) => (
          <ChildCard key={p.child.id} {...p} now={now} onOpen={(where) => open(p.child, where)} onMenu={() => setMenuFor(p.child)} />
        ))}

        {requests.length > 0 ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mt-2 mb-1">Requests to the school</p>
            {requests.map((r) => (
              <div key={r.id} className="flex items-center gap-3 py-3 border-b border-gray-50">
                <span className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${r.status === 'declined' ? 'bg-red-50' : r.status === 'approved' ? 'bg-green-50' : 'bg-amber-50'}`}>
                  {r.status === 'declined' ? <XCircle size={20} className="text-red-500" /> : <Hourglass size={20} className={r.status === 'approved' ? 'text-green-600' : 'text-amber-600'} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[15px] truncate">{r.child_name}</p>
                  <p className="text-xs text-gray-400 truncate">{reqSchools.get(String(r.school_id))?.name || 'School'} · {r.status === 'pending' ? `waiting · sent ${agoText(r.created_at)}` : r.status === 'approved' ? 'approved' : 'declined — contact the school'}</p>
                </div>
                <button onClick={() => dismissRequest(r)} aria-label={r.status === 'pending' ? 'Cancel request' : 'Remove'} className="w-10 h-10 rounded-full flex items-center justify-center text-gray-400 active:bg-gray-100"><Trash2 size={18} /></button>
              </div>
            ))}
          </>
        ) : null}
      </div>

      {toast ? <div className="absolute left-1/2 -translate-x-1/2 z-30 bg-gray-900 text-white text-sm rounded-full px-4 py-2 shadow-lg max-w-[90%] text-center" style={{ bottom: 30 }}>{toast}</div> : null}

      {adding ? <AddChildSheet onClose={() => setAdding(false)} onLinked={load} onRequested={load} /> : null}

      {menuFor ? (
        <BottomSheet onClose={() => setMenuFor(null)}>
          <SheetAction icon={Award} label="Report card" onClick={() => { const c = menuFor; setMenuFor(null); open(c, 'results') }} />
          <SheetAction icon={Table} label="Timetable" onClick={() => { const c = menuFor; setMenuFor(null); open(c, 'timetable') }} />
          <SheetAction icon={UserMinus} label="Remove this child" sub="You can link again later" danger onClick={() => { setRemoving(menuFor); setMenuFor(null) }} />
        </BottomSheet>
      ) : null}

      {removing ? (
        <ConfirmSheet title={`Remove ${removing.full_name}?`} body="You will stop seeing their report card and timetable." confirmLabel="Remove" danger busy={busy} onConfirm={removeLink} onClose={() => setRemoving(null)} />
      ) : null}
    </div>
  )
}
