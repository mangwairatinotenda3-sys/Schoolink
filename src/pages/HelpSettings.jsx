import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, HelpCircle, Bug, Lightbulb, UserCog, MessageCircle, CheckCircle2 } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { SwitchRow } from '../components/SettingsKit.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { getAppInfo } from '../lib/appInfo.js'
import { getLastError } from '../lib/crashReporter.js'
import { SUPPORT_EMAIL } from '../lib/legal.js'

const faqs = [
  { q: 'How do I join my school?', a: 'Ask your Headteacher, Deputy, or Bursar for an invite code, or use the student join code — enter it from the account type screen after signing up.' },
  { q: "Why can't I post?", a: 'Only school staff members who have joined a school can post. Guests, parents, and investors can browse, like, comment, and follow.' },
  { q: 'How do I become Headteacher?', a: 'The first person to create a school automatically becomes its Headteacher.' },
  { q: 'How do I delete my account?', a: 'Go to Settings → Account → Delete account. You can download a copy of your data first.' },
]

const KINDS = [
  { id: 'Problem', label: 'Problem', icon: Bug },
  { id: 'Idea', label: 'Idea', icon: Lightbulb },
  { id: 'Account', label: 'Account', icon: UserCog },
  { id: 'Other', label: 'Other', icon: MessageCircle },
]

export default function HelpSettings() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [kind, setKind] = useState('Problem')
  const [message, setMessage] = useState('')
  const [contactEmail, setContactEmail] = useState(user?.email || '')
  const [withDetails, setWithDetails] = useState(true)
  const [info, setInfo] = useState(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { getAppInfo().then(setInfo) }, [])

  async function handleSubmit() {
    if (!message.trim()) return
    setSending(true)
    setError('')
    let body = `[${kind}] ${message.trim()}`
    if (withDetails) {
      const lines = [
        `App: ${info?.native ? `${info.version} (${info.build})` : 'web'} on ${info?.platform || 'web'}`,
        `Screen: ${(window.location.hash || '').replace(/^#/, '') || '/'}`,
        `Phone: ${(navigator.userAgent || '').slice(0, 160)}`,
      ]
      const last = getLastError()
      if (last) lines.push(`Last error: ${last}`)
      body += `\n\n— Details —\n${lines.join('\n')}`
    }
    const { error: insertError } = await supabase.from('app_feedback').insert({
      user_id: user.id,
      message: body,
      contact_email: contactEmail || null,
    })
    setSending(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    setMessage('')
    setSent(true)
    setTimeout(() => setSent(false), 4000)
  }

  return (
    <div className="app-shell">
      <BackHeader title="Help and feedback" />
      <div className="screen-scroll px-5 pt-2 pb-8">
        <p className="font-semibold text-[15px] mb-2.5">What would you like to tell us?</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {KINDS.map((k) => {
            const on = kind === k.id
            const Icon = k.icon
            return (
              <button key={k.id} onClick={() => setKind(k.id)} className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-[13.5px] font-semibold ${on ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-600'}`}>
                <Icon size={15} /> {k.label}
              </button>
            )
          })}
        </div>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={kind === 'Problem' ? 'What went wrong? What were you trying to do?' : kind === 'Idea' ? 'What would make Schoolink better for you?' : 'Tell us more…'}
          rows={5}
          className="w-full border border-gray-200 rounded-2xl px-4 py-3 outline-brand-purple resize-none mt-3"
        />
        <input
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          placeholder="Your email (so we can reply)"
          inputMode="email"
          className="w-full border border-gray-200 rounded-2xl px-4 py-3 outline-brand-purple mt-2"
        />

        <div className="mt-3 rounded-2xl bg-white border border-gray-100 overflow-hidden">
          <SwitchRow id="details" label="Include technical details" sub="App version, screen and the last error. No messages or personal content." checked={withDetails} onChange={setWithDetails} />
        </div>

        {error ? <p className="text-red-500 text-sm mt-3">{error}</p> : null}
        {sent ? <p className="text-green-600 text-sm mt-3 flex items-center gap-1.5"><CheckCircle2 size={16} /> Thanks — we got it.</p> : null}
        <button
          onClick={handleSubmit}
          disabled={sending || !message.trim()}
          className="w-full bg-brand-purple text-white font-semibold py-3.5 rounded-full mt-4 disabled:opacity-40 active:opacity-80"
        >
          {sending ? 'Sending…' : 'Send'}
        </button>

        <p className="font-semibold text-[15px] mt-9 mb-3">Common questions</p>
        <div className="space-y-4">
          {faqs.map((f) => (
            <div key={f.q} className="flex gap-3">
              <HelpCircle size={16} className="text-brand-purple shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">{f.q}</p>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{f.a}</p>
              </div>
            </div>
          ))}
        </div>

        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="w-full mt-8 flex items-center justify-center gap-2 border border-gray-200 rounded-full py-3 text-sm font-semibold"
        >
          <Mail size={16} /> Email us directly
        </a>
        <div className="flex justify-center gap-5 mt-5 text-[13px] text-gray-400">
          <button onClick={() => navigate('/privacy')}>Privacy Policy</button>
          <button onClick={() => navigate('/terms')}>Terms</button>
        </div>
      </div>
    </div>
  )
   }
