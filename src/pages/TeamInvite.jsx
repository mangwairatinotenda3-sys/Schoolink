import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { ROLE_LABELS } from '../lib/team.js'

// Where an invited person lands from the WhatsApp / email link or from the
// notification. Accepting makes them part of the team; rejecting changes nothing.
export default function TeamInvite() {
  const { refreshTeamRole } = useAuth()
  const [invites, setInvites] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.rpc('my_pending_team_invites')
    setInvites(data ?? [])
    setLoading(false)
  }

  async function respond(id, accept) {
    setBusyId(id)
    setError('')
    const { error: err } = await supabase.rpc('respond_team_invite', { p_invite_id: id, p_accept: accept })
    setBusyId(null)
    if (err) { setError(err.message); return }
    if (accept) await refreshTeamRole() // the app then moves you to the Control Center
    else load()
  }

  return (
    <div className="app-shell">
      <BackHeader title="Team Invite" />
      <div className="screen-scroll px-6 pt-6">
        {loading ? (
          <p className="text-center text-gray-400">Loading…</p>
        ) : invites.length === 0 ? (
          <p className="text-center text-gray-400 mt-10">You don't have any pending invites.</p>
        ) : (
          invites.map((inv) => (
            <div key={inv.id} className="border border-gray-100 rounded-2xl p-5 text-center">
              <span className="w-14 h-14 rounded-full bg-brand-light mx-auto flex items-center justify-center">
                <ShieldCheck size={26} className="text-brand-purple" />
              </span>
              <p className="font-semibold mt-3">You have been invited to join the team</p>
              <p className="text-sm text-gray-500 mt-1">Role: {ROLE_LABELS[inv.role] || inv.role}</p>
              <p className="text-xs text-gray-400 mt-3">
                If you accept, you'll move to the team's Control Center and stop appearing as a normal user.
              </p>
              {error ? <p className="text-red-500 text-sm mt-3">{error}</p> : null}
              <div className="flex gap-2 mt-4">
                <button disabled={busyId === inv.id} onClick={() => respond(inv.id, false)} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium disabled:opacity-60">Reject</button>
                <button disabled={busyId === inv.id} onClick={() => respond(inv.id, true)} className="flex-1 bg-brand-purple text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-60">Accept</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
  }
