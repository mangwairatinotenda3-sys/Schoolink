import { supabase } from './supabaseClient.js'

// Shared rules and helpers for the official school chat.

// These roles always answer school chats. Other staff can be made School Chat Managers by them.
export const CHAT_LEADER_ROLES = ['Headteacher', 'Deputy Head']

// Can answer and refer the school's chats.
export function canManageSchoolChat(profile) {
  if (!profile?.school_id || profile.status !== 'active' || profile.role === 'Student') return false
  return !!profile.is_school_chat_manager || CHAT_LEADER_ROLES.includes(profile.role)
}

// Can choose the School Chat Managers.
export function canSetSchoolChatManagers(profile) {
  return !!profile?.school_id && profile.status === 'active' && CHAT_LEADER_ROLES.includes(profile.role)
}

export function displayName(person) {
  return person?.full_name || 'Member'
}

// "Form 2A · Adm 1042" for learners, the role for everyone else.
export function learnerDetail(person) {
  if (!person) return ''
  if (person.role !== 'Student') return person.role || ''
  return [person.class_name, person.admission_no ? `Adm ${person.admission_no}` : ''].filter(Boolean).join(' · ')
}

// Time for a list row: "10:24", "Tue", or "3 Nov".
export function shortTime(value) {
  if (!value) return ''
  const d = new Date(value)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const days = (now - d) / 86400000
  if (days < 7) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' })
}

// Loads names and roles for a set of user ids. Returns { id: profile }.
export async function fetchPeople(ids) {
  const unique = [...new Set((ids || []).filter(Boolean))]
  if (!unique.length) return {}
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, role, class_name, admission_no, status')
    .in('id', unique)
  return Object.fromEntries((data ?? []).map((p) => [p.id, p]))
}
