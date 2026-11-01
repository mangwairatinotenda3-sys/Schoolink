import { supabase } from './supabaseClient.js'

// Loads members and their profiles in two steps, so one failing link cannot empty the list
export async function loadCommunityMembers(communityId) {
  const { data: rows, error } = await supabase
    .from('community_members')
    .select('user_id, role')
    .eq('community_id', communityId)
  if (error) return { rows: [], error }

  const ids = (rows ?? []).map((r) => r.user_id)
  if (!ids.length) return { rows: [], error: null }

  const { data: people, error: pErr } = await supabase
    .from('profiles')
    .select('id, full_name, role, avatar_url')
    .in('id', ids)
  if (pErr) return { rows: [], error: pErr }

  const byId = new Map((people ?? []).map((p) => [p.id, p]))
  return {
    rows: rows.map((r) => ({ user_id: r.user_id, role: r.role, profiles: byId.get(r.user_id) ?? null })),
    error: null,
  }
    }
