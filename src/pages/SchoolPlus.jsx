import { useEffect, useRef, useState } from 'react'
import { Loader2, Check, Gift, Clock, Smartphone, BadgeCheck } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { PlusSeal, refreshPlusSchools } from '../components/SchoolPlusBadge.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { canManageStaff } from '../lib/permissions.js'

const POLL_EVERY_MS = 4000
const STOP_WAITING_AFTER_MS = 3 * 60 * 1000 // stop waiting after 3 minutes
const MAX_FAILED_CHECKS = 3                 // stop after 3 failed checks in a row

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function EcoCashLogo({ height = 30 }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <span className="inline-flex items-center gap-1.5 font-extrabold text-brand-navy">
        <Smartphone size={height} className="text-[#0072CE]" /> EcoCash
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

// Paid "School Plus" verification: $2.99 a month, only for the school profile.
export default function SchoolPlus() {
  const { profile } = useAuth()
  const schoolId = profile?.school_id
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [months, setMonths] = useState(1)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [phone, setPhone] = useState('')
  const [watchId, setWatchId] = useState(null)   // payment we are waiting on right now
  const [pendingId, setPendingId] = useState(null) // last payment started, for "Check again"
  const [pnNote, setPnNote] = useState('')
  const checking = useRef(false)

  async function load() {
    const { data: d, error: e } = await supabase.rpc('school_billing', { p_school: schoolId })
    if (e) { setError(e.message); return }
    setData(d)
    refreshPlusSchools(true)
  }

  useEffect(() => { if (schoolId) load() }, [schoolId])

  // Resume a payment that is still waiting (e.g. after coming back to this page)
  useEffect(() => {
    if (!data || watchId) return
    const waiting = (data.payments || []).find((p) => p.method === 'paynow' && p.status === 'pending' && Date.now() - new Date(p.created_at).getTime() < 30 * 60 * 1000)
    if (waiting) { setPendingId(waiting.id); setWatchId(waiting.id) }
  }, [data])

  // Ask the server every few seconds, but always give up in the end
  useEffect(() => {
    if (!watchId) return undefined
    let stopped = false
    let failures = 0
    const startedAt = Date.now()
    let timer = null

    function stop(text) {
      stopped = true
      if (timer) clearInterval(timer)
      setWatchId(null)
      setPnNote('')
      if (text) setMsg(text)
    }

    async function tick() {
      if (checking.current || stopped) return
      checking.current = true
      let res = null
      let err = null
      try {
        const out = await supabase.functions.invoke('paynow', { body: { action: 'check', paymentId: watchId } })
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
          stop('We could not check the payment just now. Tap "Check again" in a moment.')
        }
        return
      }
      failures = 0

      if (res.state === 'paid') {
        stop('Payment received. School Plus is now on. Thank you!')
        load()
      } else if (res.state === 'failed') {
        stop(res.error || 'The payment was cancelled. You were not charged.')
        load()
      } else if (Date.now() - startedAt > STOP_WAITING_AFTER_MS) {
        stop('No confirmation from EcoCash yet. If you approved the prompt, tap "Check again" in a moment.')
        load()
      }
    }

    tick()
    timer = setInterval(tick, POLL_EVERY_MS)
    const onVis = () => { if (document.visibilityState === 'visible') tick() }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      stopped = true
      if (timer) clearInterval(timer)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [watchId])

  if (!canManageStaff(profile)) {
    return (
      <div className="app-shell">
        <BackHeader title="School Plus" />
        <div className="screen-scroll px-6 flex items-center justify-center text-center text-gray-400">Only the headteacher or deputy head can manage School Plus.</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="app-shell">
        <BackHeader title="School Plus" />
        <div className="screen-scroll flex items-center justify-center text-gray-400 px-6 text-center">
          {error ? error : <Loader2 className="animate-spin" />}
        </div>
      </div>
    )
  }

  const price = Number(data.price || 2.99)
  const total = (price * months).toFixed(2)
  const sub = data.subscription
  const active = !!sub && new Date(sub.expires_at) > new Date()
  const daysLeft = active ? Math.max(1, Math.ceil((new Date(sub.expires_at) - Date.now()) / 86400000)) : 0
  const pending = (data.payments || []).filter((p) => p.status === 'pending')
  const people = data.counts?.total ?? 0

  async function payWithEcoCash() {
    setMsg('')
    setPnNote('')
    if (!/^(\+?263|0)?7[1-9]\d{7}$/.test(phone.replace(/\s/g, ''))) {
      setMsg('Enter your EcoCash number, e.g. 0771234567.')
      return
    }
    setBusy(true)
    const returnUrl = `${window.location.origin}${window.location.pathname}#/school-settings/verification`
    const { data: res, error: e } = await supabase.functions.invoke('paynow', { body: { action: 'start', months, phone, returnUrl } })
    setBusy(false)
    if (e || !res?.ok) {
      setMsg(res?.error || 'Could not start the payment. Please try again.')
      return
    }
    setPendingId(res.paymentId)
    setWatchId(res.paymentId)
    setPnNote(res.instructions || 'Check your phone. Enter your EcoCash PIN on the prompt to finish the payment.')
  }

  function checkAgain() {
    setMsg('')
    if (pendingId) setWatchId(pendingId)
  }

  return (
    <div className="app-shell">
      <BackHeader title="School Plus" />
      <div className="screen-scroll pb-10 px-4">
        <div className="rounded-3xl p-5 text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg,#241B4E 0%,#3b2a85 60%,#7a4a10 140%)' }}>
          <span className="absolute -right-8 -bottom-10 w-44 h-44 rounded-full border border-amber-300/20" />
          <span className="absolute -right-2 -bottom-4 w-28 h-28 rounded-full border border-amber-300/20" />
          <div className="flex items-center gap-2">
            <PlusSeal size={30} />
            <p className="text-xl font-extrabold tracking-tight">School Plus</p>
          </div>
          <p className="text-sm text-white/70 mt-2">A gold verified badge on your school profile, so parents and students know they are looking at the real school.</p>
          <p className="mt-4 text-3xl font-extrabold tracking-tight">${price.toFixed(2)}<span className="text-sm font-medium text-white/60"> / month</span></p>
          {active ? (
            <div className="mt-4 inline-flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1.5 text-xs font-semibold">
              <BadgeCheck size={14} className="text-amber-300" />
              {sub.is_promo ? 'Free month' : 'Active'} · until {fmtDate(sub.expires_at)} ({daysLeft} day{daysLeft === 1 ? '' : 's'})
            </div>
          ) : null}
        </div>

        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-800 flex items-center gap-1.5"><Gift size={15} /> Get it free for a month</p>
          <p className="text-xs text-amber-800/80 mt-1">
            {data.promo_granted
              ? 'Your school reached 100 students and followers, so you were given a free month.'
              : 'When your school reaches 100 students and followers together, School Plus switches on free for 30 days, automatically.'}
          </p>
          {!data.promo_granted ? (
            <>
              <div className="h-2 rounded-full bg-amber-200 mt-3 overflow-hidden"><div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min(100, people)}%` }} /></div>
              <p className="text-[11px] text-amber-800/70 mt-1">{people} / 100</p>
            </>
          ) : null}
        </div>

        {pending.length && !watchId ? (
          <div className="mt-4 rounded-2xl border border-gray-100 p-4 flex items-start gap-3">
            <Clock size={18} className="text-brand-purple mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold">Payment being checked</p>
              <p className="text-xs text-gray-500 mt-0.5">We are confirming {pending.length === 1 ? 'your payment' : `${pending.length} payments`}.</p>
              {pendingId ? <button onClick={checkAgain} className="mt-2 text-xs font-semibold text-brand-purple underline">Check again</button> : null}
            </div>
          </div>
        ) : null}

        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400 mt-6 mb-2 px-1">{active ? 'Add more time' : 'Get School Plus'}</p>
        <div className="grid grid-cols-4 gap-2">
          {[1, 3, 6, 12].map((m) => (
            <button key={m} onClick={() => setMonths(m)} className={`rounded-xl py-3 text-center border ${months === m ? 'border-brand-purple bg-brand-light' : 'border-gray-200'}`}>
              <span className="block text-base font-extrabold">{m}</span>
              <span className="block text-[10px] text-gray-500">{m === 1 ? 'month' : 'months'}</span>
            </button>
          ))}
        </div>
        <p className="text-center text-sm text-gray-500 mt-2">Total <span className="font-bold text-brand-navy">${total}</span> USD</p>

        <div className="mt-5 rounded-2xl border border-gray-100 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <EcoCashLogo height={30} />
            <div>
              <p className="text-sm font-semibold">Pay with EcoCash</p>
              <p className="text-xs text-gray-500">Enter your number, then approve with your PIN</p>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
            <span className="text-sm text-gray-500">Amount to pay</span>
            <span className="text-xl font-extrabold text-brand-navy">${total}</span>
          </div>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            placeholder="EcoCash number, e.g. 0771234567"
            disabled={!!watchId}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[15px] outline-none focus:border-brand-purple disabled:bg-gray-50"
          />
          <p className="text-xs text-gray-500">A prompt will pop up on this phone. Enter your EcoCash PIN there to finish.</p>

          <button
            onClick={payWithEcoCash}
            disabled={busy || !!watchId}
            className="w-full bg-brand-purple text-white font-semibold py-3.5 rounded-xl disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 size={18} className="animate-spin" /> : null}
            {busy ? 'Sending the prompt…' : watchId ? 'Waiting for your PIN…' : `Pay $${total}`}
          </button>

          {watchId ? (
            <div className="flex items-center justify-center gap-4 text-sm">
              <button onClick={() => { const id = watchId; setWatchId(null); setPendingId(id); load() }} className="text-brand-purple font-semibold underline">Stop waiting</button>
              <button onClick={checkAgain} className="text-brand-purple font-semibold underline">Check now</button>
            </div>
          ) : null}

          {pnNote ? <p className="text-sm text-brand-purple text-center">{pnNote}</p> : null}
          <p className="text-[11px] text-gray-400 text-center">Your PIN is only ever entered on your own phone.</p>
        </div>

        {s_note(data)}
        {msg ? <p className="text-sm text-center mt-3 text-brand-purple">{msg}</p> : null}

        {(data.payments || []).length ? (
          <>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400 mt-7 mb-2 px-1">Payments</p>
            <div className="rounded-2xl border border-gray-100 divide-y divide-gray-100">
              {data.payments.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">${Number(p.amount).toFixed(2)} · {p.months} month{p.months > 1 ? 's' : ''}</p>
                    <p className="text-xs text-gray-400 truncate">{fmtDate(p.created_at)} · EcoCash · {p.reference}</p>
                    {p.status === 'rejected' && p.reject_reason ? <p className="text-xs text-red-500 mt-0.5">{p.reject_reason}</p> : null}
                  </div>
                  <span className={`text-[11px] font-bold rounded-full px-2.5 py-1 ${p.status === 'approved' ? 'bg-green-50 text-green-600' : p.status === 'rejected' ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-600'}`}>
                    {p.status === 'approved' ? 'Paid' : p.status === 'rejected' ? 'Not paid' : 'Checking'}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

function s_note(data) {
  const note = data.settings?.note
  return note ? <p className="text-xs text-gray-500 mt-3 text-center">{note}</p> : null
    }
