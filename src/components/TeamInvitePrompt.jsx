import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { ROLE_LABELS } from '../lib/team.js'

// Pops up for a normal user who has a pending team invite. Accepting adds them
// to the team; the app then sends them straight to the Control Center.
export default function TeamInvitePrompt() {
  const { user, refreshTeamRole } = useAuth()
  const [invite, setInvite] = useState(null)
  const [hidden, setHidden] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    check()
    const onVisible = () => { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [user?.id])

  async function check() {
    const { data, error: err } = await supabase.rpc('my_pending_team_invites')
    if (err) return
    setInvite((data ?? [])[0] || null)
  }

  async function respond(accept) {
    setBusy(true)
    setError('')
    const { error: err } = await supabase.rpc('respond_team_invite', { p_invite_id: invite.id, p_accept: accept })
    setBusy(false)
    if (err) { setError(err.message); return }
    setInvite(null)
    if (accept) await refreshTeamRole()
  }

  if (!invite || hidden) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 text-center text-gray-800">
        <span className="w-14 h-14 rounded-full bg-brand-light mx-auto flex items-center justify-center">
          <ShieldCheck size={26} className="text-brand-purple" />
        </span>
        <p className="font-semibold text-lg mt-3">You have been invited to join the team</p>
        <p className="text-sm text-gray-500 mt-1">Role: {ROLE_LABELS[invite.role] || invite.role}</p>
        <p className="text-xs text-gray-400 mt-3">
          If you accept, you'll move to the team's Control Center and stop appearing as a normal user. If you reject, nothing changes.
        </p>
        {error ? <p className="text-red-500 text-sm mt-3">{error}</p> : null}
        <div className="flex gap-2 mt-5">
          <button disabled={busy} onClick={() => respond(false)} className="flex-1 border border-gray-200 rounded-xl py-3 text-sm font-medium disabled:opacity-60">Reject</button>
          <button disabled={busy} onClick={() => respond(true)} className="flex-1 bg-brand-purple text-white rounded-xl py-3 text-sm font-medium disabled:opacity-60">Accept</button>
        </div>
        <button onClick={() => setHidden(true)} className="mt-3 text-xs text-gray-400">Decide later</button>
      </div>
    </div>
  )
    }
