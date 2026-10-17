import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, MoreVertical, Share2, Loader2, Table, Copy, Users, GraduationCap } from 'lucide-react'
import ScreenHeader from '../components/ScreenHeader.jsx'
import PersonAvatar from '../components/PersonAvatar.jsx'
import BottomSheet, { SheetAction } from '../components/BottomSheet.jsx'
import { ConfirmSheet } from '../components/FamilySheets.jsx'
import { DayTabs, DayList, NowCard, WeekGrid } from '../components/TimetableViews.jsx'
import { LessonDetailSheet, LessonEditorSheet, CopyDaySheet } from '../components/LessonSheets.jsx'
import StudentClasses from '../components/StudentClasses.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { isSchoolMember } from '../lib/permissions.js'
import { isParentAccount } from '../lib/familyUtils.js'
import {
  DAYS, WEEKDAYS, EDITOR_ROLES, MANAGER_ROLES, classesOf, dayPlan, dayShareText, hhmm, isMine, nextUp, todayName, weekDates,
} from '../lib/timetableUtils.js'

const norm = (s) => String(s || '').trim().toLowerCase()

function Chip({ active, onClick, children }) {
  return <button onClick={onClick} className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ${active ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-600'}`}>{children}</button>
}

export default function Timetable() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()

  const member = isSchoolMember(profile)
  const isEditor = member && EDITOR_ROLES.includes(profile?.role)
  const isManager = member && MANAGER_ROLES.includes(profile?.role)
  const isStudent = member && profile?.role === 'Student'
  const isParent = !member && isParentAccount(profile)

  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState([])
  const [children, setChildren] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [myClass, setMyClass] = useState(profile?.class_name || '')
  const [filter, setFilter] = useState(null)
  const [view, setView] = useState('day')
  const [day, setDay] = useState(todayName())
  const [now, setNow] = useState(new Date())
  const [sheet, setSheet] = useState(null)
  const [classesOpen, setClassesOpen] = useState(false)
  const [staff, setStaff] = useState([])
  const [pickClass, setPickClass] = useState(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  const touch = useRef(null)
  const channelName = useRef(`timetable-${Math.random().toString(36).slice(2)}`)

  const activeChild = children.find((c) => c.id === activeId) || null
  const schoolId = member ? profile?.school_id : activeChild?.school_id

  useEffect(() => { setMyClass(profile?.class_name || '') }, [profile?.class_name])

  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(''), 2600)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  // ---------- Loading ----------
  async function loadEntries(sid) {
    if (!sid) { setEntries([]); return }
    const { data } = await supabase.from('timetable_entries').select('*').eq('school_id', sid).order('start_time', { ascending: true })
    setEntries(data ?? [])
  }

  useEffect(() => {
    if (!user || !profile) return
    let cancelled = false
    let hasKids = false
    ;(async () => {
      if (isParent) {
        const { data: ids } = await supabase.rpc('my_children')
        const list = Array.isArray(ids) ? ids.map((x) => (typeof x === 'string' ? x : Object.values(x)[0])) : []
        hasKids = list.length > 0
        if (list.length) {
          const { data: kids } = await supabase.from('profiles').select('id, full_name, avatar_url, school_id, class_name').in('id', list)
          if (cancelled) return
          const ordered = list.map((id) => (kids ?? []).find((k) => k.id === id)).filter(Boolean)
          setChildren(ordered)
          const wanted = new URLSearchParams(window.location.hash.split('?')[1] || '').get('child')
          const pick = ordered.find((k) => k.id === wanted) || ordered[0]
          setActiveId(pick?.id || null)
          if (pick?.class_name) setFilter(pick.class_name)
        }
      }
      if (!cancelled && !hasKids && !member) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [user?.id, profile?.id, profile?.role, profile?.account_type])

  useEffect(() => {
    if (!schoolId) return undefined
    let timer = null
    loadEntries(schoolId).then(() => setLoading(false))
    const ch = supabase
      .channel(channelName.current)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'timetable_entries', filter: `school_id=eq.${schoolId}` }, () => {
        clearTimeout(timer)
        timer = setTimeout(() => loadEntries(schoolId), 300)
      })
      .subscribe()
    return () => { clearTimeout(timer); supabase.removeChannel(ch) }
  }, [schoolId])

  async function loadStaff() {
    if (staff.length || !schoolId) return
    const { data } = await supabase.from('profiles').select('id, full_name, role').eq('school_id', schoolId).neq('role', 'Student').order('full_name')
    setStaff(data ?? [])
  }

  // ---------- What is on screen ----------
  const classes = useMemo(() => classesOf(entries), [entries])
  const ownClass = isStudent ? myClass : isParent ? activeChild?.class_name || '' : ''

  const chips = useMemo(() => {
    const out = []
    if (isStudent || isParent) {
      if (ownClass) out.push({ key: ownClass, label: isParent ? `${(activeChild?.full_name || 'Child').split(' ')[0]} · ${ownClass}` : `My class · ${ownClass}` })
      if (!isParent || !ownClass) classes.filter((c) => norm(c) !== norm(ownClass)).forEach((c) => out.push({ key: c, label: `Class ${c}` }))
    } else {
      if (isEditor && entries.some((e) => isMine(e, profile))) out.push({ key: '__mine', label: 'My lessons' })
      out.push({ key: '__all', label: 'All classes' })
      classes.forEach((c) => out.push({ key: c, label: `Class ${c}` }))
    }
    return out
  }, [isStudent, isParent, isEditor, ownClass, classes, entries, activeChild, profile])

  useEffect(() => {
    if (!chips.length) return
    if (!filter || !chips.some((c) => c.key === filter)) setFilter(chips[0].key)
  }, [chips])

  const scoped = useMemo(() => {
    if (!filter) return []
    if (filter === '__all') return entries
    if (filter === '__mine') return entries.filter((e) => isMine(e, profile))
    return entries.filter((e) => norm(e.class_name) === norm(filter))
  }, [entries, filter, profile])
  const showClass = filter === '__all' || filter === '__mine'

  const days = useMemo(() => DAYS.filter((d) => WEEKDAYS.includes(d) || entries.some((e) => e.day_of_week === d)), [entries])
  useEffect(() => { if (!days.includes(day)) setDay(days[0]) }, [days])

  const today = todayName(now)
  const dates = useMemo(() => weekDates(now), [now.toDateString()])
  const counts = useMemo(() => {
    const out = {}
    scoped.forEach((e) => { out[e.day_of_week] = (out[e.day_of_week] || 0) + 1 })
    return out
  }, [scoped])
  const byDay = useMemo(() => {
    const out = {}
    scoped.forEach((e) => { (out[e.day_of_week] = out[e.day_of_week] || []).push(e) })
    return out
  }, [scoped])

  const dayLessons = byDay[day] || []
  const plan = useMemo(() => dayPlan(dayLessons, now, day === today), [dayLessons, now, day, today])
  const up = useMemo(() => (day === today && view === 'day' && filter !== '__all' ? nextUp(scoped, now) : null), [scoped, now, day, today, view, filter])
  const scopeLabel = filter === '__all' ? 'all classes' : filter === '__mine' ? 'my lessons' : filter ? `class ${filter}` : ''

  // ---------- Actions ----------
  function openLesson(l) { setSheet({ type: 'detail', lesson: l }) }

  function openAdd() {
    loadStaff()
    setSheet({ type: 'edit', lesson: null })
  }

  function openEdit(l) {
    loadStaff()
    setSheet({ type: 'edit', lesson: l })
  }

  function share() {
    const text = dayShareText({ day, label: scopeLabel ? scopeLabel.replace(/^class /, 'Class ') : '', lessons: dayLessons })
    if (navigator.share) navigator.share({ title: `Timetable — ${day}`, text }).catch(() => {})
    else navigator.clipboard?.writeText(text).then(() => setToast('Copied to share')).catch(() => setToast('Could not copy'))
  }

  async function copyDay(targets) {
    const rows = []
    targets.forEach((t) => {
      dayLessons.forEach((l) => {
        const exists = entries.some((e) => e.day_of_week === t && norm(e.class_name) === norm(l.class_name) && hhmm(e.start_time) === hhmm(l.start_time) && norm(e.subject) === norm(l.subject))
        if (!exists) rows.push({ school_id: schoolId, created_by: user.id, subject: l.subject, class_name: l.class_name, day_of_week: t, start_time: hhmm(l.start_time), end_time: hhmm(l.end_time), room: l.room || null, teacher_name: l.teacher_name || null, teacher_id: l.teacher_id || null, note: l.note || null })
      })
    })
    if (!rows.length) { setSheet(null); setToast('Nothing new to copy'); return }
    const { error } = await supabase.from('timetable_entries').insert(rows)
    if (error) { setToast(error.message); return }
    setSheet(null)
    setToast(`Copied ${rows.length} lesson${rows.length > 1 ? 's' : ''}`)
    loadEntries(schoolId)
  }

  async function chooseClass() {
    if (!pickClass || busy) return
    setBusy(true)
    const { error } = await supabase.rpc('set_my_class', { p_class: pickClass })
    setBusy(false)
    if (error) { setToast(error.message); setPickClass(null); return }
    setMyClass(pickClass)
    setFilter(pickClass)
    setPickClass(null)
    setToast(`You are in class ${pickClass}`)
  }

  function switchChild(c) {
    setActiveId(c.id)
    setFilter(c.class_name || null)
  }

  function onTouchStart(e) {
    if (e.target.closest && e.target.closest('[data-noswipe]')) { touch.current = null; return }
    const t = e.touches[0]
    touch.current = { x: t.clientX, y: t.clientY }
  }

  function onTouchEnd(e) {
    const s = touch.current
    touch.current = null
    if (!s || view !== 'day') return
    const t = e.changedTouches[0]
    const dx = t.clientX - s.x
    const dy = t.clientY - s.y
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6) {
      const next = days[days.indexOf(day) + (dx < 0 ? 1 : -1)]
      if (next) setDay(next)
    }
  }

  // ---------- Screens ----------
  if (loading) return <div className="app-shell items-center justify-center flex text-gray-400"><Loader2 className="animate-spin" /></div>

  if (!member && !isParent) {
    return (
      <div className="app-shell">
        <ScreenHeader title="Timetable" onBack={() => navigate(-1)} />
        <div className="flex-1 flex flex-col items-center justify-center text-center px-10">
          <span className="w-20 h-20 rounded-full bg-brand-light flex items-center justify-center mb-4"><Table size={34} className="text-brand-purple" /></span>
          <p className="font-semibold text-lg">Timetables are for school members</p>
          <p className="text-sm text-gray-400 mt-1">Join a school, or link your child as a parent, to see lessons here.</p>
        </div>
      </div>
    )
  }

  if (isParent && children.length === 0) {
    return (
      <div className="app-shell">
        <ScreenHeader title="Timetable" onBack={() => navigate(-1)} />
        <div className="flex-1 flex flex-col items-center justify-center text-center px-10">
          <span className="w-20 h-20 rounded-full bg-brand-light flex items-center justify-center mb-4"><Users size={34} className="text-brand-purple" /></span>
          <p className="font-semibold text-lg">No child linked yet</p>
          <p className="text-sm text-gray-400 mt-1">Link your child to see their timetable.</p>
          <button onClick={() => navigate('/family')} className="mt-5 bg-brand-purple text-white font-semibold rounded-full px-7 py-3">Add a child</button>
        </div>
      </div>
    )
  }

  const subTitle = isParent ? activeChild?.full_name : isStudent && ownClass ? `Class ${ownClass}` : scopeLabel ? scopeLabel[0].toUpperCase() + scopeLabel.slice(1) : ''
  const subjects = [...new Set(entries.map((e) => (e.subject || '').trim()).filter(Boolean))].sort()
  const needsClass = isStudent && !myClass && classes.length > 0

  return (
    <div className="app-shell relative">
      <ScreenHeader
        title="Timetable"
        sub={subTitle}
        onBack={() => navigate(-1)}
        right={(
          <>
            <button onClick={share} aria-label="Share this day" className="w-10 h-10 rounded-full flex items-center justify-center"><Share2 size={19} /></button>
            {isEditor ? <button onClick={openAdd} aria-label="Add a lesson" className="w-10 h-10 rounded-full bg-brand-purple text-white flex items-center justify-center"><Plus size={20} /></button> : null}
            {isEditor || isManager ? <button onClick={() => setSheet({ type: 'menu' })} aria-label="More" className="w-10 h-10 rounded-full flex items-center justify-center"><MoreVertical size={20} /></button> : null}
          </>
        )}
      />

      <div className="flex-1 overflow-y-auto" style={{ paddingBottom: 40 }} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {isParent && children.length > 1 ? (
          <div data-noswipe="1" className="flex gap-2 overflow-x-auto px-4 pt-3" style={{ scrollbarWidth: 'none' }}>
            {children.map((c) => (
              <button key={c.id} onClick={() => switchChild(c)} className={`shrink-0 flex items-center gap-2 rounded-full pl-1.5 pr-4 py-1.5 ${activeId === c.id ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-700'}`}>
                <PersonAvatar p={c} size={28} /><span className="text-sm font-medium">{c.full_name?.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        ) : null}

        {needsClass ? (
          <div className="mx-4 mt-3 rounded-3xl bg-brand-light p-4">
            <p className="font-semibold flex items-center gap-2"><GraduationCap size={18} className="text-brand-purple" /> Which class are you in?</p>
            <p className="text-xs text-gray-500 mt-1">Choose once. A teacher can change it later.</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {classes.map((c) => <button key={c} onClick={() => setPickClass(c)} className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-brand-purple shadow-sm">{c}</button>)}
            </div>
          </div>
        ) : null}

        {isParent && !ownClass ? <p className="mx-4 mt-3 text-sm text-amber-700 bg-amber-50 rounded-2xl px-4 py-3">{activeChild?.full_name?.split(' ')[0]}'s class is not set yet. Ask the school to set it, or browse the classes below.</p> : null}

        {chips.length > 1 ? (
          <div data-noswipe="1" className="flex gap-2 overflow-x-auto px-4 pt-3" style={{ scrollbarWidth: 'none' }}>
            {chips.map((c) => <Chip key={c.key} active={filter === c.key} onClick={() => setFilter(c.key)}>{c.label}</Chip>)}
          </div>
        ) : null}

        {entries.length === 0 ? (
          <div className="flex flex-col items-center text-center px-10 pt-16">
            <span className="w-20 h-20 rounded-full bg-brand-light flex items-center justify-center mb-4"><Table size={34} className="text-brand-purple" /></span>
            <p className="font-semibold text-lg">No timetable yet</p>
            <p className="text-sm text-gray-400 mt-1">{isEditor ? 'Add the first lesson. You can add one lesson to several days at once.' : 'Your school has not added the timetable yet.'}</p>
            {isEditor ? <button onClick={openAdd} className="mt-5 flex items-center gap-1.5 bg-brand-purple text-white text-sm font-semibold rounded-full px-6 py-2.5"><Plus size={16} /> Add a lesson</button> : null}
          </div>
        ) : (
          <>
            <div className="flex bg-gray-100 rounded-full p-1 mx-4 mt-3">
              {[['day', 'Day'], ['week', 'Week']].map(([k, label]) => (
                <button key={k} onClick={() => setView(k)} className={`flex-1 py-1.5 text-sm font-semibold rounded-full ${view === k ? 'bg-white shadow-sm text-brand-purple' : 'text-gray-500'}`}>{label}</button>
              ))}
            </div>

            {view === 'day' ? (
              <>
                <DayTabs days={days} active={day} today={today} dates={dates} counts={counts} onPick={setDay} />
                <NowCard up={up} showClass={showClass} onOpen={openLesson} />
                <DayList plan={plan} day={day} showClass={showClass} now={now} canEdit={isEditor} onOpen={openLesson} onAdd={openAdd} />
              </>
            ) : (
              <WeekGrid days={days} dates={dates} today={today} byDay={byDay} showClass={showClass} onOpen={openLesson} onPickDay={(d) => { setDay(d); setView('day') }} />
            )}
          </>
        )}
      </div>

      {toast ? <div className="absolute left-1/2 -translate-x-1/2 z-30 bg-gray-900 text-white text-sm rounded-full px-4 py-2 shadow-lg max-w-[90%] text-center" style={{ bottom: 30 }}>{toast}</div> : null}

      {sheet?.type === 'detail' ? (
        <LessonDetailSheet
          lesson={sheet.lesson}
          canEdit={isEditor && (sheet.lesson.created_by === user.id || ['Headteacher', 'Deputy Head'].includes(profile?.role))}
          onEdit={() => openEdit(sheet.lesson)}
          onMessage={sheet.lesson.teacher_id && sheet.lesson.teacher_id !== user.id ? () => navigate(`/chats/${sheet.lesson.teacher_id}`) : null}
          onClose={() => setSheet(null)}
        />
      ) : null}

      {sheet?.type === 'edit' ? (
        <LessonEditorSheet
          lesson={sheet.lesson}
          defaultDay={day}
          defaultClass={filter && !filter.startsWith('__') ? filter : ''}
          entries={entries}
          schoolId={schoolId}
          user={user}
          profile={profile}
          staff={staff}
          subjects={subjects}
          classes={classes}
          onClose={() => setSheet(null)}
          onSaved={({ count, editing }) => { setSheet(null); setToast(editing ? 'Lesson updated' : count > 1 ? `Added to ${count} days` : 'Lesson added'); loadEntries(schoolId) }}
          onDeleted={(id) => { setEntries((prev) => prev.filter((e) => e.id !== id)); setSheet(null); setToast('Lesson deleted') }}
        />
      ) : null}

      {sheet?.type === 'copy' ? (
        <CopyDaySheet from={day} count={dayLessons.length} label={scopeLabel} onClose={() => setSheet(null)} onCopy={copyDay} />
      ) : null}

      {sheet?.type === 'menu' ? (
        <BottomSheet onClose={() => setSheet(null)}>
          {isEditor ? <SheetAction icon={Plus} label="Add a lesson" onClick={openAdd} /> : null}
          {isEditor ? <SheetAction icon={Copy} label={`Copy ${day} to other days`} sub={dayLessons.length ? `${dayLessons.length} lesson${dayLessons.length > 1 ? 's' : ''}` : 'No lessons on this day'} onClick={() => (dayLessons.length ? setSheet({ type: 'copy' }) : setToast('This day has no lessons to copy'))} /> : null}
          {isManager ? <SheetAction icon={GraduationCap} label="Student classes" sub="Put students in their class" onClick={() => { setSheet(null); setClassesOpen(true) }} /> : null}
        </BottomSheet>
      ) : null}

      {pickClass ? (
        <ConfirmSheet title={`Set your class to ${pickClass}?`} body="You can only choose this once. Ask a teacher if it needs to change." confirmLabel="Yes, that is my class" busy={busy} onConfirm={chooseClass} onClose={() => setPickClass(null)} />
      ) : null}

      {classesOpen ? <StudentClasses schoolId={schoolId} classes={classes} onClose={() => setClassesOpen(false)} /> : null}
    </div>
  )
            }
