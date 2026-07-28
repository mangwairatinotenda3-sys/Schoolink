import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import BackHeader from '../components/BackHeader.jsx'
import { useAuth } from '../context/AuthContext.jsx'

export default function SignInPassword() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signInWithPassword, signUp } = useAuth()

  const [email] = useState(location.state?.email ?? '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSignIn(e) {
    e.preventDefault()
    setBusy(true)
    setError('')

    const { error: signInError } = await signInWithPassword(email, password)

    if (signInError) {
      const { error: signUpError } = await signUp(email, password)
      if (signUpError) {
        setError(signUpError.message)
        setBusy(false)
        return
      }
    }

    setBusy(false)
    navigate('/onboarding/account-type')
  }

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader title="" />
      <form onSubmit={handleSignIn} className="flex-1 flex flex-col px-6 pt-4">
        <h2 className="text-2xl font-bold">Welcome back!</h2>
        <p className="text-gray-500 mt-1">Enter your password to continue.</p>

        <label className="text-sm font-medium mt-8 mb-2 flex justify-between">
          <span>{email || 'you@school.com'}</span>
          <button
            type="button"
            onClick={() => navigate('/sign-in/email')}
            className="text-brand-purple font-medium"
          >
            Change
          </button>
        </label>

        <label className="text-sm font-medium mt-4 mb-2">Password</label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3.5 outline-brand-purple"
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        <button type="button" className="text-right text-sm text-brand-purple mt-2">
          Forgot password?
        </button>

        {error ? <p className="text-red-500 text-sm mt-3">{error}</p> : null}

        <button
          type="submit"
          disabled={busy}
          className="mt-8 w-full bg-brand-purple text-white font-medium py-3.5 rounded-xl disabled:opacity-60"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
