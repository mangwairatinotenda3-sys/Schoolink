// Shared rules for homework and assignments.
import { supabase } from './supabaseClient.js'
import { colorFor } from './timetableUtils.js'

export { colorFor }
export const EDITOR_ROLES = ['Teacher / Tutor', 'Headteacher', 'Deputy Head']
export const ADMIN_ROLES = ['Headteacher', 'Deputy Head']
export const MAX_FILE_MB = 25
export const MAX_FILES = 10

const DAY = 86400000
const pad = (n) => String(n).padStart(2, '0')

export const idOf = (x) => String(x?.id ?? x ?? '')

// ---------- Dates ----------
// An assignment's deadline. Older assignments only have a date, which means the end of that day.
export function dueOf(a) {
  const raw = a?.due_at || a?.due_date
  if (!raw) return null
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('-').map(Number)
    return new Date(y, m - 1, d, 23, 59)
  }
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const daysBetween = (from, to) => Math.round((startOfDay(to) - startOfDay(from)) / DAY)
const hasTime = (d) => !(d.getHours() === 23 && d.getMinutes() === 59)
const timeText = (d) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
const dayText = (d) => d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })

export function dueText(a, now = new Date()) {
  const due = dueOf(a)
  if (!due) return 'No due date'
  const n = daysBetween(now, due)
  const t = hasTime(due) ? `, ${timeText(due)}` : ''
  if (due < now) {
    if (n === 0) return `Was due today${t}`
    if (n === -1) return 'Was due yesterday'
    if (n > -14) return `Overdue by ${-n} days`
    return `Was due ${dayText(due)}`
  }
  if (n === 0) return `Due today${t}`
  if (n === 1) return `Due tomorrow${t}`
  if (n < 7) return `Due ${due.toLocaleDateString([], { weekday: 'long' })}${t}`
  return `Due ${dayText(due)}${t}`
}

export function dueTone(a, state, now = new Date()) {
  const due = dueOf(a)
  if (!due || state?.key === 'done' || state?.key === 'marked') return 'text-gray-400'
  if (due < now) return 'text-red-500'
  if (due - now < DAY) return 'text-amber-600'
  return 'text-gray-500'
}

export function toInputValue(d) {
  if (!d) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function presetDue(kind, now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 15, 0)
  if (kind === 'tomorrow') d.setDate(d.getDate() + 1)
  if (kind === 'three') d.setDate(d.getDate() + 3)
  if (kind === 'week') d.setDate(d.getDate() + 7)
  return toInputValue(d)
}

