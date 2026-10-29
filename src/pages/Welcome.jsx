import { useEffect, useState } from 'react'
import { GraduationCap, Mail, Lock, Eye, EyeOff, ArrowRight, ChevronRight, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabaseClient'
import GoogleIcon from '../components/GoogleIcon.jsx'
import { AuthField, PrimaryButton, Segmented, Notice, EMAIL_RE } from '../components/AuthKit.jsx'
import { applyInviteCode, PENDING_INVITE_KEY } from './JoinByLink.jsx'

const LAST_EMAIL_KEY = 'schoolink_last_email'
const MIN_PASSWORD = 8

function SocialRow({ icon, label, sub, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full h-16 rounded-2xl border border-gray-200 bg-white px-4 flex items-center gap-3 text-left disabled:opacity-50"
    >
      <span className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-semibold text-brand-navy">{label}</span>
        {sub ? <span className="block text-xs text-gray-500 mt-0.5">{sub}</span> : null}
      </span>
      <ChevronRight size={18} className="text-gray-300 shrink-0" />
    </button>
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
  const [notice, setNotice] = useState(null)
  const [touched, setTouched] = useState(false)

  const cleanEmail = email.trim()
  const emailOk = EMAIL_RE.test(cleanEmail)
  const passwordOk = mode === 'signin' ? password.length > 0 : password.length >= MIN_PASSWORD

  // Existing users already have an account_type on their profile. Send them home;
  // only a brand-new profile goes through onboarding. Used by email, Google and guest.
  async function goToDestination(userId) {
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

  function remember(address) {
    if (rememberMe) localStorage.setItem(LAST_EMAIL_KEY, address)
    else localStorage.removeItem(LAST_EMAIL_KEY)
  }

  function switchMode(next) {
    setMode(next)
    setNotice(null)
    setTouched(false)
    setPassword('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setTouched(true)
    if (!emailOk || !passwordOk) return
    setBusy(true)
    setNotice(null)

    if (mode === 'signin') {
      const { data, error } = await signInWithPassword(cleanEmail, password)
      setBusy(false)
      if (error) {
        setNotice({ tone: 'error', text: "That email and password don't match. Check them, or create an account if you're new here." })
        return
      }
      remember(cleanEmail)
      await goToDestination(data.user.id)
      return
    }

    const { data, error, accountExists } = await signUp(cleanEmail, password)

    if (accountExists) {
      // The account already exists. If the password matches, log them straight in.
      const { data: signInData, error: signInError } = await signInWithPassword(cleanEmail, password)
      setBusy(false)
      if (!signInError && signInData?.user) {
        remember(cleanEmail)
        await goToDestination(signInData.user.id)
        return
      }
      setNotice({ tone: 'error', text: 'An account already exists for this email. Log in instead.' })
      switchMode('signin')
      return
    }

    setBusy(false)
    if (error) {
      setNotice({ tone: 'error', text: error.message })
      return
    }

    remember(cleanEmail)

    if (!data?.session) {
      // Email confirmation is needed before a session exists.
      setNotice({ tone: 'ok', text: 'Account created. Check your email to confirm it, then log in.' })
      switchMode('signin')
      return
    }

    navigate('/onboarding/account-type')
  }

  async function handleGuest() {
    setGuestBusy(true)
    setNotice(null)
    const { error } = await signInAsGuest()
    setGuestBusy(false)
    if (error) setNotice({ tone: 'error', text: "Guest access isn't available right now. Please try again shortly." })
  }

  return (
    <div className="app-shell">
      <div className="screen-scroll px-6 pb-10 pt-12">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-2xl bg-brand-navy flex items-center justify-center text-white">
            <GraduationCap size={22} />
          </span>
          <div>
            <p className="text-[17px] font-extrabold leading-none text-brand-navy">Schoolink</p>
            <p className="mt-1 text-xs text-gray-500">Connecting schools worldwide</p>
          </div>
        </div>

        <h1 className="mt-10 text-[28px] leading-tight font-extrabold tracking-tight text-brand-navy">
          {mode === 'signin' ? 'Welcome back' : 'Create your account'}
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-gray-500">
          {mode === 'signin'
            ? 'Log in to stay connected with your school and community.'
            : 'Join your school community in a few steps.'}
        </p>

        <div className="mt-6">
          <Segmented
            value={mode}
            onChange={switchMode}
            options={[
              { value: 'signin', label: 'Log in' },
              { value: 'signup', label: 'Create account' },
            ]}
          />
        </div>

        {notice ? <div className="mt-5"><Notice tone={notice.tone}>{notice.text}</Notice></div> : null}

        <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
          <AuthField
            id="login-email"
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

          <AuthField
            id="login-password"
            label="Password"
            icon={Lock}
            type={showPassword ? 'text' : 'password'}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint={mode === 'signup' && !(touched && !passwordOk) ? `At least ${MIN_PASSWORD} characters.` : null}
            error={touched && !passwordOk
              ? (mode === 'signup' ? `Use at least ${MIN_PASSWORD} characters.` : 'Enter your password.')
              : null}
            right={
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="text-gray-400 shrink-0"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            }
          />

          {mode === 'signin' ? (
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded accent-brand-purple"
                />
                Remember me
              </label>
              <button
                type="button"
                onClick={() => navigate('/forgot-password', { state: { email: cleanEmail } })}
                className="text-sm font-semibold text-brand-purple"
              >
                Forgot password?
              </button>
            </div>
          ) : null}

          <PrimaryButton type="submit" busy={busy} busyLabel="Please wait…" className="mt-2">
            {mode === 'signin' ? 'Log in' : 'Create account'} <ArrowRight size={18} />
          </PrimaryButton>
        </form>

        <div className="flex items-center gap-3 my-7">
          <span className="flex-1 h-px bg-gray-200" />
          <span className="text-xs font-medium text-gray-400">or</span>
          <span className="flex-1 h-px bg-gray-200" />
        </div>

        <div className="space-y-3">
          <SocialRow
            icon={<GoogleIcon size={20} />}
            label="Continue with Google"
            onClick={() => signInWithGoogle()}
          />
          <SocialRow
            icon={<User size={20} className="text-gray-500" />}
            label={guestBusy ? 'Setting up…' : 'Continue as guest'}
            sub="Browse and read now. No email needed."
            onClick={handleGuest}
            disabled={guestBusy}
          />
        </div>

        <p className="mt-8 text-center text-xs leading-relaxed text-gray-400">
          By continuing, you agree to our{' '}
          <button type="button" onClick={() => navigate('/terms')} className="font-semibold text-brand-purple">Terms of Service</button>
          {' '}and{' '}
          <button type="button" onClick={() => navigate('/privacy')} className="font-semibold text-brand-purple">Privacy Policy</button>
        </p>
      </div>
    </div>
  )
}
