import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Mail, Check, Mail as MailIcon } from 'lucide-react'
import { supabase } from '../lib/supabaseClient.js'
import { AuthPage, AuthField, PrimaryButton, Notice, EMAIL_RE } from '../components/AuthKit.jsx'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState(location.state?.email || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [touched, setTouched] = useState(false)

  const clean = email.trim()
  const emailOk = EMAIL_RE.test(clean)

  async function handleSubmit(e) {
    e.preventDefault()
    setTouched(true)
    if (!emailOk) return
    setBusy(true)
    setError('')
    const redirectTo = window.location.href.split('#')[0] + '#/reset-password'
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(clean, { redirectTo })
    setBusy(false)
    if (resetError) {
      setError(resetError.message)
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <AuthPage title="Check your email" back={false}>
        <div className="flex flex-col items-start">
          <span className="w-14 h-14 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center">
            <Check size={26} />
          </span>
          <p className="mt-5 text-[15px] leading-relaxed text-gray-600">
            We sent a reset link to <span className="font-semibold text-brand-navy">{clean}</span>. Open it on this device to choose a new password.
          </p>
          <p className="mt-3 text-sm text-gray-400">Nothing in your inbox? Check your spam folder.</p>
        </div>
        <div className="mt-8 space-y-3">
          <PrimaryButton type="button" onClick={() => navigate('/', { replace: true })}>Back to log in</PrimaryButton>
          <button type="button" onClick={() => setSent(false)} className="w-full h-12 text-sm font-semibold text-brand-purple">
            Use a different email
          </button>
        </div>
      </AuthPage>
    )
  }

  return (
    <AuthPage
      title="Reset your password"
      subtitle="Enter the email you signed up with and we'll send you a link to choose a new password."
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <AuthField
          id="reset-email"
          label="Email address"
          icon={Mail}
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={touched && !emailOk ? 'Enter a valid email address, for example name@example.com.' : null}
        />

        {error ? <Notice tone="error">{error}</Notice> : null}

        <PrimaryButton type="submit" busy={busy} busyLabel="Sending…">
          <MailIcon size={18} /> Send reset link
        </PrimaryButton>
      </form>
    </AuthPage>
  )
        }
