import { Heart, MessageCircle, UserPlus, CheckCircle, MessageSquare, AtSign, Bell } from 'lucide-react'

// How each kind of notification looks and which filter it belongs to.
export const TYPE_META = {
  like: { icon: Heart, bg: 'bg-red-500', filter: 'posts' },
  comment: { icon: MessageCircle, bg: 'bg-blue-500', filter: 'posts' },
  reply: { icon: MessageCircle, bg: 'bg-blue-500', filter: 'posts' },
  mention: { icon: AtSign, bg: 'bg-amber-500', filter: 'mentions' },
  follow: { icon: UserPlus, bg: 'bg-brand-purple', filter: 'people' },
  message: { icon: MessageSquare, bg: 'bg-sky-500', filter: 'messages' },
  approval: { icon: CheckCircle, bg: 'bg-green-500', filter: 'school' },
}
export const DEFAULT_META = { icon: Bell, bg: 'bg-gray-500', filter: 'school' }

export function metaFor(type) {
  return TYPE_META[type] || DEFAULT_META
}

export const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'posts', label: 'Posts' },
  { key: 'mentions', label: 'Mentions' },
  { key: 'people', label: 'People' },
  { key: 'messages', label: 'Messages' },
  { key: 'school', label: 'School' },
]

export function inFilter(group, filter) {
  if (filter === 'all') return true
  if (filter === 'unread') return group.unread
  return metaFor(group.type).filter === filter
}

// Several alike notifications on the same day are folded into one row:
// "Tino, Rudo and 3 others liked your post".
export function groupNotifications(rows) {
  const out = []
  const index = new Map()
  for (const n of rows) {
    const day = new Date(n.created_at).toDateString()
    let key = null
    if (['like', 'comment', 'reply', 'mention'].includes(n.type) && n.post_id) key = `${n.type}:${n.post_id}:${day}`
    else if (n.type === 'message' && n.actor_id) key = `message:${n.actor_id}:${day}`
    else if (n.type === 'follow') key = `follow:${day}`

    const existing = key ? index.get(key) : null
    if (existing) {
      existing.rows.push(n)
      if (!n.read) existing.unread = true
      if (n.actor_id && !existing.actorIds.includes(n.actor_id)) existing.actorIds.push(n.actor_id)
      if (n._fresh) existing.fresh = true
      continue
    }
    const group = {
      key: key || `n:${n.id}`,
      type: n.type,
      post_id: n.post_id || null,
      rows: [n],
      actorIds: n.actor_id ? [n.actor_id] : [],
      unread: !n.read,
      created_at: n.created_at,
      fresh: !!n._fresh,
    }
    out.push(group)
    if (key) index.set(key, group)
  }
  return out
}

// The distinct people behind a group, newest first.
export function actorsOf(group, profiles) {
  const seen = new Set()
  const list = []
  for (const row of group.rows) {
    const id = row.actor_id || `name:${row.actor_name || ''}`
    if (seen.has(id)) continue
    seen.add(id)
    const p = row.actor_id ? profiles.get(row.actor_id) : null
    const name = p?.full_name || row.actor_name || ''
    if (!name && !row.actor_id) continue
    list.push({ id: row.actor_id || null, name: name || 'Someone', avatar: p?.avatar_url || null })
  }
  return list
}

export function describe(group, actors) {
  const n = actors.length
  const names = actors.map((a) => a.name)
  const lead = n === 0 ? 'Someone' : n === 1 ? names[0] : n === 2 ? `${names[0]} and ${names[1]}` : `${names[0]}, ${names[1]} and ${n - 2} other${n - 2 > 1 ? 's' : ''}`
  const count = group.rows.length
  switch (group.type) {
    case 'like': return { lead, action: ' liked your post' }
    case 'comment': return { lead, action: n === 1 && count > 1 ? ` left ${count} comments on your post` : ' commented on your post' }
    case 'reply': return { lead, action: ' replied to your comment' }
    case 'mention': return { lead, action: group.post_id ? ' mentioned you in a post' : ' mentioned you' }
    case 'follow': return { lead, action: ' started following you' }
    case 'message': return { lead, action: count > 1 ? ` sent you ${count} messages` : ' sent you a message' }
    case 'approval': return { lead: '', action: 'Your request to join the school was approved' }
    default: return { lead: '', action: group.rows[0]?.body || group.rows[0]?.message || 'You have a new notification' }
  }
}

export function pathFor(group) {
  const first = group.rows[0]
  if (first?.link && String(first.link).startsWith('/')) return first.link
  if (group.type === 'message' && first?.actor_id) return `/chats/${first.actor_id}`
  if (['like', 'comment', 'reply', 'mention'].includes(group.type) && group.post_id) return `/post/${group.post_id}`
  if (group.type === 'follow') return group.actorIds.length === 1 ? `/users/${group.actorIds[0]}` : '/connections/followers'
  if (group.type === 'approval') return '/profile'
  return null
}

export function shortTime(dateString) {
  const s = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
  if (s < 60) return 'now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d`
  if (d < 30) return `${Math.floor(d / 7)}w`
  return new Date(dateString).toLocaleDateString([], { day: 'numeric', month: 'short' })
}

export function sectionOf(dateString) {
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((startOfDay(new Date()) - startOfDay(new Date(dateString))) / 86400000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return 'This week'
  if (days < 30) return 'This month'
  return 'Earlier'
}

export function postThumb(post) {
  if (!post) return null
  let urls = post.image_urls
  if (typeof urls === 'string') {
    try { urls = JSON.parse(urls) } catch { urls = null }
  }
  if (Array.isArray(urls) && urls.length) return urls[0]
  return post.image_url || null
}

// Tells the bell badge (and anything else listening) that notifications changed.
export function announceNotificationChange() {
  try { window.dispatchEvent(new Event('sl-notifications-changed')) } catch { /* ignore */ }
}
