import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function SendProposal() {
  const { schoolId } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function handleSend() {
    if (!message.trim()) return
    setSending(true)
    setError('')
    const { error: insertError } = await supabase.from('investor_proposals').insert({
      school_id: schoolId, investor_id: user.id, investor_name: profile?.full_name || user.email, message,
    })
    setSending(false)
    if (insertError) { setError(insertError.message); return }
    setSent(true)
  }

  if (sent) {
    return (
      <div className="app-shell">
        <BackHeader title="Proposal Sent" />
        <div className="screen-scroll px-6 flex flex-col items-center justify-center text-center gap-3">
          <p className="font-semibold">Proposal sent!</p>
          <p className="text-gray-500 text-sm">The school's leadership will review it and may reach out via chat.</p>
          <button onClick={() => navigate(-1)} className="text-brand-purple font-medium">Go back</button>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <BackHeader title="Send Investment Proposal" />
      <div className="screen-scroll px-6 pt-4">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Introduce yourself and describe your proposal…"
          rows={8}
          className="w-full border border-gray-200 rounded-xl p-4 outline-brand-purple resize-none"
        />
        {error ? <p className="text-red-500 text-sm mt-2">{error}</p> : null}
        <button onClick={handleSend} disabled={sending} className="mt-4 w-full bg-brand-purple text-white font-medium py-3.5 rounded-xl disabled:opacity-60">
          {sending ? 'Sending…' : 'Send Proposal'}
        </button>
      </div>
    </div>
  )
}
