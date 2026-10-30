import { useEffect, useRef, useState } from 'react'
import { BadgeCheck, Check, Clock, Upload, RefreshCw, X, Smartphone, Lock } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import MetaBadge from '../components/MetaBadge.jsx'
import { refreshVerifiedIds } from '../components/VerifiedBadge.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { canManageStaff } from '../lib/permissions.js'

const DOCS = [
  { type: 'registration_certificate', title: 'Ministry of Education certificate', hint: 'Registration certificate, photo or PDF', accept: 'image/jpeg,image/png,application/pdf' },
  { type: 'head_id', title: 'ID of person responsible', hint: 'National ID of the headteacher or owner, photo', accept: 'image/jpeg,image/png' },
  { type: 'proof_of_address', title: 'Utility bill or letter with school address', hint: 'Recent bill or letter showing the school address', accept: 'image/jpeg,image/png,application/pdf' },
  { type: 'school_logo', title: 'Clear logo for badge', hint: 'Your school logo, PNG or JPG', accept: 'image/png,image/jpeg' },
]

const BENEFITS = [
  'Appear higher in school search',
  'Publish results to parents',
  'Show parents you are the real school',
]

const PLANS = [1, 3, 6, 12]
const MAX_BYTES = 5 * 1024 * 1024
const PHONE_RE = /^(\+?263|0)?7[1-9]\d{7}$/
const POLL_MS = 4000
const WAIT_MS = 3 * 60 * 1000

