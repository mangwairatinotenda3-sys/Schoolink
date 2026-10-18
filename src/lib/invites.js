import { supabase } from './supabaseClient.js'

// What a link or code is for, without signing in. Shows the school before anyone commits.
export async function previewInvite(code) {
  const clean = String(code || '').trim()
  if (clean.length < 4) return { ok: false, error: 'Enter the full code.' }
  const { data, error } = await supabase.rpc('invite_preview', { p_code: clean })
  if (error || !data) return { ok: false, error: 'Could not check this invite. Check your connection and try again.' }
  return data
}

// Joins the school. The server decides the role and whether an admin must approve.
export async function redeemInvite(code, saveProfileDetails) {
  const { data, error } = await supabase.rpc('redeem_invite', { p_code: String(code || '').trim() })
  if (error || !data) return { ok: false, error: 'Could not join. Check your connection and try again.' }
  if (!data.ok) return data
  // Pull the fresh school details into the app's own copy of the profile
  if (saveProfileDetails) {
    const res = await saveProfileDetails({ school_id: data.school_id, role: data.role, account_type: 'school_member', status: data.status })
    if (res?.error) data.reload = true
  }
  return data
}
