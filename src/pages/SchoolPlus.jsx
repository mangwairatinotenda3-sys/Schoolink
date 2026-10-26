import { useEffect, useRef, useState } from 'react'
import { Loader2, Copy, Check, ExternalLink, Gift, Clock, Smartphone, CreditCard, Wallet, BadgeCheck, Zap } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { PlusSeal, refreshPlusSchools } from '../components/SchoolPlusBadge.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { canManageStaff } from '../lib/permissions.js'

const METHODS = [
  { key: 'paynow', label: 'Paynow', sub: 'EcoCash prompt or bank card', icon: Zap, color: '#0B8A4D' },
  { key: 'ecocash', label: 'EcoCash', sub: 'Send from your phone', icon: Smartphone, color: '#0072CE' },
  { key: 'paypal', label: 'PayPal', sub: 'Pay with PayPal', icon: Wallet, color: '#003087' },
  { key: 'stripe', label: 'Card', sub: 'Visa or Mastercard', icon: CreditCard, color: '#635BFF' },
]

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

// Paid "School Plus" verification: $2.99 a month, only for the school profile.
export default function SchoolPlus() {
  const { profile } = useAuth()
  const schoolId = profile?.school_id
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [months, setMonths] = useState(1)
  const [method, setMethod] = useState('')
  const [reference, setReference] = useState('')
  const [payer, setPayer] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const [pnMode, setPnMode] = useState('ecocash')
  const [phone, setPhone] = useState('')
  const [watchId, setWatchId] = useState(null)
  const [pnNote, setPnNote] = useState('')
  const checking = useRef(false)

  async function load() {
    const { data: d, error: e } = await supabase.rpc('school_billing', { p_school: schoolId })
    if (e) { setError(e.message); return }
    setData(d)
    refreshPlusSchools(true)
  }

  useEffect(() => { if (schoolId) load() }, [schoolId])

  // Resume watching a Paynow payment that is still waiting (e.g. after coming back from the Paynow page)
  useEffect(() => {
    if (!data || watchId) return
    const waiting = (data.payments || []).find((p) => p.method === 'paynow' && p.status === 'pending' && Date.now() - new Date(p.created_at).getTime() < 30 * 60 * 1000)
    if (waiting) setWatchId(waiting.id)
  }, [data])

  useEffect(() => {
    if (!watchId) return undefined
    let stopped = false
    async function tick() {
      if (checking.current || stopped) return
      checking.current = true
      const { data: res } = await supabase.functions.invoke('paynow', { body: { action: 'check', paymentId: watchId } })
      checking.current = false
      if (stopped || !res) return
      if (res.state === 'paid') {
        setWatchId(null)
        setPnNote('')
        setMsg('Payment received. School Plus is now on. Thank you!')
        load()
      } else if (res.state === 'failed') {
        setWatchId(null)
        setPnNote('')
        setMsg(res.error || 'The payment was cancelled. You were not charged.')
        load()
      }
    }
    tick()
    const t = setInterval(tick, 4000)
    const onVis = () => { if (document.visibilityState === 'visible') tick() }
    document.addEventListener('visibilitychange', onVis)
    const stopTimer = setTimeout(() => { setWatchId(null); setPnNote('') }, 10 * 60 * 1000)
    return () => { stopped = true; clearInterval(t); clearTimeout(stopTimer); document.removeEventListener('visibilitychange', onVis) }
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

  const s = data.settings || {}
  const price = Number(data.price || 2.99)
  const total = (price * months).toFixed(2)
  const sub = data.subscription
  const active = !!sub && new Date(sub.expires_at) > new Date()
  const daysLeft = active ? Math.max(1, Math.ceil((new Date(sub.expires_at) - Date.now()) / 86400000)) : 0
  const pending = (data.payments || []).filter((p) => p.status === 'pending' && p.method !== 'paynow')
  const available = METHODS.filter((m) => (m.key === 'paynow' ? s.paynow_enabled === 'yes' : m.key === 'ecocash' ? !!s.ecocash_number : m.key === 'paypal' ? !!s.paypal_link : !!s.stripe_link))
  const people = data.counts?.total ?? 0

  function openPay() {
    const url = method === 'paypal' ? s.paypal_link : s.stripe_link
    if (url) window.open(url, '_blank', 'noreferrer')
  }

  async function payWithPaynow() {
    setMsg('')
    setPnNote('')
    if (pnMode === 'ecocash' && !/^(\+?263|0)?7[1-9]\d{7}$/.test(phone.replace(/\s/g, ''))) {
      setMsg('Enter your EcoCash number, e.g. 0771234567.')
      return
    }
    setBusy(true)
    const returnUrl = `${window.location.origin}${window.location.pathname}#/school-settings/verification`
    const { data: res, error: e } = await supabase.functions.invoke('paynow', { body: { action: 'start', months, mode: pnMode, phone, returnUrl } })
    setBusy(false)
    if (e || !res?.ok) { setMsg(res?.error || 'Could not start the payment. Please try again.'); return }
    setWatchId(res.paymentId)
    if (res.redirect) {
      setPnNote('Finish paying on the Paynow page. We will switch School Plus on as soon as it goes through.')
      window.open(res.redirect, '_blank', 'noreferrer')
    } else {
      setPnNote(res.instructions || 'Check your phone and enter your EcoCash PIN to approve the payment.')
    }
  }

  async function copyNumber() {
    try { await navigator.clipboard.writeText(s.ecocash_number) } catch { /* ignore */ }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function submit() {
    setMsg('')
    setBusy(true)
    const { data: res, error: e } = await supabase.rpc('submit_school_payment', { p_method: method, p_months: months, p_reference: reference, p_payer: payer })
    setBusy(false)
    if (e || !res?.ok) { setMsg(e?.message || res?.error || 'Could not send.'); return }
    setReference('')
    setPayer('')
    setMethod('')
    setMsg('Thank you! We will confirm your payment shortly and switch School Plus on.')
    load()
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

        {pending.length ? (
          <div className="mt-4 rounded-2xl border border-gray-100 p-4 flex items-start gap-3">
            <Clock size={18} className="text-brand-purple mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Payment being checked</p>
              <p className="text-xs text-gray-500 mt-0.5">We are confirming {pending.length === 1 ? 'your payment' : `${pending.length} payments`}. This usually takes a few hours.</p>
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

        {available.length === 0 ? (
          <p className="text-sm text-gray-500 text-center mt-5 rounded-2xl bg-gray-50 p-4">Payments are not open yet. Please check back soon.</p>
        ) : (
          <>
            <div className="mt-4 space-y-2">
              {available.map((m) => {
                const Icon = m.icon
                return (
                  <button key={m.key} onClick={() => setMethod(m.key)} className={`w-full flex items-center gap-3 rounded-2xl border px-4 py-3 text-left ${method === m.key ? 'border-brand-purple bg-brand-light' : 'border-gray-200'}`}>
                    <span className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ background: m.color }}><Icon size={18} /></span>
                    <span className="flex-1"><span className="block text-sm font-semibold">{m.label}</span><span className="block text-xs text-gray-500">{m.sub}</span></span>
                    <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${method === m.key ? 'border-brand-purple bg-brand-purple' : 'border-gray-300'}`}>{method === m.key ? <Check size={12} className="text-white" strokeWidth={3} /> : null}</span>
                  </button>
                )
              })}
            </div>

            {method ? (
              <div className="mt-4 rounded-2xl border border-gray-100 p-4 space-y-3">
                {method === 'paynow' ? (
                  <>
                    <p className="text-sm text-gray-600">Pay <span className="font-bold text-brand-navy">${total} USD</span> and School Plus switches on by itself.</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[['ecocash', 'EcoCash prompt'], ['web', 'Card / other']].map(([k, label]) => (
                        <button key={k} onClick={() => setPnMode(k)} className={`rounded-xl py-2.5 text-sm font-semibold border ${pnMode === k ? 'border-brand-purple bg-brand-light text-brand-purple' : 'border-gray-200 text-gray-600'}`}>{label}</button>
                      ))}
                    </div>
                    {pnMode === 'ecocash' ? (
                      <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="Your EcoCash number, e.g. 0771234567" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[15px] outline-none focus:border-brand-purple" />
                    ) : (
                      <p className="text-xs text-gray-500">You will go to Paynow's secure page to pay with your card or wallet.</p>
                    )}
                    <button onClick={payWithPaynow} disabled={busy || !!watchId} className="w-full bg-brand-purple text-white font-semibold py-3.5 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
                      {busy || watchId ? <Loader2 size={18} className="animate-spin" /> : null}
                      {watchId ? 'Waiting for payment…' : `Pay $${total} now`}
                    </button>
                    {pnNote ? <p className="text-sm text-brand-purple text-center">{pnNote}</p> : null}
                  </>
                ) : null}
                {method === 'ecocash' ? (
                  <>
                    <p className="text-sm text-gray-600">1. Send <span className="font-bold text-brand-navy">${total} USD</span> by EcoCash to:</p>
                    <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                      <div>
                        <p className="text-lg font-extrabold tracking-wide">{s.ecocash_number}</p>
                        {s.ecocash_name ? <p className="text-xs text-gray-500">{s.ecocash_name}</p> : null}
                      </div>
                      <button onClick={copyNumber} className="text-brand-purple text-sm font-semibold flex items-center gap-1">{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? 'Copied' : 'Copy'}</button>
                    </div>
                  </>
                ) : method !== 'paynow' ? (
                  <>
                    <p className="text-sm text-gray-600">1. Pay <span className="font-bold text-brand-navy">${total} USD</span> with {method === 'paypal' ? 'PayPal' : 'your card'}:</p>
                    <button onClick={openPay} className="w-full flex items-center justify-center gap-2 bg-brand-navy text-white rounded-xl py-3 text-sm font-semibold"><ExternalLink size={15} /> Open {method === 'paypal' ? 'PayPal' : 'secure card payment'}</button>
                  </>
                ) : null}
                {method !== 'paynow' ? <>
                <p className="text-sm text-gray-600">2. Then type the {method === 'ecocash' ? 'EcoCash transaction ID' : method === 'paypal' ? 'PayPal transaction ID' : 'receipt number'} below.</p>
                <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Transaction reference" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[15px] outline-none focus:border-brand-purple" />
                <input value={payer} onChange={(e) => setPayer(e.target.value)} placeholder={method === 'ecocash' ? 'Name or number you paid from' : 'Name on the payment'} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[15px] outline-none focus:border-brand-purple" />
                <button onClick={submit} disabled={busy || reference.trim().length < 4} className="w-full bg-brand-purple text-white font-semibold py-3.5 rounded-xl disabled:opacity-50 flex items-center justify-center">
                  {busy ? <Loader2 size={18} className="animate-spin" /> : "I've paid"}
                </button>
                </> : null}
              </div>
            ) : null}
          </>
        )}

        {s.note ? <p className="text-xs text-gray-500 mt-3 text-center">{s.note}</p> : null}
        {msg ? <p className="text-sm text-center mt-3 text-brand-purple">{msg}</p> : null}

        {(data.payments || []).length ? (
          <>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400 mt-7 mb-2 px-1">Payments</p>
            <div className="rounded-2xl border border-gray-100 divide-y divide-gray-100">
              {data.payments.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">${Number(p.amount).toFixed(2)} · {p.months} month{p.months > 1 ? 's' : ''}</p>
                    <p className="text-xs text-gray-400 truncate">{fmtDate(p.created_at)} · {p.method === 'paynow' ? 'Paynow' : p.method} · {p.reference}</p>
                    {p.status === 'rejected' && p.reject_reason ? <p className="text-xs text-red-500 mt-0.5">{p.reject_reason}</p> : null}
                  </div>
                  <span className={`text-[11px] font-bold rounded-full px-2.5 py-1 ${p.status === 'approved' ? 'bg-green-50 text-green-600' : p.status === 'rejected' ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-600'}`}>
                    {p.status === 'approved' ? 'Paid' : p.status === 'rejected' ? 'Not found' : 'Checking'}
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