const money = (n) => `$${Number(n).toFixed(2)}`
const fmtDate = (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

function Banner({ tone = 'info', children }) {
  const cls = {
    error: 'bg-red-50 text-red-600 border-red-100',
    ok: 'bg-green-50 text-green-700 border-green-100',
    info: 'bg-gray-50 text-gray-700 border-gray-200',
  }[tone]
  return <div role="alert" className={`mt-4 rounded-2xl border px-4 py-3 text-sm leading-relaxed ${cls}`}>{children}</div>
}

function SkeletonPage() {
  return (
    <div aria-busy="true" aria-label="Loading verification">
      <div className="mt-4 h-40 rounded-3xl bg-gray-200/70" />
      <div className="mt-4 h-16 rounded-2xl bg-gray-200/70" />
      <div className="mt-3 h-16 rounded-2xl bg-gray-200/70" />
      <div className="mt-3 h-16 rounded-2xl bg-gray-200/70" />
    </div>
  )
}

// Which screen to show, from the school's status
function viewFor(state, hasPending) {
  if (state.verified) return 'verified'
  switch (state.status) {
    case 'pending_review': return 'review'
    case 'approved':
    case 'expired': return hasPending ? 'waiting' : 'plan'
    case 'documents_pending':
    case 'rejected': return 'docs'
    default: return 'intro' // not_verified
  }
}

export default function GetSchoolVerified() {
  const { profile } = useAuth()
  const schoolId = profile?.school_id
  const allowed = canManageStaff(profile)

  const [s, setS] = useState(null)
  const [view, setView] = useState('loading')
  const [loadError, setLoadError] = useState('')
  const [notice, setNotice] = useState(null)
  const [busyType, setBusyType] = useState(null)
  const [months, setMonths] = useState(1)
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [payId, setPayId] = useState(null)
  const [watchKey, setWatchKey] = useState(null)
  const [pulse, setPulse] = useState(0)
  const [timedOut, setTimedOut] = useState(false)
  const [sentTo, setSentTo] = useState('')
  const fileRefs = useRef({})
  const checking = useRef(false)

  const docByType = Object.fromEntries((s?.documents || []).map((d) => [d.type, d]))
  const uploadedCount = DOCS.filter((d) => docByType[d.type]).length
  const price = Number(s?.price || 2.99)

  async function load() {
    setLoadError('')
    const { data, error } = await supabase.rpc('school_verification_state', { p_school: schoolId })
    if (error || !data?.ok) {
      setLoadError(error?.message || data?.error || 'Could not load verification.')
      return
    }
    setS(data)
    if (data.pending_payment_id) setPayId(data.pending_payment_id)
    setView(viewFor(data, !!data.pending_payment_id))
  }

  useEffect(() => { if (schoolId && allowed) load() }, [schoolId, allowed])

  // Checks the payment every few seconds, and always stops
  useEffect(() => {
    if (!watchKey) return undefined
    const id = watchKey
    let stopped = false
    let failures = 0
    let timer = null
    const startedAt = Date.now()

    const halt = () => {
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
        if (failures >= 3) {
          halt()
          setTimedOut(true)
          setNotice({ tone: 'error', text: 'We could not reach the payment server. Tap Check again.' })
        }
        return
      }
      failures = 0

      if (res.state === 'paid') {
        halt()
        setTimedOut(false)
        setNotice({ tone: 'ok', text: 'Payment received. Your school is verified.' })
        refreshVerifiedIds(true)
        load()
      } else if (res.state === 'failed') {
        halt()
        setTimedOut(false)
        setNotice({ tone: 'error', text: res.error || 'The payment was cancelled. You were not charged.' })
        load()
      } else if (Date.now() - startedAt > WAIT_MS) {
        halt()
        setTimedOut(true)
        setNotice({ tone: 'info', text: 'No confirmation yet. If you approved the prompt, tap Check again.' })
      }
    }

    tick()
    timer = setInterval(tick, POLL_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') tick() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stopped = true
      if (timer) clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [watchKey, pulse])

  async function uploadDoc(doc, file) {
    setNotice(null)
    if (!file) return
    if (!doc.accept.split(',').includes(file.type)) {
      setNotice({ tone: 'error', text: `${doc.title}: use ${doc.accept.includes('pdf') ? 'JPG, PNG or PDF' : 'JPG or PNG'}.` })
      return
    }
    if (file.size > MAX_BYTES) {
      setNotice({ tone: 'error', text: `${doc.title} is larger than 5 MB. Choose a smaller file.` })
      return
    }
    setBusyType(doc.type)
    const ext = (file.name.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '') || (file.type === 'application/pdf' ? 'pdf' : 'jpg')
    const path = `${schoolId}/${doc.type}-${Date.now()}.${ext}`
    const { error: upError } = await supabase.storage.from('verification-docs').upload(path, file, { contentType: file.type, upsert: false })
    if (upError) {
      setBusyType(null)
      setNotice({ tone: 'error', text: `Could not upload the file. ${upError.message}` })
      return
    }
    const { data: res, error } = await supabase.rpc('verification_add_document', { p_school: schoolId, p_type: doc.type, p_path: path })
    setBusyType(null)
    if (error || !res?.ok) {
      setNotice({ tone: 'error', text: res?.error || error?.message || 'Could not save the document.' })
      return
    }
    if (res.count === 4 && !res.still_rejected) {
      setNotice({ tone: 'ok', text: 'All 4 documents are in. The Schoolink team will review them, usually within 24 hours.' })
    }
    await load()
  }

  async function pay() {
    setNotice(null)
    const digits = phone.replace(/\s/g, '')
    if (!PHONE_RE.test(digits)) {
      setNotice({ tone: 'error', text: 'Enter a valid EcoCash number, for example 0771234567.' })
      return
    }
    setBusy(true)
    const returnUrl = `${window.location.origin}${window.location.pathname}#/school-settings/verification`
    const { data: res, error } = await supabase.functions.invoke('paynow', {
      body: { action: 'start', months, phone: digits, returnUrl },
    })
    setBusy(false)
    if (error || !res?.ok) {
      setNotice({ tone: 'error', text: res?.error || 'Could not send the request. Please try again.' })
      return
    }
    setSentTo(digits)
    setPayId(res.paymentId)
    setTimedOut(false)
    setView('waiting')
    setWatchKey(res.paymentId)
  }

  function checkAgain() {
    if (!payId) return
    setNotice(null)
    setTimedOut(false)
    setWatchKey(payId)
    setPulse((n) => n + 1)
  }

  if (!allowed) {
    return (
      <div className="app-shell">
        <BackHeader title="Verification" />
        <div className="screen-scroll px-6 flex items-center justify-center text-center text-gray-400">
          Only the headteacher or deputy head can get the school verified.
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <BackHeader title="Verification" />
      <div className="screen-scroll px-4 pb-12">
        {loadError ? (
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">{loadError}</p>
            <button onClick={load} className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-brand-purple px-5 py-2.5 text-sm font-semibold text-white">
              <RefreshCw size={15} /> Try again
            </button>
          </div>
        ) : !s ? (
          <SkeletonPage />
        ) : (
          <>
            {notice ? <Banner tone={notice.tone}>{notice.text}</Banner> : null}
            {view !== 'verified' && s.status === 'rejected' && s.rejection_reason ? (
              <Banner tone="error">
                <span className="font-semibold">Some documents need a new file.</span> {s.rejection_reason}
              </Banner>
            ) : null}

            {/* VERIFIED */}
            {view === 'verified' ? (
              <div className="mt-4 rounded-3xl border border-gray-200 bg-white p-6 text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-brand-light">
                  <MetaBadge size={44} />
                </div>
                <p className="mt-4 flex items-center justify-center gap-1.5 text-lg font-bold text-brand-navy">
                  {s.name} <BadgeCheck size={18} className="text-[#1877F2]" />
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {s.verified_until ? `Verified until ${fmtDate(s.verified_until)}` : 'Verified'}
                </p>
                {s.verified_until ? (
                  <button onClick={() => setView('plan')} className="mt-6 h-12 w-full rounded-2xl bg-brand-navy text-sm font-semibold text-white">
                    Renew verification
                  </button>
                ) : null}
              </div>
            ) : null}

            {/* INTRO */}
            {view === 'intro' ? (
              <div className="mt-4">
                <div className="rounded-3xl border border-gray-200 bg-white p-6">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-light">
                    <MetaBadge size={28} />
                  </span>
                  <p className="mt-4 text-xl font-bold text-brand-navy">Get the blue verified badge</p>
                  <p className="mt-1 text-sm text-gray-500">Show parents and students that your school is the real one.</p>
                  <ol className="mt-5 space-y-3 text-sm text-gray-700">
                    <li className="flex items-start gap-3"><span className="font-bold text-brand-purple">1.</span> Upload 4 documents</li>
                    <li className="flex items-start gap-3"><span className="font-bold text-brand-purple">2.</span> The Schoolink team reviews them</li>
                    <li className="flex items-start gap-3"><span className="font-bold text-brand-purple">3.</span> Pay {money(price)} a month with EcoCash once approved</li>
                  </ol>
                  <ul className="mt-5 space-y-3 border-t border-gray-100 pt-5">
                    {BENEFITS.map((b) => (
                      <li key={b} className="flex items-start gap-3 text-sm text-gray-700">
                        <Check size={16} className="mt-0.5 shrink-0 text-brand-purple" /> {b}
                      </li>
                    ))}
                  </ul>
                </div>
                <button onClick={() => setView('docs')} className="mt-4 h-14 w-full rounded-2xl bg-brand-purple text-[15px] font-semibold text-white">
                  Start verification
                </button>
              </div>
            ) : null}

            {/* DOCUMENTS */}
            {view === 'docs' ? (
              <div className="mt-4">
                <p className="text-sm font-semibold text-brand-navy">Upload 4 documents</p>
                <p className="mt-1 text-sm text-gray-500">JPG, PNG or PDF, up to 5 MB each. Only the Schoolink team sees them. Once all 4 are in, they go for review.</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-brand-purple" style={{ width: `${(uploadedCount / DOCS.length) * 100}%` }} />
                </div>
                <p className="mt-1.5 text-xs text-gray-400">{uploadedCount} of {DOCS.length} uploaded</p>

                <div className="mt-4 space-y-3">
                  {DOCS.map((d) => {
                    const doc = docByType[d.type]
                    const uploading = busyType === d.type
                    const approved = doc?.status === 'approved'
                    const rejected = doc?.status === 'rejected'
                    const icon = approved || (doc && !rejected) ? <Check size={18} /> : <Upload size={18} />
                    const iconCls = approved ? 'bg-green-50 text-green-600' : rejected ? 'bg-red-50 text-red-500' : doc ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-400'
                    const label = approved ? 'Approved' : rejected ? 'Needs a new file' : doc ? 'Waiting for review' : d.hint
                    return (
                      <div key={d.type} className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4">
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconCls}`}>{icon}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-brand-navy">{d.title}</p>
                          <p className={`mt-0.5 text-xs ${rejected ? 'text-red-600' : 'text-gray-500'}`}>{label}</p>
                          {rejected && doc?.note ? <p className="mt-1 text-xs text-red-600">{doc.note}</p> : null}
                        </div>
                        <input
                          ref={(el) => { fileRefs.current[d.type] = el }}
                          type="file"
                          accept={d.accept}
                          className="hidden"
                          onChange={(e) => { uploadDoc(d, e.target.files?.[0]); e.target.value = '' }}
                        />
                        {approved ? null : (
                          <button
                            onClick={() => fileRefs.current[d.type]?.click()}
                            disabled={uploading || busyType !== null}
                            className="shrink-0 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-brand-navy disabled:opacity-50"
                          >
                            {uploading ? 'Uploading…' : doc ? 'Replace' : 'Upload'}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : null}

            {/* PLAN AND PAY */}
            {view === 'plan' ? (
              <div className="mt-4">
                <p className="text-sm font-semibold text-brand-navy">
                  {s.status === 'expired' ? 'Renew your blue badge' : 'Documents approved'}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {s.status === 'expired'
                    ? 'Your verification has ended. Pay to turn the badge back on. Your documents are already approved.'
                    : 'Choose how long, then pay with EcoCash. The badge turns on as soon as the payment is confirmed.'}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  {PLANS.map((m) => {
                    const on = months === m
                    return (
                      <button
                        key={m}
                        onClick={() => setMonths(m)}
                        className={`rounded-2xl border bg-white p-4 text-left ${on ? 'border-brand-navy ring-4 ring-brand-navy/10' : 'border-gray-200'}`}
                      >
                        <span className="block text-base font-bold text-brand-navy">{m} {m === 1 ? 'month' : 'months'}</span>
                        <span className="mt-1 block text-sm text-gray-500">{money(price * m)}</span>
                      </button>
                    )
                  })}
                </div>

                <div className="mt-5 rounded-3xl border border-gray-200 bg-white p-5">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-brand-navy"><Smartphone size={16} /> EcoCash</span>
                    <span className="flex items-center gap-1 text-[11px] font-medium text-gray-500"><Lock size={12} /> Secure</span>
                  </div>
                  <label htmlFor="verify-phone" className="mt-4 block text-xs font-semibold text-gray-500">EcoCash number</label>
                  <input
                    id="verify-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="0771234567"
                    className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-3 text-[15px] outline-none focus:border-brand-navy"
                  />
                  <p className="mt-2 text-xs leading-relaxed text-gray-500">
                    A prompt goes to this number. Enter your EcoCash PIN on your phone. Your PIN is never entered in Schoolink.
                  </p>
                  <button
                    onClick={pay}
                    disabled={busy || !phone.trim()}
                    className="mt-4 h-14 w-full rounded-2xl bg-brand-purple text-[15px] font-semibold text-white disabled:opacity-50"
                  >
                    {busy ? 'Sending request…' : `Pay ${money(price * months)} with EcoCash`}
                  </button>
                </div>
              </div>
            ) : null}

                        {view === 'waiting' ? (
              <div className="mt-4 rounded-3xl border border-gray-200 bg-white p-5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-brand-navy"><Smartphone size={16} /> EcoCash</span>
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                    {watchKey ? 'Waiting for PIN' : 'Not confirmed yet'}
                  </span>
                </div>
                <p className="mt-4 text-[15px] font-semibold text-brand-navy">
                  {watchKey ? 'Enter your PIN on the prompt' : 'We have not confirmed the payment yet'}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {sentTo ? `The prompt goes to ${sentTo}.` : 'The prompt went to the number you entered.'} Once EcoCash confirms, your badge turns on here.
                </p>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button onClick={checkAgain} className="flex items-center justify-center gap-1.5 rounded-xl bg-brand-navy py-3 text-sm font-semibold text-white">
                    <RefreshCw size={15} /> {watchKey ? 'Check now' : 'Check again'}
                  </button>
                  <button
                    onClick={() => { setWatchKey(null); load() }}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-700"
                  >
                    <X size={15} /> {watchKey ? 'Cancel' : 'Back'}
                  </button>
                </div>
                {timedOut ? <p className="mt-3 text-center text-xs text-gray-500">Still no answer. Check again in a moment.</p> : null}
              </div>
            ) : null}

            {/* UNDER REVIEW */}
            {view === 'review' ? (
              <div className="mt-4">
                <div className="rounded-3xl border border-gray-200 bg-white p-6 text-center">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600"><Clock size={26} /></span>
                  <p className="mt-4 text-lg font-bold text-brand-navy">Under review</p>
                  <p className="mt-1 text-sm text-gray-500">
                    The Schoolink team is checking your documents, usually within 24 hours. You can pay as soon as they are approved.
                  </p>
                </div>
                <div className="mt-4 space-y-2">
                  {DOCS.map((d) => (
                    <div key={d.type} className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3">
                      <span className="text-sm text-brand-navy">{d.title}</span>
                      <span className="text-xs font-semibold text-amber-600">Waiting</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
                      }

