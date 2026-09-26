import { useEffect, useState } from 'react'
import { GraduationCap, Mail, Lock, Eye, EyeOff, User, Send, ChevronRight, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabaseClient'
import GoogleIcon from '../components/GoogleIcon.jsx'
import { applyInviteCode, PENDING_INVITE_KEY } from './JoinByLink.jsx'

const LAST_EMAIL_KEY = 'schoolink_last_email'

function HeroIllustration() {
  return (
    <div className="relative w-24 h-24 sm:w-28 sm:h-28 shrink-0">
      <span className="absolute inset-0 rounded-full bg-brand-light" />
      <svg viewBox="0 0 100 100" className="absolute -top-2 -right-1 w-16 h-16 text-brand-purple/40">
        <path d="M8 72 Q 40 22 88 12" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 6" strokeLinecap="round" />
      </svg>
      <Send size={20} className="absolute top-1 right-3 text-brand-purple rotate-[40deg]" />
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-14">
        <div className="h-3 rounded-sm bg-white border border-gray-200 shadow-sm" />
        <div className="h-3 rounded-sm bg-white border border-gray-200 shadow-sm -mt-0.5 translate-x-1" />
      </div>
      <GraduationCap size={38} className="absolute bottom-8 left-1/2 -translate-x-1/2 text-brand-purple drop-shadow-sm" />
      <span className="absolute -bottom-1 -left-1 w-3 h-3 rounded-full bg-white border border-gray-200" />
    </div>
  )
}

export default function Welcome() {
  const navigate = useNavigate()
  const { signInWithPassword, signUp, signInWithGoogle, signInAsGuest, saveProfileDetails, session } = useAuth()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [busy, setBusy] = useState(false)
  const [guestBusy, setGuestBusy] = useState(false)
  const [error, setError] = useState('')

  // Existing users already have an account_type on their profile row (set the
  // first time they went through onboarding). Send them straight home instead
  // of back through onboarding; only a brand-new profile goes to onboarding.
  // Used for every sign-in path — email, Google, and guest — so a brand-new
  // Google sign-in also lands on account setup instead of a half-empty /home.
async function goToDestination(userId) {
    // If they arrived here via an invite link while signed out, finish that
    // join now that they have a session, instead of sending them through
    // onboarding as if they were a totally fresh account.
    const pendingCode = localStorage.getItem(PENDING_INVITE_KEY)
    if (pendingCode) {
      localStorage.removeItem(PENDING_INVITE_KEY)
      await applyInviteCode(pendingCode, saveProfileDetails)
      navigate('/home', { replace: true })
      return
    }

    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('account_type')
      .eq('id', userId)
      .maybeSingle()
    navigate(existingProfile?.account_type ? '/home' : '/onboarding/account-type', { replace: true })
}
  
  useEffect(() => {
    if (session?.user) goToDestination(session.user.id)
  }, [session])

  useEffect(() => {
    const saved = localStorage.getItem(LAST_EMAIL_KEY)
    if (saved) setEmail(saved)
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email || !password) return
    setBusy(true)
    setError('')

    if (mode === 'signin') {
      const { data, error: actionError } = await signInWithPassword(email, password)
      setBusy(false)
      if (actionError) {
        setError("Incorrect password, or no account exists yet for this email. Try \"Create one\" below if you're new here.")
        return
      }
      if (rememberMe) localStorage.setItem(LAST_EMAIL_KEY, email)
      else localStorage.removeItem(LAST_EMAIL_KEY)
      await goToDestination(data.user.id)
      return
    }

    // mode === 'signup'
    const { data, error: actionError, accountExists } = await signUp(email, password)

    if (accountExists) {
      // An account already exists for this email. Try logging them straight
      // in with the password they just typed, in case it's the same one —
      // that way "Create Account" on an existing email just logs them in
      // instead of silently failing or making them re-do onboarding.
      const { data: signInData, error: signInError } = await signInWithPassword(email, password)
      setBusy(false)
      if (!signInError && signInData?.user) {
        if (rememberMe) localStorage.setItem(LAST_EMAIL_KEY, email)
        await goToDestination(signInData.user.id)
        return
      }
      setError('An account already exists for this email. Log in instead.')
      setMode('signin')
      setPassword('')
      return
    }

    setBusy(false)
    if (actionError) {
      setError(actionError.message)
      return
    }

    if (rememberMe) localStorage.setItem(LAST_EMAIL_KEY, email)
    else localStorage.removeItem(LAST_EMAIL_KEY)

    if (!data?.session) {
      // Email confirmation is required before a session can be created.
      setError('Account created! Check your email to confirm it, then log in.')
      setMode('signin')
      setPassword('')
      return
    }

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
    <div className="flex-1 flex flex-col px-6 pt-10 pb-8 relative overflow-y-auto overflow-x-hidden">
      <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full bg-brand-light -z-10" />
      <div className="absolute -bottom-24 -right-20 w-64 h-64 rounded-full bg-brand-light -z-10" />

      <div className="flex flex-col items-center text-center">
        <div className="flex items-center gap-2">
          <GraduationCap size={32} className="text-brand-purple" />
          <h1 className="text-3xl font-extrabold text-brand-purple leading-none">Schoolink</h1>
        </div>
        <p className="text-sm font-medium text-brand-purple/70 mt-1">Connecting Schools Worldwide</p>
      </div>

      <div className="flex items-start justify-between gap-4 mt-8">
        <div className="flex-1 min-w-0">
          <h2 className="text-[26px] leading-tight font-extrabold text-brand-navy">{mode === 'signin' ? 'Welcome Back!' : 'Create Your Account'}</h2>
          <p className="text-gray-500 mt-2 text-sm leading-relaxed">
            {mode === 'signin'
              ? 'Log in to your Schoolink account and stay connected with your school, community and more.'
              : "Join Schoolink and connect with your school's community."}
          </p>
        </div>
        <HeroIllustration />
      </div>

      {error ? <p className="text-red-500 text-sm mt-4">{error}</p> : null}

      <form onSubmit={handleSubmit} className="mt-6 space-y-3">
        <div className="flex items-center gap-3 border border-gray-200 rounded-2xl px-4 py-3.5 bg-white shadow-sm">
          <Mail size={18} className="text-brand-purple shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-gray-400">School Email Address</p>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@schoolink.com"
              className="w-full outline-none text-sm bg-transparent"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 border border-gray-200 rounded-2xl px-4 py-3.5 bg-white shadow-sm">
          <Lock size={18} className="text-brand-purple shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-gray-400">Password</p>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full outline-none text-sm bg-transparent"
            />
          </div>
          <button type="button" onClick={() => setShowPassword((s) => !s)} className="shrink-0">
            {showPassword ? <EyeOff size={18} className="text-gray-400" /> : <Eye size={18} className="text-gray-400" />}
          </button>
        </div>

        {mode === 'signin' ? (
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="w-4 h-4 rounded accent-brand-purple" />
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
          className="w-full bg-brand-purple text-white font-semibold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-brand-purple/30 disabled:opacity-60"
        >
          {busy ? 'Please wait…' : (
            <>
              {mode === 'signin' ? 'Log In' : 'Create Account'} <ArrowRight size={18} />
            </>
          )}
        </button>
      </form>

      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-400 font-medium">OR</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      <div className="space-y-3">
        <button onClick={signInWithGoogle} className="w-full border border-gray-200 rounded-2xl py-3.5 px-4 flex items-center justify-between bg-white shadow-sm">
          <span className="flex items-center gap-3 font-medium text-sm">
            <GoogleIcon size={20} /> Continue with Google
          </span>
          <ChevronRight size={18} className="text-gray-300" />
        </button>
        <button
          onClick={handleGuest}
          disabled={guestBusy}
          className="w-full border border-gray-200 rounded-2xl py-3.5 px-4 flex items-center justify-between bg-white shadow-sm disabled:opacity-60"
        >
          <span className="flex items-center gap-3 font-medium text-sm">
            <User size={20} className="text-gray-500" /> {guestBusy ? 'Setting up…' : 'Continue as Guest'}
          </span>
          <ChevronRight size={18} className="text-gray-300" />
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
