import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Clock, X, BadgeCheck, School } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { hasSchool } from '../lib/permissions.js'

const BUCKET = 'id-verification'

// Shrinks phone photos and strips their metadata before upload.
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

function ReportPhoto({ label, slot, onPick, id }) {
  return (
    <div>
      <p className="text-sm font-medium mb-2">{label}</p>
      <label
        htmlFor={id}
        className="w-full border border-dashed border-gray-300 rounded-xl overflow-hidden flex items-center justify-center min-h-[140px] cursor-pointer"
      >
        {slot?.preview ? (
          <img src={slot.preview} alt={label} className="w-full max-h-64 object-contain" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-gray-400 text-sm py-8"><Camera size={26} /> Tap to add photo</span>
        )}
      </label>
      <input id={id} type="file" accept="image/*" onChange={onPick} className="hidden" />
    </div>
  )
}

function Skeleton() {
  return (
    <div className="px-6 pt-4 space-y-4 animate-pulse">
      <div className="h-4 w-3/4 rounded bg-gray-200" />
      <div className="h-4 w-1/2 rounded bg-gray-200" />
      <div className="h-36 rounded-xl bg-gray-200" />
      <div className="h-36 rounded-xl bg-gray-200" />
      <div className="h-12 rounded-xl bg-gray-200" />
    </div>
  )
}

export default function StudentVerification() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()

  const [loading, setLoading] = useState(true)
  const [verified, setVerified] = useState(false)
  const [latest, setLatest] = useState(null)
  const [front, setFront] = useState(null)
  const [back, setBack] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [user?.id])

  async function load() {
    if (!user) return
    setLoading(true)
    const [{ data: me }, { data: report }] = await Promise.all([
      supabase.from('profiles').select('student_verified, is_verified').eq('id', user.id).maybeSingle(),
      supabase
        .from('student_report_requests')
        .select('status, reject_reason, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])
    setVerified(!!me?.student_verified || !!me?.is_verified)
    setLatest(report ?? null)
    setLoading(false)
  }

  function pick(e, setSlot) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setSlot({ file, preview: URL.createObjectURL(file) })
  }

  async function submit() {
    setError('')
    if (!front || !back) { setError('Add a photo of the front and the back of your school report.'); return }
    if (!user) return
    setBusy(true)
    try {
      const [frontBlob, backBlob] = await Promise.all([compressImage(front.file), compressImage(back.file)])
      const stamp = Date.now()
      const frontPath = `${user.id}/report-front-${stamp}.jpg`
      const backPath = `${user.id}/report-back-${stamp}.jpg`

      const up1 = await supabase.storage.from(BUCKET).upload(frontPath, frontBlob, { contentType: 'image/jpeg', upsert: false })
      if (up1.error) throw up1.error
      const up2 = await supabase.storage.from(BUCKET).upload(backPath, backBlob, { contentType: 'image/jpeg', upsert: false })
      if (up2.error) throw up2.error

      const { error: insertError } = await supabase.from('student_report_requests').insert({
        user_id: user.id,
        school_id: profile?.school_id ?? null,
        front_path: frontPath,
        back_path: backPath,
      })
      if (insertError) throw insertError

      setFront(null)
      setBack(null)
      await load()
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    }
    setBusy(false)
  }

  const header = <BackHeader title="Verification" />

  if (loading) {
    return (
      <div className="app-shell">
        {header}
        <div className="screen-scroll"><Skeleton /></div>
      </div>
    )
  }

  if (verified) {
    return (
      <div className="app-shell">
        {header}
        <div className="screen-scroll px-6 flex flex-col items-center justify-center text-center gap-3 pt-10">
          <span className="w-16 h-16 rounded-full bg-sky-50 flex items-center justify-center"><BadgeCheck size={30} className="text-sky-500" /></span>
          <p className="font-semibold text-lg">You're verified</p>
          <p className="text-sm text-gray-500">Your blue tick shows on your profile and your posts.</p>
          <button onClick={() => navigate('/settings', { replace: true })} className="mt-4 bg-brand-purple text-white font-medium px-8 py-3 rounded-xl">Back to Settings</button>
        </div>
      </div>
    )
  }

  if (!hasSchool(profile)) {
    return (
      <div className="app-shell">
        {header}
        <div className="screen-scroll px-6 flex flex-col items-center justify-center text-center gap-3 pt-10">
          <span className="w-16 h-16 rounded-full bg-brand-light flex items-center justify-center"><School size={28} className="text-brand-purple" /></span>
          <p className="font-semibold text-lg">Find your school first</p>
          <p className="text-sm text-gray-500">Verification uses your school report, so choose your school before you send it.</p>
          <button onClick={() => navigate('/onboarding/choose-school')} className="mt-4 bg-brand-purple text-white font-medium px-8 py-3 rounded-xl">Find my school</button>
        </div>
      </div>
    )
  }

  if (latest?.status === 'pending') {
    return (
      <div className="app-shell">
        {header}
        <div className="screen-scroll px-6 flex flex-col items-center justify-center text-center gap-3 pt-10">
          <span className="w-16 h-16 rounded-full bg-brand-light flex items-center justify-center"><Clock size={28} className="text-brand-purple" /></span>
          <p className="font-semibold text-lg">Under review</p>
          <p className="text-sm text-gray-500">
            We received your school report{latest.created_at ? ` on ${new Date(latest.created_at).toLocaleDateString()}` : ''}. Our team will check it and give you a blue tick if it's accepted.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      {header}
      <div className="screen-scroll px-6 pt-3 pb-8">
        {latest?.status === 'rejected' ? (
          <div className="flex gap-2 bg-red-50 text-red-600 rounded-xl p-3 text-sm mb-4">
            <X size={18} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Your last report wasn't accepted</p>
              {latest.reject_reason ? <p className="mt-0.5">{latest.reject_reason}</p> : null}
              <p className="mt-0.5">Add a clearer photo below.</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 mb-5">
            Send photos of the front and back of your latest school report. Our team checks them and then gives you a blue tick.
          </p>
        )}

        <div className="space-y-5">
          <ReportPhoto id="report-front" label="1. Front of your school report" slot={front} onPick={(e) => pick(e, setFront)} />
          <ReportPhoto id="report-back" label="2. Back of your school report" slot={back} onPick={(e) => pick(e, setBack)} />
        </div>

        <p className="text-xs text-gray-400 mt-5">Photos are shrunk before upload. Only the Schoolink team can see them.</p>

        {error ? <p className="text-sm text-red-500 mt-4">{error}</p> : null}

        <button
          onClick={submit}
          disabled={busy}
          className="mt-6 w-full bg-brand-purple text-white font-semibold rounded-xl py-3.5 disabled:opacity-60"
        >
          {busy ? 'Sending…' : 'Send for verification'}
        </button>
      </div>
    </div>
  )
    }
