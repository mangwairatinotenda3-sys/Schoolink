import { useEffect, useState } from 'react'
import { Mail, MessageCircle, Copy, Trash2, X, Send } from 'lucide-react'
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
  const [emailState, setEmailState] = useState(null) // { ok: boolean, text: string }
  const [resendingId, setResendingId] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: m }, { data: i }] = await Promise.all([
      supabase.rpc('list_team'),
      supabase.rpc('list_team_invites'),
    ])
    setMembers(m ?? [])
    setInvites(i ?? [])
  }

  // Asks the server to email the invite. The server checks that you are the owner
  // and that the invite exists, so nobody else can use it to send mail.
  async function emailInvite(address) {
    const { data, error: err } = await supabase.functions.invoke('send-team-invite', { body: { email: address } })
    if (err) {
      let reason = err.message
      try {
        const body = await err.context.json()
        if (body?.error) reason = body.error
      } catch {
        // keep the generic message
      }
      return { ok: false, reason }
    }
    if (data?.error) return { ok: false, reason: data.error }
    return { ok: true }
  }

  async function resendInvite(invite) {
    setError('')
    setEmailState(null)
    setResendingId(invite.id)
    const result = await emailInvite(invite.email)
    setResendingId(null)
    setEmailState(
      result.ok
        ? { ok: true, text: `Email sent again to ${invite.email}.` }
        : { ok: false, text: `The email did not go out: ${result.reason}` }
    )
  }

  async function sendInvite() {
    setError('')
    setEmailState(null)
    setLastInvite(null)
    if (!email.trim()) { setError('Enter the email address of the person.'); return }
    setBusy(true)
    const { error: err } = await supabase.rpc('invite_team_member', { p_email: email.trim(), p_role: role })
    setBusy(false)
    if (err) { setError(err.message); return }
    const address = email.trim().toLowerCase()
    setLastInvite({ email: address, role })
    setEmail('')
    load()
    setBusy(true)
    const result = await emailInvite(address)
    setBusy(false)
    setEmailState(
      result.ok
        ? { ok: true, text: `Email sent to ${address}.` }
        : { ok: false, text: `The invite is saved, but the email did not go out: ${result.reason}` }
    )
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
            <p className="text-xs mb-2" style={{ color: emailState && !emailState.ok ? ctl.bad : ctl.good }}>
              {emailState ? emailState.text : 'Invite created. Sending the email…'}
            </p>
            <p className="text-[11px] mb-2" style={{ color: ctl.muted }}>
              If they already have an account they'll also see the invite next time they open Schoolink. You can send the link yourself too:
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
          {emailState && !lastInvite ? (
            <p className="text-xs mb-2" style={{ color: emailState.ok ? ctl.good : ctl.bad }}>{emailState.text}</p>
          ) : null}
          <div className="space-y-2">
            {invites.map((i) => (
              <div key={i.id} className="flex items-center gap-3 rounded-xl p-3" style={{ background: ctl.card, border: `1px solid ${ctl.border}` }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{i.email}</p>
                  <p className="text-[11px]" style={{ color: ctl.muted }}>{ROLE_LABELS[i.role]} · {timeAgo(i.created_at)}</p>
                </div>
                <button onClick={() => resendInvite(i)} disabled={resendingId === i.id} title="Email the invite again" className="disabled:opacity-50">
                  <Send size={16} style={{ color: ctl.accent }} />
                </button>
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

// Supabase Edge Function: send-team-invite
// Emails a team invite. Only the owner can use it, and only for an invite that already exists.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ROLE_LABELS: Record<string, string> = {
  verifier: 'Verifier',
  moderator: 'Moderator',
  support: 'Support',
}

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })

    // Only the owner may send invites.
    const { data: myRole } = await supabase.rpc('team_role')
    if (myRole !== 'owner') return reply({ error: 'Only the owner can send invites.' }, 403)

    const { email } = await req.json()
    const target = String(email || '').trim().toLowerCase()
    if (!target) return reply({ error: 'No email address was given.' }, 400)

    // The invite must already exist (created by the owner).
    const { data: invites, error: listError } = await supabase.rpc('list_team_invites')
    if (listError) return reply({ error: listError.message }, 400)
    const invite = (invites ?? []).find((i: { email: string }) => String(i.email).toLowerCase() === target)
    if (!invite) return reply({ error: 'There is no waiting invite for that email.' }, 400)

    const apiKey = Deno.env.get('BREVO_API_KEY')
    const fromEmail = Deno.env.get('MAIL_FROM_EMAIL')
    if (!apiKey || !fromEmail) return reply({ error: 'Email is not set up yet (missing BREVO_API_KEY or MAIL_FROM_EMAIL).' }, 500)

    const fromName = Deno.env.get('MAIL_FROM_NAME') || 'Schoolink'
    const siteUrl = (Deno.env.get('SITE_URL') || 'https://mangwairatinotenda3-sys.github.io/Schoolink/').replace(/\/?$/, '/')
    const link = `${siteUrl}#/team/invite`
    const role = ROLE_LABELS[invite.role] || 'team member'

    const text =
      `You've been invited to join the Schoolink team as ${role}.\n\n` +
      `1. Open ${link}\n2. Sign in with ${target}\n3. Tap Accept.\n\n` +
      `If you weren't expecting this, you can ignore this email.`

    const html =
      `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#1B1450">` +
      `<h2 style="margin:0 0 12px">You're invited to the Schoolink team</h2>` +
      `<p>You've been invited to join the Schoolink team as <b>${role}</b>.</p>` +
      `<p>Sign in with <b>${target}</b>, then tap <b>Accept</b>.</p>` +
      `<p style="margin:24px 0"><a href="${link}" style="background:#6C4CE0;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:bold">Open Schoolink</a></p>` +
      `<p style="font-size:12px;color:#7A7A99">If you weren't expecting this, you can ignore this email.</p></div>`

    const sent = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: fromName, email: fromEmail },
        to: [{ email: target }],
        subject: 'You are invited to join the Schoolink team',
        htmlContent: html,
        textContent: text,
      }),
    })

    if (!sent.ok) {
      const detail = await sent.text()
      return reply({ error: `The email service said no (${sent.status}). ${detail.slice(0, 160)}` }, 502)
    }
    return reply({ ok: true })
  } catch (err) {
    return reply({ error: String((err as Error).message || err) }, 500)
  }
})
