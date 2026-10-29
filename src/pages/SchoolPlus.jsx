import { useEffect, useRef, useState } from 'react'
import { Gift, Clock, Smartphone, BadgeCheck, Lock, RefreshCw, X } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { PlusSeal, refreshPlusSchools } from '../components/SchoolPlusBadge.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { canManageStaff } from '../lib/permissions.js'

const POLL_EVERY_MS = 4000
const WAIT_LIMIT_MS = 3 * 60 * 1000
const MAX_FAILED_CHECKS = 3
const RESUME_WINDOW_MS = 30 * 60 * 1000
const PLANS = [1, 3, 6, 12]
const PHONE_RE = /^(\+?263|0)?7[1-9]\d{7}$/

const fmtDate = (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
const money = (n) => `$${Number(n).toFixed(2)}`

function EcoCashLogo({ height = 24 }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[15px] font-extrabold tracking-tight">
        <Smartphone size={height - 6} className="text-[#0072CE]" />
        <span><span className="text-[#0072CE]">Eco</span><span className="text-[#E30613]">Cash</span></span>
      </span>
    )
  }
  return (
    <img
      src={`${import.meta.env.BASE_URL}ecocash-logo.png`}
      alt="EcoCash"
      style={{ height }}
      onError={() => setFailed(true)}
    />
  )
}

function Pill({ tone, children }) {
  const tones = {
    green: 'bg-green-50 text-green-700',
    red: 'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-700',
    gray: 'bg-gray-100 text-gray-600',
  }
  return <span className={`text-[11px] font-semibold rounded-full px-2.5 py-1 whitespace-nowrap ${tones[tone] || tones.gray}`}>{children}</span>
}

function Block({ className = '' }) {
  return <div className={`rounded-xl bg-gray-200/70 ${className}`} />
}

// Static placeholder shown while the school's billing details load
function SchoolPlusSkeleton() {
  return (
    <div className="screen-scroll pb-12 px-4" aria-busy="true" aria-label="Loading School Plus">
      <Block className="mt-4 h-44 rounded-3xl bg-brand-navy/15" />
      <Block className="mt-4 h-24 rounded-2xl" />
      <Block className="mt-6 h-3 w-24 rounded-full" />
      <div className="mt-2 grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((i) => <Block key={i} className="h-16 rounded-2xl" />)}
      </div>
      <Block className="mt-3 h-12 rounded-2xl" />
      <Block className="mt-4 h-72 rounded-3xl" />
      <Block className="mt-7 h-3 w-20 rounded-full" />
      <Block className="mt-2 h-16 rounded-2xl" />
    </div>
  )
}

const NOTICE_STYLE = {
  ok: 'bg-green-50 text-green-700 border-green-200',
  error: 'bg-red-50 text-red-600 border-red-200',
  info: 'bg-gray-50 text-gray-700 border-gray-200',
}

const PAY_STATUS = {
  approved: { tone: 'green', label: 'Paid' },
  rejected: { tone: 'red', label: 'Not paid' },
  pending: { tone: 'amber', label: 'Checking' },
}

