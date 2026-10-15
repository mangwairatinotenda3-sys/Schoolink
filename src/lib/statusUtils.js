import { supabase } from './supabaseClient.js'
import { canViewStatus } from './statusUtils.js'

// Loads everything the status row and the viewer need in one go:
// my own updates, the people who have updates for me to see (unseen first), and which ones I have seen.
export async function loadStatusFeed(user, profile) {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data } = await supabase
    .from('statuses')
    .select('*')
    .gt('created_at', cutoff)
    .order('created_at', { ascending: true })

  const visible = (data ?? []).filter((s) => canViewStatus(s, profile, user.id))
  const mine = visible.filter((s) => s.user_id === user.id)
  const others = visible.filter((s) => s.user_id !== user.id)

  let seen = new Set()
  if (others.length) {
    const { data: views } = await supabase
      .from('status_views')
      .select('status_id')
      .eq('viewer_id', user.id)
      .in('status_id', others.map((s) => s.id))
    seen = new Set((views ?? []).map((v) => v.status_id))
  }

  let mutedIds = new Set()
  const { data: mutes } = await supabase.from('status_mutes').select('muted_user_id').eq('user_id', user.id)
  if (mutes) mutedIds = new Set(mutes.map((m) => m.muted_user_id))

  const byUser = new Map()
  for (const s of others) {
    const entry = byUser.get(s.user_id) || { id: s.user_id, items: [] }
    entry.items.push(s)
    byUser.set(s.user_id, entry)
  }

  let profileMap = new Map()
  if (byUser.size) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, role, school_id')
      .in('id', [...byUser.keys()])
    profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))
  }

  const people = [...byUser.values()].map((entry) => {
    const info = profileMap.get(entry.id) || {}
    const flags = entry.items.map((s) => seen.has(s.id))
    return {
      ...entry,
      full_name: info.full_name || 'Schoolink member',
      avatar_url: info.avatar_url || null,
      role: info.role || '',
      school_id: info.school_id || null,
      flags,
      allSeen: flags.every(Boolean),
      latest: entry.items[entry.items.length - 1],
      muted: mutedIds.has(entry.id),
    }
  })

  // Unseen first, then the most recent.
  people.sort((a, b) => Number(a.allSeen) - Number(b.allSeen) || (a.latest.created_at < b.latest.created_at ? 1 : -1))

  return { mine, people, seen }
    }
