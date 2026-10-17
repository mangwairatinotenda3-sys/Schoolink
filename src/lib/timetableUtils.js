// Shared rules for the timetable.

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export const SHORT_DAY = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun' }
export const WEEKDAYS = DAYS.slice(0, 5)
export const DURATIONS = [30, 40, 45, 60, 90]
export const EDITOR_ROLES = ['Teacher / Tutor', 'Headteacher', 'Deputy Head']
export const ADMIN_ROLES = ['Headteacher', 'Deputy Head']
export const MANAGER_ROLES = ['Headteacher', 'Deputy Head', 'Teacher / Tutor', 'Receptionist']

const pad = (n) => String(n).padStart(2, '0')

export function todayName(date = new Date()) {
  return DAYS[(date.getDay() + 6) % 7]
}

// "08:00", "08:00:00" and "8:00" all become 480
export function toMinutes(t) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t ?? '').trim())
  if (!m) return null
  const h = Number(m[1])
  const mi = Number(m[2])
  if (h > 23 || mi > 59) return null
  return h * 60 + mi
}

export function hhmm(t) {
  const m = typeof t === 'number' ? t : toMinutes(t)
  if (m == null) return ''
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
}

export function durationText(minutes) {
  if (minutes == null || minutes <= 0) return ''
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (!h) return `${m} min`
  return m ? `${h} h ${m} min` : `${h} h`
}

export function lessonMinutes(l) {
  const a = toMinutes(l.start_time)
  const b = toMinutes(l.end_time)
  return a != null && b != null ? b - a : null
}

export function sortLessons(list) {
  return [...list].sort((a, b) => (toMinutes(a.start_time) ?? 0) - (toMinutes(b.start_time) ?? 0) || (toMinutes(a.end_time) ?? 0) - (toMinutes(b.end_time) ?? 0) || (a.class_name || '').localeCompare(b.class_name || ''))
}

// Every subject always gets the same colour, so a week reads at a glance.
const PALETTE = [
  { bar: 'bg-violet-500', soft: 'bg-violet-50', text: 'text-violet-700', hex: '#8B5CF6' },
  { bar: 'bg-blue-500', soft: 'bg-blue-50', text: 'text-blue-700', hex: '#3B82F6' },
  { bar: 'bg-emerald-500', soft: 'bg-emerald-50', text: 'text-emerald-700', hex: '#10B981' },
  { bar: 'bg-amber-500', soft: 'bg-amber-50', text: 'text-amber-700', hex: '#F59E0B' },
  { bar: 'bg-rose-500', soft: 'bg-rose-50', text: 'text-rose-700', hex: '#F43F5E' },
  { bar: 'bg-cyan-500', soft: 'bg-cyan-50', text: 'text-cyan-700', hex: '#06B6D4' },
  { bar: 'bg-fuchsia-500', soft: 'bg-fuchsia-50', text: 'text-fuchsia-700', hex: '#D946EF' },
  { bar: 'bg-lime-500', soft: 'bg-lime-50', text: 'text-lime-700', hex: '#84CC16' },
  { bar: 'bg-orange-500', soft: 'bg-orange-50', text: 'text-orange-700', hex: '#F97316' },
  { bar: 'bg-teal-500', soft: 'bg-teal-50', text: 'text-teal-700', hex: '#14B8A6' },
]

