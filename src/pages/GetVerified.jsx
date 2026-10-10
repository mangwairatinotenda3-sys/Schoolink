import { useEffect, useRef, useState } from 'react'
import { Camera, FileText, Clock, ShieldCheck, X } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import VerifiedBadge, { refreshVerifiedIds } from '../components/VerifiedBadge.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

const BUCKET = 'id-verification'

// Shrinks phone photos (often 5-10 MB) and strips their metadata before upload.
async function compressImage(file, maxSide = 1600, quality = 0.85) {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not process that image.'))),
      'image/jpeg',
      quality
    )
  })
}

export default function GetVerified() {
  const { user, profile } = useAuth()
  const idInputRef = useRef(null)
  const selfieInputRef = useRef(null)

  const [loading, setLoading] = useState(true)
  const [state, setState] = useState({ is_verified: false, verification_status: 'none' })
  const [lastRequest, setLastRequest] = useState(null)

  const [legalName, setLegalName] = useState(profile?.full_name || '')
  const [docType, setDocType] = useState('national_id')
  const [idFile, setIdFile] = useState(null)
  const [idPreview, setIdPreview] = useState(null)
  const [selfieFile, setSelfieFile] = useState(null)
  const [selfiePreview, setSelfiePreview] = useState(null)
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const isGuest = profile?.account_type === 'guest' || user?.is_anonymous

  useEffect(() => { load() }, [user?.id])

  async function load() {
    if (!user) return
    setLoading(true)
    const [{ data: p }, { data: req }] = await Promise.all([
      supabase.from('profiles').select('is_verified, verification_status, full_name').eq('id', user.id).maybeSingle(),
      supabase.from('verification_requests').select('status, reject_reason, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ])
    if (p) {
      setState({ is_verified: !!p.is_verified, verification_status: p.verification_status || 'none' })
      if (!legalName && p.full_name) setLegalName(p.full_name)
    }
    setLastRequest(req ?? null)
    await refreshVerifiedIds(true)
    setLoading(false)
  }

  function pick(e, setFile, setPreview) {
    const file = e.target.files?.[0]
    if (!file) return
    setFile(file)
    setPreview(URL.createObjectURL(file))
  }

  async function handleSubmit() {
    setError('')
    if (legalName.trim().length < 3) { setError('Enter your full name exactly as it appears on your ID.'); return }
    if (!idFile || !selfieFile) { setError('Add both your ID photo and a selfie.'); return }
    if (!consent) { setError('Please tick the confirmation box.'); return }

    setBusy(true)
    try {
      const [idBlob, selfieBlob] = await Promise.all([compressImage(idFile), compressImage(selfieFile)])
      const stamp = Date.now()
      const idPath = `${user.id}/${stamp}-id.jpg`
      const selfiePath = `${user.id}/${stamp}-selfie.jpg`

      const up1 = await supabase.storage.from(BUCKET).upload(idPath, idBlob, { contentType: 'image/jpeg', upsert: false })
      if (up1.error) throw up1.error
      const up2 = await supabase.storage.from(BUCKET).upload(selfiePath, selfieBlob, { contentType: 'image/jpeg', upsert: false })
      if (up2.error) throw up2.error

      const { error: rpcError } = await supabase.rpc('submit_verification', {
        p_legal_name: legalName.trim(),
        p_doc_type: docType,
        p_id_path: idPath,
        p_selfie_path: selfiePath,
      })
      if (rpcError) throw rpcError

      setIdFile(null); setIdPreview(null); setSelfieFile(null); setSelfiePreview(null); setConsent(false)
      await load()
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    }
    setBusy(false)
  }

  if (loading) {
    return (
      <div className="app-shell">
        <BackHeader title="Get Verified" />
        <div className="screen-scroll flex items-center justify-center text-gray-400">Loading…</div>
      </div>
    )
  }

  if (isGuest) {
    return (
      <div className="app-shell">
        <BackHeader title="Get Verified" />
        <div className="screen-scroll px-6 flex items-center justify-center text-center text-gray-400">
          Guest accounts can't be verified. Create a full account first.
        </div>
      </div>
    )
  }

  if (state.is_verified) {
    return (
      <div className="app-shell">
        <BackHeader title="Get Verified" />
        <div className="screen-scroll px-6 flex flex-col items-center justify-center text-center gap-3">
          <VerifiedBadge userId={user.id} size={64} />
          <p className="font-semibold text-lg">You're verified</p>
          <p className="text-sm text-gray-500">Your blue tick shows next to your name on your profile, posts and comments.</p>
        </div>
      </div>
    )
  }

  if (state.verification_status === 'pending') {
    return (
      <div className="app-shell">
        <BackHeader title="Get Verified" />
        <div className="screen-scroll px-6 flex flex-col items-center justify-center text-center gap-3">
          <span className="w-16 h-16 rounded-full bg-brand-light flex items-center justify-center"><Clock size={28} className="text-brand-purple" /></span>
          <p className="font-semibold text-lg">Under review</p>
          <p className="text-sm text-gray-500">
            We received your request{lastRequest?.created_at ? ` on ${new Date(lastRequest.created_at).toLocaleDateString()}` : ''}. A person on our team will check it. You'll see the result here.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <BackHeader title="Get Verified" />
      <div className="screen-scroll px-6 pt-3 pb-8">
        {state.verification_status === 'rejected' ? (
          <div className="flex gap-2 bg-red-50 text-red-600 rounded-xl p-3 text-sm mb-4">
            <X size={18} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Your last request wasn't approved</p>
              {lastRequest?.reject_reason ? <p className="mt-0.5">{lastRequest.reject_reason}</p> : null}
              <p className="mt-0.5">You can try again below.</p>
            </div>
          </div>
        ) : (
          <div className="flex gap-3 items-start mb-4">
            <ShieldCheck size={22} className="text-brand-purple shrink-0" />
            <p className="text-sm text-gray-500">Verify that you're a real person. After a team member checks your ID, a blue tick appears next to your name everywhere.</p>
          </div>
        )}

        <label className="text-sm font-medium mb-2 block">Full name (exactly as on your ID)</label>
        <input value={legalName} onChange={(e) => setLegalName(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-brand-purple" />

        <label className="text-sm font-medium mt-4 mb-2 block">Document type</label>
        <div className="flex gap-2">
          {[['national_id', 'National ID'], ['passport', 'Passport']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setDocType(key)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium border ${docType === key ? 'bg-brand-purple text-white border-brand-purple' : 'border-gray-200 text-gray-600'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <p className="text-sm font-medium mt-5 mb-2">1. Photo of your {docType === 'passport' ? 'passport photo page' : 'ID (front)'}</p>
        <button onClick={() => idInputRef.current?.click()} className="w-full border border-dashed border-gray-300 rounded-xl overflow-hidden flex items-center justify-center min-h-[120px]">
          {idPreview ? <img src={idPreview} alt="ID preview" className="w-full max-h-56 object-contain" /> : (
            <span className="flex flex-col items-center gap-1 text-gray-400 text-sm py-6"><FileText size={26} /> Tap to add photo</span>
          )}
        </button>
        <input ref={idInputRef} type="file" accept="image/*" onChange={(e) => pick(e, setIdFile, setIdPreview)} className="hidden" />

        <p className="text-sm font-medium mt-5 mb-2">2. A selfie of you</p>
        <button onClick={() => selfieInputRef.current?.click()} className="w-full border border-dashed border-gray-300 rounded-xl overflow-hidden flex items-center justify-center min-h-[120px]">
          {selfiePreview ? <img src={selfiePreview} alt="Selfie preview" className="w-full max-h-56 object-contain" /> : (
            <span className="flex flex-col items-center gap-1 text-gray-400 text-sm py-6"><Camera size={26} /> Tap to take a selfie</span>
          )}
        </button>
        <input ref={selfieInputRef} type="file" accept="image/*" capture="user" onChange={(e) => pick(e, setSelfieFile, setSelfiePreview)} className="hidden" />

        <ul className="text-xs text-gray-400 mt-4 list-disc pl-4 space-y-1">
          <li>All four corners of the document visible, text readable, no glare.</li>
          <li>Selfie: your face clearly visible, no filters or sunglasses.</li>
          <li>Your document must be valid (not expired).</li>
        </ul>

        <label className="flex items-start gap-2 text-xs text-gray-500 mt-4">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
          <span>This is my own ID. I understand Schoolink uses these images only to confirm my identity, and they're deleted once the review is finished.</span>
        </label>

        {error ? <p className="text-red-500 text-sm mt-3">{error}</p> : null}

        <button onClick={handleSubmit} disabled={busy} className="mt-5 w-full bg-brand-purple text-white font-medium py-3.5 rounded-xl disabled:opacity-60">
          {busy ? 'Uploading…' : 'Submit for review'}
        </button>
      </div>
    </div>
  )
}
