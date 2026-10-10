import { useEffect, useState } from 'react'
import { Mail, MessageCircle, Copy, Trash2, X } from 'lucide-react'
import ControllerShell, { ctl } from '../components/ControllerShell.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { INVITE_ROLES, ROLE_LABELS, inviteLink, inviteMessage, timeAgo } from '../lib/team.js'

const field = { background: '#0F1526', border: `1px solid ${ctl.border}`, color: ctl.text }

export default function ControllerTeam() {
  const [members, setMembers] = useState([])
  const [invites, setInvites] = useState([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('verifier')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [lastInvite, setLastInvite] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: m }, { data: i }] = await Promise.all([
      supabase.rpc('list_team'),
      supabase.rpc('list_team_invites'),
    ])
    setMembers(m ?? [])
    setInvites(i ?? [])
  }

  async function sendInvite() {
    setError('')
    setLastInvite(null)
    if (!email.trim()) { setError('Enter the email address of the person.'); return }
    setBusy(true)
    const { error: err } = await supabase.rpc('invite_team_member', { p_email: email.trim(), p_role: role })
    setBusy(false)
    if (err) { setError(err.message); return }
    setLastInvite({ email: email.trim().toLowerCase(), role })
    setEmail('')
    load()
  }

  async function cancelInvite(id) {
    await supabase.rpc('revoke_team_invite', { p_invite_id: id })
    load()
  }

  async function changeRole(userId, newRole) {
    setError('')
    const { error: err } = await supabase.rpc('set_team_role', { p_user_id: userId, p_role: newRole })
    if (err) setError(err.message)
    load()
  }

  async function removeMember(m) {
    if (!window.confirm(`Remove ${m.full_name || m.email} from the team? They go back to being a normal user.`)) return
    setError('')
    const { error: err } = await supabase.rpc('remove_team_member', { p_user_id: m.user_id })
    if (err) setError(err.message)
    load()
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteMessage(lastInvite.email, lastInvite.role))
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {}
  }

  const msg = lastInvite ? inviteMessage(lastInvite.email, lastInvite.role) : ''

  return (
    <ControllerShell title="Team Members" allow={['owner']}>
      <div className="rounded-2xl p-4" style={{ background: ctl.card, border: `1px solid ${ctl.border}` }}>
        <p className="text-sm font-medium mb-3">Invite someone</p>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="Their email address"
          className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
          style={field}
        />
        <div className="grid grid-cols-3 gap-2 mt-2">
          {INVITE_ROLES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRole(r.key)}
              className="rounded-xl py-2 text-xs font-medium"
              style={role === r.key ? { background: ctl.accent, color: '#fff' } : { ...field, color: ctl.muted }}
            >
              {r.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] mt-2" style={{ color: ctl.muted }}>{INVITE_ROLES.find((r) => r.key === role)?.hint}</p>
        {error ? <p className="text-xs mt-2" style={{ color: ctl.bad }}>{error}</p> : null}
        <button
          onClick={sendInvite}
          disabled={busy}
          className="w-full mt-3 rounded-xl py-2.5 text-sm font-medium disabled:opacity-60"
          style={{ background: ctl.accent, color: '#fff' }}
        >
          {busy ? 'Sending…' : 'Send invite'}
        </button>

        {lastInvite ? (
          <div className="mt-4 rounded-xl p-3" style={{ background: '#0F1526', border: `1px solid ${ctl.border}` }}>
            <p className="text-xs mb-2" style={{ color: ctl.good }}>
              Invite created. If they already have an account they'll see it the next time they open Schoolink. You can also send them the link:
            </p>
            <div className="flex gap-2">
              <a href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium" style={{ background: '#16A34A', color: '#fff' }}>
                <MessageCircle size={14} /> WhatsApp
              </a>
              <a href={`mailto:${lastInvite.email}?subject=${encodeURIComponent('Join the Schoolink team')}&body=${encodeURIComponent(msg)}`} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium" style={{ background: ctl.accent, color: '#fff' }}>
                <Mail size={14} /> Email
              </a>
              <button onClick={copyInvite} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium" style={field}>
                <Copy size={14} /> {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="text-[10px] mt-2 break-all" style={{ color: ctl.muted }}>{inviteLink()}</p>
          </div>
        ) : null}
      </div>

      {invites.length > 0 ? (
        <div className="mt-5">
          <p className="text-xs uppercase mb-2" style={{ color: ctl.muted }}>Waiting for an answer</p>
          <div className="space-y-2">
            {invites.map((i) => (
              <div key={i.id} className="flex items-center gap-3 rounded-xl p-3" style={{ background: ctl.card, border: `1px solid ${ctl.border}` }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{i.email}</p>
                  <p className="text-[11px]" style={{ color: ctl.muted }}>{ROLE_LABELS[i.role]} · {timeAgo(i.created_at)}</p>
                </div>
                <button onClick={() => cancelInvite(i.id)} title="Cancel invite"><X size={16} style={{ color: ctl.muted }} /></button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-5">
        <p className="text-xs uppercase mb-2" style={{ color: ctl.muted }}>On the team ({members.length})</p>
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.user_id} className="rounded-xl p-3" style={{ background: ctl.card, border: `1px solid ${ctl.border}` }}>
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{m.full_name || m.email}</p>
                  <p className="text-[11px] truncate" style={{ color: ctl.muted }}>{m.email}</p>
                </div>
                {m.role === 'owner' ? (
                  <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: ctl.accent, color: '#fff' }}>Owner</span>
                ) : (
                  <>
                    <select
                      value={m.role}
                      onChange={(e) => changeRole(m.user_id, e.target.value)}
                      className="rounded-lg px-2 py-1 text-xs outline-none"
                      style={field}
                    >
                      {INVITE_ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                    </select>
                    <button onClick={() => removeMember(m)} title="Remove from team"><Trash2 size={16} style={{ color: ctl.bad }} /></button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </ControllerShell>
  )
               }
