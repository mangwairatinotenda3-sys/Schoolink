import { isStaffMember } from './permissions.js'

export const STATUS_MAX_LENGTH = 280
export const STATUS_MAX_VIDEO_SECONDS = 90
export const STATUS_MAX_ITEMS = 10

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
  { key: 'gold', label: 'Gold', css: 'linear-gradient(160deg, #F59E0B, #B45309)' },
  { key: 'teal', label: 'Teal', css: 'linear-gradient(160deg, #14B8A6, #0F766E)' },
  { key: 'grape', label: 'Grape', css: 'linear-gradient(160deg, #A855F7, #6D28D9)' },
  { key: 'ink', label: 'Ink', css: 'linear-gradient(160deg, #111827, #000000)' },
]

export const STATUS_FONTS = [
  { key: 'classic', label: 'Classic', css: { fontFamily: 'inherit', fontWeight: 700 } },
  { key: 'serif', label: 'Serif', css: { fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 700 } },
  { key: 'marker', label: 'Handwritten', css: { fontFamily: '"Segoe Print", "Bradley Hand", "Comic Sans MS", cursive', fontWeight: 600 } },
  { key: 'mono', label: 'Typewriter', css: { fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontWeight: 600 } },
]

export const STATUS_REACTIONS = ['❤️', '😂', '😮', '😢', '🙏', '👏', '🔥']

export function backgroundFor(key) {
  return (STATUS_BACKGROUNDS.find((b) => b.key === key) || STATUS_BACKGROUNDS[0]).css
}

export function fontFor(key) {
  return (STATUS_FONTS.find((f) => f.key === key) || STATUS_FONTS[0]).css
}

export function audienceLabel(key) {
  return (STATUS_AUDIENCES.find((a) => a.key === key) || STATUS_AUDIENCES[0]).label
}

// A status can be a photo, a video or plain text. Older ones only have image_url.
export function mediaOf(status) {
  const url = status?.media_url || status?.image_url || null
  const type = status?.media_type || (status?.image_url ? 'image' : null)
  return { url, type }
}

export function statusKind(status) {
  const { url, type } = mediaOf(status)
  if (!url) return 'text'
  return type === 'video' ? 'video' : 'image'
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

// "Today, 3:45 PM" / "Yesterday, 11:20 PM"
export function formatStatusTime(dateString) {
  const d = new Date(dateString)
  const now = new Date()
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const sameDay = d.toDateString() === now.toDateString()
  const y = new Date(now)
  y.setDate(now.getDate() - 1)
  return `${sameDay ? 'Today' : d.toDateString() === y.toDateString() ? 'Yesterday' : d.toLocaleDateString([], { day: 'numeric', month: 'short' })}, ${time}`
}

// How long a text status stays on screen: longer text gets more time to read.
export function readingMs(text) {
  const length = (text || '').length
  return Math.min(12000, Math.max(5000, 3500 + length * 45))
  }
