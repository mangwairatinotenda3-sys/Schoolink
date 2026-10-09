import { isStaffMember } from './permissions.js'

export const STATUS_MAX_LENGTH = 280

export const STATUS_AUDIENCES = [
  { key: 'public', label: 'Everyone', hint: 'Anyone on Schoolink can see this.' },
  { key: 'school_only', label: 'My school', hint: 'Only members of your school can see this.' },
  { key: 'staff_only', label: 'Staff only', hint: 'Only staff at your school can see this.' },
]

// The first swatch follows the site theme colour the user picked in settings.
export const STATUS_BACKGROUNDS = [
  { key: 'theme', label: 'Theme', css: 'linear-gradient(160deg, var(--brand-purple), #241B4E)' },
  { key: 'sunset', label: 'Sunset', css: 'linear-gradient(160deg, #F97316, #DB2777)' },
  { key: 'ocean', label: 'Ocean', css: 'linear-gradient(160deg, #0EA5E9, #1D4ED8)' },
  { key: 'forest', label: 'Forest', css: 'linear-gradient(160deg, #16A34A, #065F46)' },
  { key: 'rose', label: 'Rose', css: 'linear-gradient(160deg, #F43F5E, #9F1239)' },
  { key: 'night', label: 'Night', css: 'linear-gradient(160deg, #334155, #0F172A)' },
]

export function backgroundFor(key) {
  return (STATUS_BACKGROUNDS.find((b) => b.key === key) || STATUS_BACKGROUNDS[0]).css
}

export function audienceLabel(key) {
  return (STATUS_AUDIENCES.find((a) => a.key === key) || STATUS_AUDIENCES[0]).label
}

// One rule used by both the status row and the viewer.
// Older statuses with no audience saved are treated as public.
export function canViewStatus(status, profile, userId) {
  if (!status) return false
  if (userId && status.user_id === userId) return true
  const audience = status.audience || 'public'
  if (audience === 'public') return true
  const sameSchool = !!profile?.school_id && profile.school_id === status.school_id
  if (audience === 'school_only') return sameSchool
  if (audience === 'staff_only') return sameSchool && isStaffMember(profile)
  return false
}

export function timeAgo(dateString) {
  const s = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
  if (s < 60) return 'Just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return `${h}h ago`
}

export function timeLeft(dateString) {
  const ms = new Date(dateString).getTime() + 24 * 3600 * 1000 - Date.now()
  if (ms <= 0) return 'Expired'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`
  }