export function colorFor(subject) {
  const s = String(subject || '').trim().toLowerCase()
  let h = 0
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

export function isFreeLesson(l) {
  return /^(break|lunch|tea|recess|assembly|registration|free|study)\b/i.test(String(l.subject || '').trim())
}

export function overlaps(a, b) {
  const a1 = toMinutes(a.start_time)
  const a2 = toMinutes(a.end_time)
  const b1 = toMinutes(b.start_time)
  const b2 = toMinutes(b.end_time)
  if ([a1, a2, b1, b2].some((x) => x == null)) return false
  return a1 < b2 && b1 < a2
}

const norm = (s) => String(s || '').trim().toLowerCase()

// Two lessons clash when they overlap and share a class or a teacher.
export function findConflicts(entries, candidate, ignoreId) {
  return entries.filter((e) => {
    if (ignoreId && e.id === ignoreId) return false
    if (e.day_of_week !== candidate.day_of_week) return false
    if (!overlaps(e, candidate)) return false
    const sameClass = norm(e.class_name) && norm(e.class_name) === norm(candidate.class_name)
    const sameTeacher = (candidate.teacher_id && e.teacher_id === candidate.teacher_id) || (norm(e.teacher_name) && norm(e.teacher_name) === norm(candidate.teacher_name))
    return sameClass || sameTeacher
  })
}

export function isMine(entry, profile) {
  if (!profile) return false
  if (entry.teacher_id && entry.teacher_id === profile.id) return true
  return !!norm(entry.teacher_name) && norm(entry.teacher_name) === norm(profile.full_name)
}

export function classesOf(entries) {
  return [...new Set(entries.map((e) => (e.class_name || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
}

// Monday to Sunday of the week that contains `now`, as a { Monday: Date, ... } map.
export function weekDates(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  const out = {}
  DAYS.forEach((d, i) => {
    const x = new Date(start)
    x.setDate(start.getDate() + i)
    out[d] = x
  })
  return out
}

export function minutesNow(now = new Date()) {
  return now.getHours() * 60 + now.getMinutes()
}

// Today's lessons marked as done, now or coming up, with the free gaps in between.
export function dayPlan(lessons, now, isToday) {
  const list = sortLessons(lessons)
  const nowMin = minutesNow(now)
  const items = []
  let nextMarked = false
  let lastEnd = null
  for (const l of list) {
    const s = toMinutes(l.start_time)
    const e = toMinutes(l.end_time)
    if (lastEnd != null && s != null && s - lastEnd >= 15) items.push({ type: 'gap', minutes: s - lastEnd, from: lastEnd, to: s, key: `gap-${lastEnd}-${s}` })
    let status = 'later'
    if (isToday && s != null && e != null) {
      if (nowMin >= e) status = 'done'
      else if (nowMin >= s) status = 'now'
      else if (!nextMarked) { status = 'next'; nextMarked = true }
    }
    items.push({ type: 'lesson', lesson: l, status, key: l.id })
    if (e != null) lastEnd = lastEnd == null ? e : Math.max(lastEnd, e)
  }
  return items
}

// The lesson in progress, or the next one: today first, then the following days.
export function nextUp(entries, now = new Date()) {
  const todayIdx = (now.getDay() + 6) % 7
  const nowMin = minutesNow(now)
  for (let add = 0; add < 7; add += 1) {
    const day = DAYS[(todayIdx + add) % 7]
    const list = sortLessons(entries.filter((e) => e.day_of_week === day && !isFreeLesson(e)))
    for (const l of list) {
      const s = toMinutes(l.start_time)
      const e = toMinutes(l.end_time)
      if (s == null || e == null) continue
      if (add === 0) {
        if (nowMin >= e) continue
        if (nowMin >= s) return { lesson: l, state: 'now', minutes: e - nowMin, progress: Math.min(1, (nowMin - s) / Math.max(1, e - s)), day, daysAhead: 0 }
        return { lesson: l, state: 'next', minutes: s - nowMin, progress: 0, day, daysAhead: 0 }
      }
      return { lesson: l, state: 'later', minutes: null, progress: 0, day, daysAhead: add }
    }
  }
  return null
}

export function minutesText(m) {
  if (m == null) return ''
  if (m < 1) return 'less than a minute'
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h} h ${r} min` : `${h} h`
}

export function dayShareText({ day, label, lessons }) {
  const lines = [`${day}${label ? ` — ${label}` : ''}`]
  sortLessons(lessons).forEach((l) => {
    lines.push(`${hhmm(l.start_time)}–${hhmm(l.end_time)}  ${l.subject}${l.room ? ` (${l.room})` : ''}${l.teacher_name ? ` · ${l.teacher_name}` : ''}`)
  })
  if (lines.length === 1) lines.push('No lessons.')
  return lines.join('\n')
  }
