import { useEffect, useRef, useState } from 'react'
import { FileText, Clock, ShieldCheck, X } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import VerifiedBadge, { refreshVerifiedIds } from '../components/VerifiedBadge.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

const BUCKET = 'id-verification'

// Shrinks phone photos (often 5-10 MB) and strips their metadata before upload.
async function compressImage(file, maxSide = 1800, quality = 0.88) {
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

export default function GetSchoolVerified() {
  const { user, profile } = useAuth()
  const docInputRef = useRef(null)

  const schoolId = profile?.school_id
  const isHead = profile?.role === 'Headteacher' && !!schoolId

  const [loading, setLoading] = useState(true)
  const [school, setSchool] = useState(null)
  const [lastRequest, setLastRequest] = useState(null)
  const [schoolName, setSchoolName] = useState('')
  const [docFile, setDocFile] = useState(null)
  const [docPreview, setDocPreview] = useState(null)
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [schoolId])

  async function load() {
    if (!schoolId) { setLoading(false); return }
    setLoading(true)
    const [{ data: s }, { data: req }] = await Promise.all([
      supabase.from('schools').select('id, name, verified, verification_status').eq('id', schoolId).maybeSingle(),
      supabase
        .from('verification_requests')
        .select('status, reject_reason, created_at')
        .eq('school_id', schoolId)
        .eq('subject_type', 'school')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])
    setSchool(s ?? null)
    if (s && !schoolName) setSchoolName(s.name || '')
    setLastRequest(req ?? null)
    await refreshVerifiedIds(true)
    setLoading(false)
  }

  function handlePick(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setDocFile(file)
    setDocPreview(URL.createObjectURL(file))
  }

  async function handleSubmit() {
    setError('')
    if (schoolName.trim().length < 3) { setError("Enter the school's registered name."); return }
    if (!docFile) { setError('Add a photo of your school registration document.'); return }
    if (!consent) { setError('Please tick the confirmation box.'); return }

    setBusy(true)
    try {
      const blob = await compressImage(docFile)
      const path = `${user.id}/${Date.now()}-school-doc.jpg`
      const up = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false })
      if (up.error) throw up.error

      const { error: rpcError } = await supabase.rpc('submit_school_verification', {
        p_school_id: schoolId,
        p_school_name: schoolName.trim(),
        p_doc_path: path,
      })
      if (rpcError) throw rpcError

      setDocFile(null); setDocPreview(null); setConsent(false)
      await load()
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    }
    setBusy(false)
  }

  const shell = (children, centered = true) => (
    <div className="app-shell">
      <BackHeader title="Verify Your School" />
      <div className={`screen-scroll px-6 ${centered ? 'flex flex-col items-center justify-center text-center gap-3' : 'pt-3 pb-8'}`}>
        {children}
      </div>
    </div>
  )

  if (loading) return shell(<p className="text-gray-400">Loading…</p>)

  if (!isHead) {
    return shell(<p className="text-gray-400">Only the Headteacher can request verification for a school.</p>)
  }

  if (school?.verified) {
    return shell(
      <>
        <VerifiedBadge schoolId={school.id} size={64} />
        <p className="font-semibold text-lg">{school.name} is verified</p>
        <p className="text-sm text-gray-500">The blue tick shows next to your school's name across Schoolink.</p>
      </>
    )
  }

  if (school?.verification_status === 'pending') {
    return shell(
      <>
        <span className="w-16 h-16 rounded-full bg-brand-light flex items-center justify-center"><Clock size={28} className="text-brand-purple" /></span>
        <p className="font-semibold text-lg">Under review</p>
        <p className="text-sm text-gray-500">
          We received your request{lastRequest?.created_at ? ` on ${new Date(lastRequest.created_at).toLocaleDateString()}` : ''}. A person on our team will check it. You'll see the result here.
        </p>
      </>
    )
  }

  return shell(
    <>
      <div className="w-full text-left">
        {school?.verification_status === 'rejected' ? (
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
            <p className="text-sm text-gray-500">Show that your school is real. After a team member checks your document, a blue tick appears next to your school's name.</p>
          </div>
        )}

        <label className="text-sm font-medium mb-2 block">School name (as on the document)</label>
        <input value={schoolName} onChange={(e) => setSchoolName(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-brand-purple" />

        <p className="text-sm font-medium mt-5 mb-2">Photo of your registration document</p>
        <p className="text-xs text-gray-400 mb-2">For example your Ministry of Education registration certificate or official registration letter.</p>
        <button onClick={() => docInputRef.current?.click()} className="w-full border border-dashed border-gray-300 rounded-xl overflow-hidden flex items-center justify-center min-h-[140px]">
          {docPreview ? <img src={docPreview} alt="Document preview" className="w-full max-h-64 object-contain" /> : (
            <span className="flex flex-col items-center gap-1 text-gray-400 text-sm py-6"><FileText size={26} /> Tap to add photo</span>
          )}
        </button>
        <input ref={docInputRef} type="file" accept="image/*" onChange={handlePick} className="hidden" />

        <ul className="text-xs text-gray-400 mt-4 list-disc pl-4 space-y-1">
          <li>The whole page visible, text readable, no glare.</li>
          <li>It must show the school's name and an official stamp or signature.</li>
        </ul>

        <label className="flex items-start gap-2 text-xs text-gray-500 mt-4">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
          <span>I am the Headteacher and I'm authorised to represent this school. I understand Schoolink uses this image only to confirm the school's identity, and it's deleted once the review is finished.</span>
        </label>

        {error ? <p className="text-red-500 text-sm mt-3">{error}</p> : null}

        <button onClick={handleSubmit} disabled={busy} className="mt-5 w-full bg-brand-purple text-white font-medium py-3.5 rounded-xl disabled:opacity-60">
          {busy ? 'Uploading…' : 'Submit for review'}
        </button>
      </div>
    </>,
    false
  )
  }
