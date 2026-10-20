import { useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Cake, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { ageFromBirthDate, isTooYoung } from '../lib/age.js'
import { MIN_AGE } from '../lib/legal.js'
import { setAnalyticsEnabled } from '../lib/analytics.js'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const OPEN_PATHS = ['/terms', '/privacy', '/appeal']

function Select({ label, value, onChange, children }) {
  return (
    <label className="flex-1 min-w-0">
      <span className="block text-[12px] font-semibold text-gray-400 mb-1">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-gray-100 rounded-xl px-3 py-3 text-[15px] outline-none focus:ring-2 focus:ring-brand-purple/40"
      >
        {children}
      </select>
    </label>
  )
}

// Asks every new person for their birth date once. Under 13 cannot use Schoolink.
export default function AgeGate() {
  const { user, profile, isGuest, saveProfileDetails, signOut } = useAuth()
  const { pathname } = useLocation()
  const [day, setDay] = useState('')
  const [month, setMonth] = useState('')
  const [year, setYear] = useState('')
  const [agree, setAgree] = useState(false)
  const [parent, setParent] = useState(false)
  const [stats, setStats] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)

  const thisYear = new Date().getFullYear()
  const years = useMemo(() => Array.from({ length: 100 }, (_, i) => thisYear - i), [thisYear])

  if (!user || isGuest || !profile || OPEN_PATHS.includes(pathname)) return null
  if (profile.birth_date && !isTooYoung(profile.birth_date)) return null

  // Someone whose saved birth date says under 13
  if (profile.birth_date) {
    async function removeAccount() {
      setDeleting(true)
      await supabase.rpc('delete_my_account')
      await signOut()
    }
    return (
      <div className="fixed inset-0 z-[110] bg-white flex justify-center overflow-y-auto" role="alertdialog" aria-modal="true">
        <div className="w-full max-w-[480px] px-6 pb-10 text-center" style={{ paddingTop: 'max(72px, env(safe-area-inset-top))' }}>
          <span className="w-20 h-20 rounded-full bg-amber-50 mx-auto flex items-center justify-center"><Cake size={34} className="text-amber-500" /></span>
          <h1 className="text-2xl font-bold mt-5">Schoolink is for ages {MIN_AGE} and up</h1>
          <p className="text-sm text-gray-500 mt-2 leading-snug">We can’t let you use Schoolink yet. Ask a parent or your school about the right tools for your age, and come back when you’re {MIN_AGE}.</p>
          <button onClick={removeAccount} disabled={deleting} className="mt-8 w-full rounded-full bg-red-500 text-white font-semibold py-3.5 disabled:opacity-60">{deleting ? 'Deleting…' : 'Delete my account and data'}</button>
          <button onClick={signOut} className="mt-3 w-full rounded-full bg-gray-100 font-semibold py-3.5">Sign out</button>
        </div>
      </div>
    )
  }

  const dayCount = month && year ? new Date(Number(year), Number(month), 0).getDate() : 31
  const birth = day && month && year ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` : ''
  const age = birth ? ageFromBirthDate(birth) : null
  const minor = age !== null && age >= MIN_AGE && age < 18
  const ready = birth && age !== null && age >= 0 && agree && (!minor || parent)

  async function submit() {
    setError('')
    if (!birth || age === null || age < 0 || age > 110) { setError('Please check your birth date.'); return }
    setBusy(true)
    setAnalyticsEnabled(stats)
    const { error: saveError } = await saveProfileDetails({ birth_date: birth, terms_accepted_at: new Date().toISOString() })
    setBusy(false)
    if (saveError) setError('Could not save. Check your connection and try again.')
  }

  return (
    <div className="fixed inset-0 z-[110] bg-white flex justify-center overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="age-title">
      <div className="w-full max-w-[480px] px-6 pb-10" style={{ paddingTop: 'max(56px, env(safe-area-inset-top))' }}>
        <span className="w-16 h-16 rounded-2xl bg-brand-light flex items-center justify-center"><ShieldCheck size={30} className="text-brand-purple" /></span>
        <h1 id="age-title" className="text-[26px] font-bold mt-5 leading-tight">One quick step</h1>
        <p className="text-sm text-gray-500 mt-2 leading-snug">When is your birthday? We use it to keep Schoolink safe for every age. Other people won’t see it.</p>

        <div className="flex gap-2.5 mt-6">
          <Select label="Day" value={day} onChange={setDay}>
            <option value="">Day</option>
            {Array.from({ length: dayCount }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
          </Select>
          <Select label="Month" value={month} onChange={setMonth}>
            <option value="">Month</option>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </Select>
          <Select label="Year" value={year} onChange={setYear}>
            <option value="">Year</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </Select>
        </div>

        {age !== null && age < MIN_AGE && age >= 0 ? (
          <p className="mt-4 text-sm text-amber-700 bg-amber-50 rounded-xl p-3 leading-snug">Schoolink is for ages {MIN_AGE} and up. You can still continue and we’ll explain the next step.</p>
        ) : null}

        <div className="mt-6 space-y-3.5">
          <label className="flex items-start gap-3 text-sm leading-snug">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 w-5 h-5 accent-[var(--brand-purple)]" />
            <span>I agree to the <a href="#/terms" className="text-brand-purple font-medium">Terms of Service</a> and have read the <a href="#/privacy" className="text-brand-purple font-medium">Privacy Policy</a>.</span>
          </label>
          {minor ? (
            <label className="flex items-start gap-3 text-sm leading-snug">
              <input type="checkbox" checked={parent} onChange={(e) => setParent(e.target.checked)} className="mt-0.5 w-5 h-5 accent-[var(--brand-purple)]" />
              <span>I’m under 18 and my parent or guardian knows I use Schoolink, or my school has given me access.</span>
            </label>
          ) : null}
          <label className="flex items-start gap-3 text-sm leading-snug text-gray-600">
            <input type="checkbox" checked={stats} onChange={(e) => setStats(e.target.checked)} className="mt-0.5 w-5 h-5 accent-[var(--brand-purple)]" />
            <span>Help improve Schoolink by sharing which screens I use. Optional, anonymous, and you can change it in Settings.</span>
          </label>
        </div>

        {error ? <p className="text-red-500 text-sm mt-4">{error}</p> : null}

        <button onClick={submit} disabled={!ready || busy} className="mt-7 w-full rounded-full bg-brand-purple text-white font-semibold py-3.5 disabled:opacity-40 active:opacity-80">
          {busy ? 'Saving…' : 'Continue'}
        </button>
        <button onClick={signOut} className="mt-3 w-full text-sm text-gray-400 py-2">Sign out</button>
      </div>
    </div>
  )
}
