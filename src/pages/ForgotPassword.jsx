import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Mail } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState(location.state?.email || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email) return
    setBusy(true)
    setError('')

    const redirectTo = window.location.href.split('#')[0] + '#/reset-password'
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })

    setBusy(false)
    if (resetError) {
      setError(resetError.message)
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <div className="flex-1 flex flex-col">
        <BackHeader title="Check Your Email" />
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-3">
          <Mail size={40} className="text-brand-purple" />
          <p className="font-semibold">Reset link sent!</p>
          <p className="text-gray-500 text-sm">
            We've sent a password reset link to <b>{email}</b>. Open it on this device to set a new password.
          </p>
          <button onClick={() => navigate('/')} className="text-brand-purple font-medium mt-2">Back to Sign In</button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader title="Reset Password" />
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col px-6 pt-6">
        <div className="flex justify-center mb-6">
          <span className="w-16 h-16 rounded-2xl bg-brand-light flex items-center justify-center">
            <Mail className="text-brand-purple" size={28} />
          </span>
        </div>
        <h2 className="text-center font-semibold text-lg">Enter your email and we'll send you a reset link.</h2>

        <label className="text-sm font-medium mt-8 mb-2">Email Address</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@school.com"
          className="border border-gray-200 rounded-xl px-4 py-3.5 outline-brand-purple"
        />

        {error ? <p className="text-red-500 text-sm mt-3">{error}</p> : null}

        <button type="submit" disabled={busy} className="mt-8 w-full bg-brand-purple text-white font-medium py-3.5 rounded-xl disabled:opacity-60">
          {busy ? 'Sending…' : 'Send Reset Link'}
        </button>
      </form>
    </div>
  )
}
