import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import BackHeader from '../components/BackHeader.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const LAST_EMAIL_KEY = 'schoolink_last_email'

export default function SignInPassword() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signInWithPassword, signUp } = useAuth()

  const [email] = useState(location.state?.email ?? '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [mode, setMode] = useState('signin')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')

    const action = mode === 'signin' ? signInWithPassword : signUp
    const { error: actionError } = await action(email, password)

    setBusy(false)
    if (actionError) {
      setError(
        mode === 'signin'
          ? 'Incorrect password, or no account exists yet for this email. Try "Create Account" below if you\'re new here.'
          : actionError.message
      )
      return
    }

    localStorage.setItem(LAST_EMAIL_KEY, email)
    navigate('/onboarding/account-type')
  }

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader title="" />
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col px-6 pt-4">
        <h2 className="text-2xl font-bold">{mode === 'signin' ? 'Welcome back!' : 'Create your account'}</h2>
        <p className="text-gray-500 mt-1">{mode === 'signin' ? 'Enter your password to continue.' : 'Choose a password to get started.'}</p>

        <label className="text-sm font-medium mt-8 mb-2 flex justify-between">
          <span>{email || 'you@school.com'}</span>
          <button type="button" onClick={() => navigate('/sign-in/email')} className="text-brand-purple font-medium">Change</button>
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
          <button type="button" onClick={() => setShowPassword((s) => !s)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {mode === 'signin' ? <button type="button" className="text-right text-sm text-brand-purple mt-2">Forgot password?</button> : null}

        {error ? <p className="text-red-500 text-sm mt-3">{error}</p> : null}

        <button type="submit" disabled={busy} className="mt-8 w-full bg-brand-purple text-white font-medium py-3.5 rounded-xl disabled:opacity-60">
          {busy ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
        </button>

        <button
          type="button"
          onClick={() => { setMode((m) => (m === 'signin' ? 'signup' : 'signin')); setError('') }}
          className="text-center text-sm text-gray-500 mt-4"
        >
          {mode === 'signin' ? (<>Don't have an account? <span className="text-brand-purple font-medium">Create one</span></>) : (<>Already have an account? <span className="text-brand-purple font-medium">Sign in instead</span></>)}
        </button>
      </form>
    </div>
  )
    }
