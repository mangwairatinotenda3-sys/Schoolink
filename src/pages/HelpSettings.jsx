import { useState } from 'react'
import { Mail, HelpCircle } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

const faqs = [
  { q: 'How do I join my school?', a: 'Ask your Headteacher, Deputy, or Bursar for an invite code, or use the student join code — enter it from the account type screen after signing up.' },
  { q: "Why can't I post?", a: 'Only school staff members who have joined a school can post. Guests, parents, and investors can browse, like, comment, and follow.' },
  { q: 'How do I become Headteacher?', a: 'The first person to create a school automatically becomes its Headteacher.' },
]

export default function HelpSettings() {
  const { user } = useAuth()
  const [message, setMessage] = useState('')
  const [contactEmail, setContactEmail] = useState(user?.email || '')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!message.trim()) return
    setSending(true)
    setError('')
    const { error: insertError } = await supabase.from('app_feedback').insert({
      user_id: user.id,
      message,
      contact_email: contactEmail || null,
    })
    setSending(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    setMessage('')
    setSent(true)
    setTimeout(() => setSent(false), 3000)
  }

  return (
    <div className="app-shell">
      <BackHeader title="Help and Feedback" />
      <div className="screen-scroll px-6 pt-4">
        <p className="font-semibold text-sm mb-2">Send Feedback</p>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tell us what's working, what's not, or what you'd like to see…"
          rows={5}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-brand-purple resize-none"
        />
        <input
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          placeholder="Your email (optional, so we can reply)"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-brand-purple mt-2"
        />
        {error ? <p className="text-red-500 text-sm mt-2">{error}</p> : null}
        {sent ? <p className="text-green-600 text-sm mt-2">Thanks — your feedback was sent!</p> : null}
        <button
          onClick={handleSubmit}
          disabled={sending}
          className="w-full bg-brand-purple text-white font-medium py-3 rounded-xl mt-3 disabled:opacity-60"
        >
          {sending ? 'Sending…' : 'Send Feedback'}
        </button>

        <div className="h-px bg-gray-100 my-6" />

        <p className="font-semibold text-sm mb-3">Common Questions</p>
        <div className="space-y-4">
          {faqs.map((f) => (
            <div key={f.q} className="flex gap-3">
              <HelpCircle size={16} className="text-brand-purple shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">{f.q}</p>
                <p className="text-xs text-gray-500 mt-1">{f.a}</p>
              </div>
            </div>
          ))}
        </div>

        <a
          href="mailto:support@schoolink.app"
          className="w-full mt-6 mb-6 flex items-center justify-center gap-2 border border-gray-200 rounded-xl py-3 text-sm font-medium"
        >
          <Mail size={16} /> Email Us Directly
        </a>
      </div>
    </div>
  )
}
