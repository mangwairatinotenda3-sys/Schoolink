import { useState } from 'react'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabaseClient.js'

const MIN = 20
const MAX = 1000

// The box where a banned person explains why the ban should be lifted.
// With `withEmail` it is for someone who cannot sign in, so it also asks for their email.
export default function AppealForm({ withEmail = false, onSent }) {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const len = message.trim().length
  const ready = len >= MIN && len <= MAX && (!withEmail || /\S+@\S+\.\S+/.test(email.trim())) && !busy

  async function send() {
    if (!ready) return
    setBusy(true)
    setError('')
    const { data, error: err } = withEmail
      ? await supabase.rpc('submit_public_appeal', { p_email: email.trim(), p_message: message.trim() })
      : await supabase.rpc('submit_appeal', { p_message: message.trim() })
    setBusy(false)
    if (err || !data?.ok) { setError(err?.message || data?.error || 'Could not send your appeal. Try again.'); return }
    setDone(true)
    onSent?.()
  }

  if (done) {
    return (
      <div className="rounded-2xl bg-emerald-50 p-5 text-center">
        <CheckCircle2 size={34} className="text-emerald-600 mx-auto" />
        <p className="font-semibold text-emerald-800 mt-2">Appeal sent</p>
        <p className="text-sm text-emerald-700 mt-1 leading-snug">
          {withEmail ? 'If this email belongs to a banned account, the team now has your appeal. Try signing in again later to see if it was approved.' : 'The team will look at it. This screen updates when there is a decision.'}
        </p>
      </div>
    )
  }

  return (
    <div>
      {withEmail ? (
        <>
          <label className="block text-sm font-medium mb-1.5">Your sign-in email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" className="w-full bg-gray-100 rounded-xl px-4 py-3 text-[15px] outline-none mb-4" />
        </>
      ) : null}
      <label className="block text-sm font-medium mb-1.5">Why should this ban be lifted?</label>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value.slice(0, MAX))}
        rows={5}
        placeholder="Tell us what happened, and what you will do differently."
        className="w-full bg-gray-100 rounded-xl px-4 py-3 text-[15px] outline-none resize-none"
      />
      <div className="flex justify-between text-[11px] text-gray-400 mt-1">
        <span>{len < MIN ? `At least ${MIN} characters` : ' '}</span>
        <span>{len}/{MAX}</span>
      </div>
      {error ? <p className="text-sm text-red-500 mt-2">{error}</p> : null}
      <button onClick={send} disabled={!ready} className="w-full mt-4 bg-brand-purple text-white font-semibold py-3.5 rounded-full disabled:opacity-40 flex items-center justify-center">
        {busy ? <Loader2 size={18} className="animate-spin" /> : 'Send appeal'}
      </button>
    </div>
  )
                                    }
