import { useEffect, useState } from 'react'
import { GraduationCap, Mail, Lock, Eye, EyeOff, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import GoogleIcon from '../components/GoogleIcon.jsx'

const LAST_EMAIL_KEY = 'schoolink_last_email'

export default function Welcome() {
  const navigate = useNavigate()
  const { signInWithPassword, signUp, signInWithGoogle, signInAsGuest, session } = useAuth()

  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [busy, setBusy] = useState(false)
  const [guestBusy, setGuestBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (session) navigate('/home', { replace: true })
  }, [session, navigate])

  useEffect(() => {
    const saved = localStorage.getItem(LAST_EMAIL_KEY)
    if (saved) setEmail(saved)
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email || !password) return
    setBusy(true)
    setError('')

    const action = mode === 'signin' ? signInWithPassword : signUp
    const { error: actionError } = await action(email, password)

    setBusy(false)
    if (actionError) {
      setError(
        mode === 'signin'
          ? "Incorrect password, or no account exists yet for this email. Try \"Create one\" below if you're new here."
          : actionError.message
      )
      return
    }

    if (rememberMe) localStorage.setItem(LAST_EMAIL_KEY, email)
    else localStorage.removeItem(LAST_EMAIL_KEY)

    navigate('/onboarding/account-type')
  }

  async function handleGuest() {
    setGuestBusy(true)
    setError('')
    const { error: guestError } = await signInAsGuest()
    setGuestBusy(false)
    if (guestError) setError("Guest access isn't available right now. Please try again shortly.")
  }

  return (
    <div className="flex-1 flex flex-col px-6 pt-10 pb-8 relative overflow-hidden">
      <div className="absolute -top-16 -left-16 w-48 h-48 rounded-full bg-brand-light -z-10" />
      <div className="absolute top-40 -right-16 w-40 h-40 rounded-full bg-brand-light -z-10" />

      <div className="flex items-center justify-center gap-2">
        <span className="w-9 h-9 rounded-xl bg-brand-purple flex items-center justify-center">
          <GraduationCap className="text-white" size={20} />
        </span>
        <div>
          <h1 className="text-lg font-bold text-brand-purple leading-tight">Schoolink</h1>
          <p className="text-[10px] text-gray-400 -mt-1">Connecting Schools Worldwide</p>
        </div>
      </div>

      <div className="flex items-center justify-between mt-8 gap-4">
        <div className="flex-1">
          <h2 className="text-2xl font-bold">{mode === 'signin' ? 'Welcome Back!' : 'Create Your Account'}</h2>
          <p className="text-gray-500 mt-2 text-sm">
            {mode === 'signin'
              ? 'Log in to your Schoolink account and stay connected with your school, community and more.'
              : "Join Schoolink and connect with your school's community."}
          </p>
        </div>
        <div className="text-6xl shrink-0">🎓📚</div>
      </div>

      {error ? <p className="text-red-500 text-sm mt-4">{error}</p> : null}

      <form onSubmit={handleSubmit} className="mt-6 space-y-3">
        <div className="flex items-center gap-3 border border-gray-200 rounded-xl px-4 py-3.5">
          <Mail size={18} className="text-brand-purple shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-gray-400">School Email Address</p>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@schoolink.com"
              className="w-full outline-none text-sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 border border-gray-200 rounded-xl px-4 py-3.5">
          <Lock size={18} className="text-brand-purple shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-gray-400">Password</p>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full outline-none text-sm"
            />
          </div>
          <button type="button" onClick={() => setShowPassword((s) => !s)} className="shrink-0">
            {showPassword ? <EyeOff size={18} className="text-gray-400" /> : <Eye size={18} className="text-gray-400" />}
          </button>
        </div>

        {mode === 'signin' ? (
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
              Remember me
            </label>
            <button type="button" onClick={() => navigate('/forgot-password', { state: { email } })} className="text-sm text-brand-purple font-medium">
              Forgot password?
            </button>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-brand-purple text-white font-medium py-3.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {busy ? 'Please wait…' : mode === 'signin' ? 'Log In →' : 'Create Account →'}
        </button>
      </form>

      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-400">OR</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      <div className="space-y-3">
        <button onClick={signInWithGoogle} className="w-full border border-gray-200 font-medium py-3.5 rounded-xl flex items-center justify-center gap-2">
          <GoogleIcon size={18} /> Continue with Google
        </button>
        <button
          onClick={handleGuest}
          disabled={guestBusy}
          className="w-full border border-gray-200 font-medium py-3.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <User size={18} className="text-gray-500" /> {guestBusy ? 'Setting up…' : 'Continue as Guest'}
        </button>
      </div>

      <p className="text-center text-sm text-gray-500 mt-5">
        {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
        <button
          onClick={() => { setMode((m) => (m === 'signin' ? 'signup' : 'signin')); setError('') }}
          className="text-brand-purple font-medium"
        >
          {mode === 'signin' ? 'Create one' : 'Log in instead'}
        </button>
      </p>

      <p className="text-center text-xs text-gray-400 mt-4">
        By continuing, you agree to our{' '}
        <button onClick={() => navigate('/terms')} className="text-brand-purple">Terms of Service</button> and{' '}
        <button onClick={() => navigate('/privacy')} className="text-brand-purple">Privacy Policy</button>
      </p>
    </div>
  )
         }