// Paid "School Plus" verification: $2.99 a month, only for the school profile.
export default function SchoolPlus() {
  const { profile } = useAuth()
  const schoolId = profile?.school_id

  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [months, setMonths] = useState(1)
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)        // { tone, text }
  const [panel, setPanel] = useState(null)          // null | 'waiting' | 'timeout'
  const [pendingId, setPendingId] = useState(null)  // the payment we are checking
  const [watchKey, setWatchKey] = useState(null)    // set = polling on
  const [pulse, setPulse] = useState(0)             // bump = check right now
  const [sent, setSent] = useState({ amount: '', number: '', instructions: '' })
  const checking = useRef(false)
  const resumed = useRef(false)

  async function load() {
    setLoadError('')
    const { data: d, error: e } = await supabase.rpc('school_billing', { p_school: schoolId })
    if (e) { setLoadError(e.message); return }
    setData(d)
    refreshPlusSchools(true)
  }

  useEffect(() => { if (schoolId) load() }, [schoolId])

  // Once per page open: if a payment is still unconfirmed, show it. Do not start polling on its own.
  useEffect(() => {
    if (!data || resumed.current) return
    resumed.current = true
    const open = (data.payments || []).find((p) =>
      p.method === 'paynow' && p.status === 'pending' && Date.now() - new Date(p.created_at).getTime() < RESUME_WINDOW_MS)
    if (open) {
      setPendingId(open.id)
      setNotice({ tone: 'info', text: 'A payment is still being confirmed. Tap Check again to update it.' })
    }
  }, [data])

  // Polling while a payment is being confirmed. Always ends.
  useEffect(() => {
    if (!watchKey) return undefined
    const id = watchKey
    let stopped = false
    let failures = 0
    const startedAt = Date.now()
    let timer = null

    function halt() {
      stopped = true
      if (timer) clearInterval(timer)
      setWatchKey(null)
    }

    async function tick() {
      if (checking.current || stopped) return
      checking.current = true
      let res = null
      let err = null
      try {
        const out = await supabase.functions.invoke('paynow', { body: { action: 'check', paymentId: id } })
        res = out.data
        err = out.error
      } catch (e) {
        err = e
      }
      checking.current = false
      if (stopped) return

      if (err || !res || res.ok === false) {
        failures += 1
        if (failures >= MAX_FAILED_CHECKS) {
          halt()
          setPanel('timeout')
          setNotice({ tone: 'error', text: 'We could not reach the payment server. Tap Check again.' })
        }
        return
      }
      failures = 0

      if (res.state === 'paid') {
        halt()
        setPanel(null)
        setPendingId(null)
        setNotice({ tone: 'ok', text: 'Payment received. School Plus is on. Thank you.' })
        load()
      } else if (res.state === 'failed') {
        halt()
        setPanel(null)
        setPendingId(null)
        setNotice({ tone: 'error', text: res.error || 'The payment was cancelled. You were not charged.' })
        load()
      } else if (Date.now() - startedAt > WAIT_LIMIT_MS) {
        halt()
        setPanel('timeout')
        setNotice({ tone: 'info', text: 'No confirmation yet. If you approved the prompt, tap Check again.' })
      }
    }

    tick()
    timer = setInterval(tick, POLL_EVERY_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') tick() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stopped = true
      if (timer) clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [watchKey, pulse])

  if (!canManageStaff(profile)) {
    return (
      <div className="app-shell">
        <BackHeader title="School Plus" />
        <div className="screen-scroll px-6 flex items-center justify-center text-center text-gray-400">
          Only the headteacher or deputy head can manage School Plus.
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="app-shell">
        <BackHeader title="School Plus" />
        {loadError ? (
          <div className="screen-scroll px-6 flex flex-col items-center justify-center text-center gap-4">
            <p className="text-sm text-gray-500">{loadError}</p>
            <button onClick={load} className="flex items-center gap-1.5 rounded-xl bg-brand-purple px-5 py-2.5 text-sm font-semibold text-white">
              <RefreshCw size={15} /> Try again
            </button>
          </div>
        ) : (
          <SchoolPlusSkeleton />
        )}
      </div>
    )
  }

  const price = Number(data.price || 2.99)
  const total = price * months
  const totalText = money(total)
  const sub = data.subscription
  const active = !!sub && new Date(sub.expires_at) > new Date()
  const daysLeft = active ? Math.max(1, Math.ceil((new Date(sub.expires_at) - Date.now()) / 86400000)) : 0
  const pending = (data.payments || []).filter((p) => p.status === 'pending')
  const people = data.counts?.total ?? 0
  const promoPct = Math.min(100, people)

  async function pay() {
    setNotice(null)
    const digits = phone.replace(/\s/g, '')
    if (!PHONE_RE.test(digits)) {
      setNotice({ tone: 'error', text: 'Enter a valid EcoCash number, for example 0771234567.' })
      return
    }
    setBusy(true)
    const returnUrl = `${window.location.origin}${window.location.pathname}#/school-settings/verification`
    const { data: res, error: e } = await supabase.functions.invoke('paynow', {
      body: { action: 'start', months, phone: digits, returnUrl },
    })
    setBusy(false)
    if (e || !res?.ok) {
      setNotice({ tone: 'error', text: res?.error || 'Could not send the request. Please try again.' })
      return
    }
    setSent({ amount: totalText, number: digits, instructions: res.instructions || '' })
    setPendingId(res.paymentId)
    setPanel('waiting')
    setWatchKey(res.paymentId)
  }

  function checkAgain() {
    if (!pendingId) return
    setNotice(null)
    setPanel('waiting')
    setWatchKey(pendingId)
    setPulse((n) => n + 1)
  }

  function checkNow() {
    setPulse((n) => n + 1)
  }

  function cancelWaiting() {
    setWatchKey(null)
    setPanel(null)
    setNotice({ tone: 'info', text: 'Stopped waiting. If you paid, School Plus turns on automatically. You can check again any time.' })
  }

  const showPanel = panel === 'waiting' || panel === 'timeout'

  return (
    <div className="app-shell">
      <BackHeader title="School Plus" />
      <div className="screen-scroll pb-12 px-4">

        {/* Hero: solid navy, one gold accent */}
        <div className="relative overflow-hidden rounded-3xl bg-[#1E1747] p-5 text-white ring-1 ring-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <PlusSeal size={28} />
              <p className="text-base font-bold tracking-tight">School Plus</p>
            </div>
            {active ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-white/90">
                <BadgeCheck size={13} className="text-amber-300" /> {sub.is_promo ? 'Free month' : 'Active'}
              </span>
            ) : null}
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-white/70">
            A verified badge on your school profile, so parents and students know they are looking at the real school.
          </p>
          <div className="mt-5 flex items-end justify-between">
            <p className="text-3xl font-bold tracking-tight">
              {money(price)}<span className="text-sm font-normal text-white/55"> / month</span>
            </p>
            {active ? (
              <p className="text-right text-[12px] text-white/60">
                Until {fmtDate(sub.expires_at)}<br />{daysLeft} day{daysLeft === 1 ? '' : 's'} left
              </p>
            ) : null}
          </div>
        </div>

        {/* Notice */}
        {notice ? (
          <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${NOTICE_STYLE[notice.tone]}`}>{notice.text}</div>
        ) : null}

        {/* Free month */}
        <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
          {!data.promo_granted ? (
            <>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-brand-navy"><Gift size={15} className="text-amber-600" /> One month free</p>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                When your school reaches 100 students and followers together, School Plus switches on free for 30 days, automatically.
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full bg-amber-500" style={{ width: `${promoPct}%` }} />
              </div>
              <p className="mt-1 text-[11px] text-gray-400">{people} of 100</p>
            </>
          ) : (
            <>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-brand-navy"><Gift size={15} className="text-amber-600" /> Free month received</p>
              <p className="mt-1 text-xs text-gray-500">Your school reached 100 students and followers, so you were given a free month.</p>
            </>
          )}
        </div>

        {/* Payment being confirmed (after leaving the page) */}
        {pending.length && !showPanel ? (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-gray-200 p-4">
            <Clock size={18} className="mt-0.5 shrink-0 text-brand-purple" />
            <div className="flex-1">
              <p className="text-sm font-semibold">Payment being confirmed</p>
              <p className="mt-0.5 text-xs text-gray-500">
                {pending.length === 1 ? 'One payment is' : `${pending.length} payments are`} waiting for confirmation.
              </p>
              {pendingId ? (
                <button onClick={checkAgain} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-purple">
                  <RefreshCw size={13} /> Check again
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Plan */}
        <p className="mb-2 mt-6 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">
          {active ? 'Add more time' : 'Choose a plan'}
        </p>
        <div className="grid grid-cols-4 gap-2">
          {PLANS.map((m) => {
            const on = months === m
            return (
              <button
                key={m}
                onClick={() => setMonths(m)}
                disabled={showPanel || busy}
                className={`rounded-2xl border py-3 text-center disabled:opacity-60 ${on ? 'border-brand-navy bg-brand-light' : 'border-gray-200 bg-white'}`}
              >
                <span className="block text-lg font-bold text-brand-navy">{m}</span>
                <span className="block text-[10px] text-gray-500">{m === 1 ? 'month' : 'months'}</span>
              </button>
            )
          })}
        </div>

        {/* Summary */}
        <div className="mt-3 flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-3">
          <span className="text-sm text-gray-600">School Plus, {months} month{months > 1 ? 's' : ''}</span>
          <span className="text-lg font-bold text-brand-navy">{totalText}</span>
        </div>

        {/* Payment */}
        {showPanel ? (
          <div className="mt-4 rounded-3xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <EcoCashLogo height={24} />
              <Pill tone={panel === 'waiting' ? 'amber' : 'gray'}>{panel === 'waiting' ? 'Waiting for PIN' : 'Not confirmed yet'}</Pill>
            </div>

            <p className="mt-4 text-[15px] font-semibold text-brand-navy">
              {panel === 'waiting' ? 'Enter your PIN on the prompt' : 'We have not confirmed the payment yet'}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {panel === 'waiting'
                ? `A prompt for ${sent.amount || totalText} goes to ${sent.number || 'your number'}. Enter your EcoCash PIN there.`
                : 'If you approved the prompt, it can take a moment. Check again below.'}
            </p>

            <ol className="mt-4 space-y-2.5 text-sm text-gray-600">
              <li className="flex gap-3"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-light text-[11px] font-semibold text-brand-navy">1</span>Look for the EcoCash prompt on your phone.</li>
              <li className="flex gap-3"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-light text-[11px] font-semibold text-brand-navy">2</span>Enter your EcoCash PIN and confirm.</li>
              <li className="flex gap-3"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-light text-[11px] font-semibold text-brand-navy">3</span>School Plus turns on here once it is confirmed.</li>
            </ol>

            {sent.instructions && panel === 'waiting' ? (
              <p className="mt-4 rounded-xl bg-gray-50 px-3 py-2.5 text-xs text-gray-500">{sent.instructions}</p>
            ) : null}

            <div className="mt-5 grid grid-cols-2 gap-2">
              {panel === 'waiting' ? (
                <button onClick={checkNow} className="flex items-center justify-center gap-1.5 rounded-xl bg-brand-navy py-3 text-sm font-semibold text-white">
                  <RefreshCw size={15} /> Check now
                </button>
              ) : (
                <button onClick={checkAgain} className="flex items-center justify-center gap-1.5 rounded-xl bg-brand-navy py-3 text-sm font-semibold text-white">
                  <RefreshCw size={15} /> Check again
                </button>
              )}
              <button onClick={cancelWaiting} className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-700">
                <X size={15} /> {panel === 'waiting' ? 'Cancel' : 'Close'}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-3xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <EcoCashLogo height={24} />
              <span className="flex items-center gap-1 text-[11px] font-medium text-gray-500"><Lock size={12} /> Secure</span>
            </div>

            <label className="mt-4 block text-xs font-semibold text-gray-500" htmlFor="ecocash-number">EcoCash number</label>
            <input
              id="ecocash-number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              autoComplete="tel"
              placeholder="0771234567"
              disabled={busy}
              className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-3 text-[15px] outline-none focus:border-brand-navy disabled:bg-gray-50"
            />
            <p className="mt-2 text-xs leading-relaxed text-gray-500">
              A prompt is sent to this number. Enter your EcoCash PIN on your phone to finish. Your PIN is never entered in Schoolink.
            </p>

            <button
              onClick={pay}
              disabled={busy || !phone.trim()}
              className="mt-4 w-full rounded-xl bg-brand-navy py-3.5 text-[15px] font-semibold text-white disabled:opacity-50"
            >
              {busy ? 'Sending request…' : `Pay ${totalText} with EcoCash`}
            </button>
          </div>
        )}

      {/* Payments */}
        {(data.payments || []).length ? (
          <>
            <p className="mb-2 mt-7 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">Payments</p>
            <div className="divide-y divide-gray-100 rounded-2xl border border-gray-200">
              {data.payments.map((p) => {
                const st = PAY_STATUS[p.status] || { tone: 'gray', label: p.status }
                return (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-brand-navy">
                        {money(p.amount)} · {p.months} month{p.months > 1 ? 's' : ''}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-gray-400">{fmtDate(p.created_at)} · EcoCash · {p.reference}</p>
                      {p.status === 'rejected' && p.reject_reason ? (
                        <p className="mt-1 text-xs text-red-500">{p.reject_reason}</p>
                      ) : null}
                    </div>
                    <Pill tone={st.tone}>{st.label}</Pill>
                  </div>
                )
              })}
            </div>
          </>
        ) : null}

        {data.settings?.note ? (
          <p className="mt-4 text-center text-xs text-gray-500">{data.settings.note}</p>
        ) : null}
      </div>
    </div>
  )
}
