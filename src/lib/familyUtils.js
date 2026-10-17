// Shared rules for linking parents and students.
import { isSchoolMember } from './permissions.js'

export const RELATIONSHIPS = ['Mother', 'Father', 'Guardian', 'Other']
export const MANAGER_ROLES = ['Headteacher', 'Deputy Head', 'Teacher / Tutor', 'Receptionist']

export const isParentAccount = (profile) => profile?.account_type === 'parent' || profile?.role === 'Parent / Guardian'
export const isStudentAccount = (profile) => isSchoolMember(profile) && profile?.role === 'Student'
export const isFamilyManager = (profile) => isSchoolMember(profile) && MANAGER_ROLES.includes(profile?.role)

// Codes are 8 letters and numbers, shown as ABCD-EFGH
export function cleanCode(raw) {
  return String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
}

export function formatCode(raw) {
  const c = cleanCode(raw)
  return c.length > 4 ? `${c.slice(0, 4)}-${c.slice(4)}` : c
}

export function timeLeft(iso) {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'Expired'
  const h = Math.floor(ms / 3600000)
  if (h < 1) return `${Math.max(1, Math.floor(ms / 60000))} min left`
  if (h < 48) return `${h} h left`
  return `${Math.floor(h / 24)} days left`
}

export function inviteText(code, studentName) {
  return `${studentName ? `${studentName} invited you` : 'You are invited'} to follow their school life on Schoolink.\n\nOpen Schoolink, go to More → My Children → Add a child, and type this code:\n${formatCode(code)}\n\nIt works once and expires in 7 days.`
}

// How alike two names are (0 to 1), used to suggest the right student for a parent's request.
export function nameScore(a, b) {
  const ta = String(a || '').toLowerCase().split(/\s+/).filter(Boolean)
  const tb = String(b || '').toLowerCase().split(/\s+/).filter(Boolean)
  if (!ta.length || !tb.length) return 0
  let hit = 0
  for (const t of ta) if (tb.some((u) => u === t || (t.length > 2 && (u.startsWith(t) || t.startsWith(u))))) hit += 1
  return hit / Math.max(ta.length, tb.length)
}

export function agoText(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d} day${d > 1 ? 's' : ''} ago`
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
}

export const REL_TEXT = { Mother: 'Mother', Father: 'Father', Guardian: 'Guardian', Other: 'Family' }
