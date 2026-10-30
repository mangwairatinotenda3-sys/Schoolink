import { useEffect, useState } from 'react'
import { GraduationCap, Mail, Lock, Eye, EyeOff, ArrowRight, ChevronRight, User, CalendarDays } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabaseClient'
import GoogleIcon from '../components/GoogleIcon.jsx'
import { AuthField, PrimaryButton, Segmented, Notice, EMAIL_RE } from '../components/AuthKit.jsx'
import { applyInviteCode, PENDING_INVITE_KEY } from './JoinByLink.jsx'
import { ageFromBirthDate, isTooYoung } from '../lib/age.js'
import { MIN_AGE } from '../lib/legal.js'
import { setAnalyticsEnabled } from '../lib/analytics.js'

const LAST_EMAIL_KEY = 'schoolink_last_email'
const PENDING_PROFILE_KEY = 'schoolink_pending_profile'
const MIN_PASSWORD = 8
const NAME_RE = /^\p{L}[\p{L}'’\- ]{0,39}$/u
const STRENGTH_LABELS = ['Weak', 'Weak', 'Fair', 'Good', 'Strong']
const STRENGTH_COLORS = ['', 'bg-red-400', 'bg-amber-400', 'bg-green-400', 'bg-green-600']

function passwordScore(pw) {
  let score = 0
  if (pw.length >= MIN_PASSWORD) score++
  if (pw.length >= 12) score++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++
  return score
}

function localDate(offsetYears = 0) {
  const d = new Date()
  return `${d.getFullYear() - offsetYears}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

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

function Check({ id, checked, onChange, children }) {
  return (
    <div className="flex items-start gap-3 text-sm leading-snug text-gray-700">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-5 h-5 shrink-0 accent-brand-purple"
      />
      <span>{children}</span>
    </div>
  )
}

// Saves the sign-up details once we know who the account belongs to.
async function applyPendingProfile(userId, email) {
  const raw = localStorage.getItem(PENDING_PROFILE_KEY)
  if (!raw || !userId) return
  let pending = null
  try { pending = JSON.parse(raw) } catch { localStorage.removeItem(PENDING_PROFILE_KEY); return }
  if (!pending || String(pending.email).toLowerCase() !== String(email || '').toLowerCase()) return
  const { error } = await supabase.from('profiles').upsert({
    id: userId,
    full_name: pending.full_name,
    birth_date: pending.birth_date,
    terms_accepted_at: pending.terms_accepted_at,
  })
  if (!error) {
    setAnalyticsEnabled(!!pending.analytics)
    localStorage.removeItem(PENDING_PROFILE_KEY)
  }
}

export default function Welcome() {
  const navigate = useNavigate()
  const { signInWithPassword, signUp, signInWithGoogle, signInAsGuest, saveProfileDetails, session } = useAuth()

  const [mode, setMode] = useState('signin')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [birth, setBirth] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [parentOk, setParentOk] = useState(false)
  const [terms, setTerms] = useState(false)
  const [analytics, setAnalytics] = useState(false)
  const [busy, setBusy] = useState(false)
  const [guestBusy, setGuestBusy] = useState(false)
  const [notice, setNotice] = useState(null)
  const [touched, setTouched] = useState(false)

  const signup = mode === 'signup'
  const cleanEmail = email.trim()
  const emailOk = EMAIL_RE.test(cleanEmail)
  const passwordOk = signup ? password.length >= MIN_PASSWORD : password.length > 0
  const first = firstName.trim()
  const last = lastName.trim()
  const firstOk = first.length >= 2 && NAME_RE.test(first)
  const lastOk = last.length >= 2 && NAME_RE.test(last)
  const age = birth ? ageFromBirthDate(birth) : null
  const birthOk = age !== null && age >= 0 && age <= 110
  const tooYoung = birthOk && isTooYoung(birth)
  const minor = birthOk && !tooYoung && age < 18
  const matchOk = confirm.length > 0 && confirm === password
  const score = passwordScore(password)
  const signupReady = firstOk && lastOk && birthOk && !tooYoung && emailOk && passwordOk && matchOk && terms && (!minor || parentOk)

  // Existing users already have an account_type on their profile. Send them home;
  // only a brand-new profile goes through onboarding. Used by email, Google and guest.
  async function goToDestination(userId, userEmail) {
    const pendingCode = localStorage.getItem(PENDING_INVITE_KEY)
    if (pendingCode) {
      localStorage.removeItem(PENDING_INVITE_KEY)
      await applyInviteCode(pendingCode, saveProfileDetails)
      navigate('/home', { replace: true })
      return
    }
    await applyPendingProfile(userId, userEmail)
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('account_type')
      .eq('id', userId)
      .maybeSingle()
    navigate(existingProfile?.account_type ? '/home' : '/onboarding/account-type', { replace: true })
  }

  useEffect(() => {
    if (session?.user) goToDestination(session.user.id, session.user.email)
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
    setConfirm('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setTouched(true)
    setNotice(null)

    if (mode === 'signin') {
      if (!emailOk || !passwordOk) return
      setBusy(true)
      const { data, error } = await signInWithPassword(cleanEmail, password)
      setBusy(false)
      if (error) {
        setNotice({ tone: 'error', text: "That email and password don't match. Check them, or create an account if you're new here." })
        return
      }
      remember(cleanEmail)
      await goToDestination(data.user.id, cleanEmail)
      return
    }

    if (!signupReady) return
    setBusy(true)

    // Keep the details until the account exists (and, if needed, until the email is confirmed).
    localStorage.setItem(PENDING_PROFILE_KEY, JSON.stringify({
      email: cleanEmail,
      full_name: `${first} ${last}`,
      birth_date: birth,
      terms_accepted_at: new Date().toISOString(),
      analytics,
    }))

    const { data, error, accountExists } = await signUp(cleanEmail, password)

    if (accountExists) {
      // The account already exists. If the password matches, log them straight in.
      localStorage.removeItem(PENDING_PROFILE_KEY)
      const { data: signInData, error: signInError } = await signInWithPassword(cleanEmail, password)
      setBusy(false)
      if (!signInError && signInData?.user) {
        remember(cleanEmail)
        await goToDestination(signInData.user.id, cleanEmail)
        return
      }
      setNotice({ tone: 'error', text: 'An account already exists for this email. Log in instead.' })
      switchMode('signin')
      setEmail(cleanEmail)
      return
    }

    setBusy(false)
    if (error) {
      localStorage.removeItem(PENDING_PROFILE_KEY)
      setNotice({ tone: 'error', text: error.message })
      return
    }

    remember(cleanEmail)

    if (!data?.session) {
      // Email confirmation is needed before a session exists.
      setNotice({ tone: 'ok', text: 'Account created. Check your email to confirm it, then log in. Your details will be saved when you first log in.' })
      switchMode('signin')
      return
    }

    await applyPendingProfile(data.user.id, cleanEmail)
    navigate('/onboarding/account-type', { replace: true })
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
          {signup ? 'Create your account' : 'Welcome back'}
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-gray-500">
          {signup
            ? 'Join your school community in a few steps.'
            : 'Log in to stay connected with your school and community.'}
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
          {signup ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <AuthField
                  id="first-name"
                  label="First name"
                  autoComplete="given-name"
                  autoCapitalize="words"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  error={touched && !firstOk ? 'Enter your first name.' : null}
                />
                <AuthField
                  id="last-name"
                  label="Surname"
                  autoComplete="family-name"
                  autoCapitalize="words"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  error={touched && !lastOk ? 'Enter your surname.' : null}
                />
              </div>

              <AuthField
                id="birth-date"
                label="Date of birth"
                icon={CalendarDays}
                type="date"
                min={localDate(110)}
                max={localDate(0)}
                value={birth}
                onChange={(e) => setBirth(e.target.value)}
                hint="Only you see your birthday. Schoolink uses it to keep every age safe."
                error={
                  tooYoung ? `Schoolink is for ages ${MIN_AGE} and up.`
                    : touched && !birthOk ? 'Enter your date of birth.'
                      : null
                }
              />
            </>
          ) : null}

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

          <div>
            <AuthField
              id="login-password"
              label="Password"
              icon={Lock}
              type={showPassword ? 'text' : 'password'}
              autoComplete={signup ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={touched && !passwordOk
                ? (signup ? `Use at least ${MIN_PASSWORD} characters.` : 'Enter your password.')
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
            {signup && password ? (
              <div className="mt-2">
                <div className="grid grid-cols-4 gap-1.5">
                  {[1, 2, 3, 4].map((n) => (
                    <span key={n} className={`h-1.5 rounded-full ${score >= n ? STRENGTH_COLORS[score] : 'bg-gray-200'}`} />
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-gray-500">
                  {password.length < MIN_PASSWORD ? `At least ${MIN_PASSWORD} characters` : `Strength: ${STRENGTH_LABELS[score]}`}
                </p>
              </div>
            ) : null}
          </div>

          {signup ? (
            <AuthField
              id="confirm-password"
              label="Confirm password"
              icon={Lock}
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              error={touched && !matchOk ? 'The passwords do not match.' : null}
            />
          ) : null}

          {signup ? (
            <div className="space-y-3.5 pt-1">
              {minor ? (
                <Check id="parent-ok" checked={parentOk} onChange={setParentOk}>
                  I'm under 18 and my parent or guardian knows I use Schoolink, or my school has given me access.
                </Check>
              ) : null}
              <Check id="terms-ok" checked={terms} onChange={setTerms}>
                I agree to the{' '}
                <button type="button" onClick={() => navigate('/terms')} className="font-semibold text-brand-purple">Terms of Service</button>
                {' '}and have read the{' '}
                <button type="button" onClick={() => navigate('/privacy')} className="font-semibold text-brand-purple">Privacy Policy</button>.
              </Check>
              <Check id="analytics-ok" checked={analytics} onChange={setAnalytics}>
                <span className="text-gray-500">Help improve Schoolink by sharing which screens I use. Optional, anonymous, and you can change it in Settings.</span>
              </Check>
            </div>
          ) : (
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
          )}

          <PrimaryButton type="submit" busy={busy} busyLabel="Please wait…" className="mt-2">
            {signup ? 'Create account' : 'Log in'} <ArrowRight size={18} />
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
      </div>
    </div>
  )
}
