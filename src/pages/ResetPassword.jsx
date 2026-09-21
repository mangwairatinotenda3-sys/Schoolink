import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Eye, EyeOff } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setBusy(true)
    setError('')

    const { error: updateError } = await supabase.auth.updateUser({ password })

    setBusy(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    setDone(true)
    setTimeout(() => navigate('/home'), 1500)
  }

  if (done) {
    return (
      <div className="flex-1 flex flex-col">
        <BackHeader title="Password Updated" />
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-2">
          <p className="font-semibold">Password updated!</p>
          <p className="text-gray-500 text-sm">Taking you to Schoolink…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader title="Set New Password" />
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col px-6 pt-6">
        <div className="flex justify-center mb-6">
          <span className="w-16 h-16 rounded-2xl bg-brand-light flex items-center justify-center">
            <Lock className="text-brand-purple" size={28} />
          </span>
        </div>
        <h2 className="text-center font-semibold text-lg">Choose a new password for your account.</h2>

        <label className="text-sm font-medium mt-8 mb-2">New Password</label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3.5 outline-brand-purple"
          />
          <button type="button" onClick={() => setShowPassword((s) => !s)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {error ? <p className="text-red-500 text-sm mt-3">{error}</p> : null}

        <button type="submit" disabled={busy} className="mt-8 w-full bg-brand-purple text-white font-medium py-3.5 rounded-xl disabled:opacity-60">
          {busy ? 'Updating…' : 'Update Password'}
        </button>
      </form>
    </div>
  )
}