export function whenText(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.toLocaleDateString([], { day: 'numeric', month: 'short' })}, ${timeText(d)}`
}

// ---------- Marks ----------
export function num(n) {
  if (n == null || n === '') return ''
  const v = Math.round(Number(n) * 100) / 100
  return Number.isFinite(v) ? String(v) : ''
}

export function gradeShort(grade, points) {
  if (grade == null) return ''
  return points ? `${num(grade)}/${num(points)}` : num(grade)
}

export function percentOf(grade, points) {
  if (grade == null || !points || Number(points) <= 0) return null
  return Math.round((Number(grade) / Number(points)) * 100)
}

export function gradeTone(pct) {
  if (pct == null) return { bg: 'bg-brand-light', text: 'text-brand-purple', ring: '#7C3AED' }
  if (pct >= 75) return { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: '#10B981' }
  if (pct >= 50) return { bg: 'bg-amber-50', text: 'text-amber-700', ring: '#F59E0B' }
  return { bg: 'bg-red-50', text: 'text-red-600', ring: '#EF4444' }
}

// ---------- Where a piece of work stands ----------
export function stateOf(a, work, now = new Date()) {
  if (work?.status === 'returned') {
    const label = work.grade != null ? gradeShort(work.grade, a.points) : 'Marked'
    return { key: 'marked', label, pill: 'bg-emerald-50 text-emerald-700' }
  }
  if (work?.status === 'submitted') {
    return work.is_late
      ? { key: 'done', label: 'Handed in late', pill: 'bg-amber-50 text-amber-700' }
      : { key: 'done', label: 'Handed in', pill: 'bg-emerald-50 text-emerald-700' }
  }
  const due = dueOf(a)
  if (a.accepts_work === false) {
    if (due && due < now) return { key: 'done', label: 'Finished', pill: 'bg-gray-100 text-gray-500' }
    return { key: 'info', label: 'Homework', pill: 'bg-gray-100 text-gray-600' }
  }
  if (due && due < now) return { key: 'missing', label: 'Missing', pill: 'bg-red-50 text-red-600' }
  if (due && due - now < DAY) return { key: 'soon', label: 'Due soon', pill: 'bg-amber-50 text-amber-700' }
  if (work?.status === 'draft' && (work.body || (work.files || []).length)) return { key: 'draft', label: 'Draft saved', pill: 'bg-blue-50 text-blue-600' }
  return { key: 'todo', label: 'Assigned', pill: 'bg-brand-light text-brand-purple' }
}

export const isDoneState = (s) => s.key === 'done' || s.key === 'marked'

// Is this assignment meant for this class?
export function forClass(a, className) {
  const c = String(a?.class_name || '').trim().toLowerCase()
  return !c || c === String(className || '').trim().toLowerCase()
}

export function byDueAsc(x, y) {
  const a = dueOf(x)
  const b = dueOf(y)
  if (a && b) return a - b
  if (a) return -1
  if (b) return 1
  return new Date(y.created_at || 0) - new Date(x.created_at || 0)
}

export const byDueDesc = (x, y) => byDueAsc(y, x)

// ---------- Files ----------
export function mediaTypeFor(file) {
  const t = file?.type || ''
  if (t.startsWith('image/')) return 'image'
  if (t.startsWith('video/')) return 'video'
  return 'file'
}

export function kindOf(f) {
  const t = f?.type || f?.media_type
  if (t === 'image' || t === 'video') return t
  const name = String(f?.name || f?.file_name || f?.url || f?.file_url || '').toLowerCase().split('?')[0]
  if (/\.(png|jpe?g|gif|webp|heic|avif)$/.test(name)) return 'image'
  if (/\.(mp4|mov|webm|m4v)$/.test(name)) return 'video'
  return 'file'
}

export function sizeText(bytes) {
  const n = Number(bytes)
  if (!n) return ''
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

// Keeps files that are small enough and says which were left out
export function filterPicked(list, room) {
  const picked = []
  const skipped = []
  for (const f of list) {
    if (f.size > MAX_FILE_MB * 1024 * 1024) skipped.push(`${f.name} is bigger than ${MAX_FILE_MB} MB`)
    else if (picked.length >= room) skipped.push(`${f.name} was not added (limit ${MAX_FILES} files)`)
    else picked.push(f)
  }
  return { picked, skipped }
}

export function openFile(url, name) {
  const a = document.createElement('a')
  a.href = url
  a.download = name || ''
  a.target = '_blank'
  a.rel = 'noreferrer'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

// Uploads files one by one into the school-media bucket and returns { url, name, type, size } for each
export async function uploadAll(files, folder, onStep) {
  const out = []
  for (let i = 0; i < files.length; i += 1) {
    const file = files[i]
    if (onStep) onStep(i + 1, files.length)
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${folder}/${Date.now()}-${i}-${safe}`
    const { error } = await supabase.storage.from('school-media').upload(path, file)
    if (error) throw new Error(`Could not upload ${file.name}. Check your connection and try again.`)
    const { data } = supabase.storage.from('school-media').getPublicUrl(path)
    out.push({ url: data.publicUrl, name: file.name, type: mediaTypeFor(file), size: file.size })
  }
  return out
}

export function chunk(list, n) {
  const out = []
  for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n))
  return out
}

// ---------- Sharing ----------
export function shareText(a, now = new Date()) {
  const lines = [`${a.subject ? `${a.subject}: ` : ''}${a.title}`]
  if (a.class_name) lines.push(`Class ${a.class_name}`)
  lines.push(dueText(a, now))
  if (a.points) lines.push(`Out of ${num(a.points)}`)
  if (a.description) lines.push('', a.description)
  return lines.join('\n')
}

export function resultsText(a, rows) {
  const head = `${a.title}${a.points ? ` (out of ${num(a.points)})` : ''}`
  const lines = rows.map((r) => {
    const status = r.status === 'returned' ? 'marked' : r.status === 'submitted' ? (r.is_late ? 'handed in late' : 'handed in') : 'not handed in'
    return `${r.full_name}\t${r.grade != null ? num(r.grade) : ''}\t${status}`
  })
  return [head, ...lines].join('\n')
}

export const QUICK_COMMENTS = ['Great work!', 'Well done', 'Good effort', 'Please show your working', 'Needs more detail', 'See me after class']
