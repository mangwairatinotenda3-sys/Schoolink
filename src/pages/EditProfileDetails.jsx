import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Camera, Check, Loader2, AtSign, MapPin, Link2, Plus, Lock, AlertCircle } from 'lucide-react'
import BottomSheet from '../components/BottomSheet.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useProfilePhotos } from '../lib/useProfilePhotos.jsx'

const BIO_MAX = 200
const MAX_LINKS = 5

function cleanUsername(v) {
  return v.trim().toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 20)
}

function linkOk(v) {
  const t = v.trim()
  if (!t) return true
  return /^(https?:\/\/)?[^\s/$.?#]+\.[^\s]{2,}$/i.test(t)
}

function Field({ label, hint, error, right, children }) {
  return (
    <div className="mt-5">
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-sm font-semibold">{label}</label>
        {right}
      </div>
      {children}
      {error ? <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1"><AlertCircle size={13} /> {error}</p> : hint ? <p className="text-xs text-gray-400 mt-1.5">{hint}</p> : null}
    </div>
  )
}

const inputClass = 'w-full border border-gray-200 rounded-xl px-4 py-3 text-[15px] outline-none focus:border-brand-purple bg-white'

export default function EditProfileDetails() {
  const navigate = useNavigate()
  const { user, profile, saveProfileDetails } = useAuth()
  const photos = useProfilePhotos()

  const initial = useMemo(() => {
    const existing = (profile?.links || '').split('\n').map((l) => l.trim()).filter(Boolean)
    return {
      username: profile?.username || '',
      bio: profile?.bio || '',
      location: profile?.location || '',
      links: [...existing, '', '', ''].slice(0, Math.max(3, existing.length)),
    }
  }, [profile?.id])

  const [username, setUsername] = useState(initial.username)
  const [bio, setBio] = useState(initial.bio)
  const [location, setLocation] = useState(initial.location)
  const [links, setLinks] = useState(initial.links)
  const [nameState, setNameState] = useState('idle') // idle | checking | free | taken | short
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [leaving, setLeaving] = useState(false)
  const checkRef = useRef(0)

  const cleanName = cleanUsername(username)
  const linkLines = links.map((l) => l.trim())
  const badLink = linkLines.findIndex((l) => !linkOk(l))
  const changed = cleanName !== (initial.username || '') || bio.trim() !== initial.bio.trim() || location.trim() !== initial.location.trim() || linkLines.filter(Boolean).join('\n') !== initial.links.filter(Boolean).join('\n')
  const canSave = changed && !saving && badLink === -1 && nameState !== 'taken' && nameState !== 'checking' && nameState !== 'short'

  // Is the username free? Checked a moment after you stop typing.
  useEffect(() => {
    if (!user) return undefined
    if (cleanName === (initial.username || '')) { setNameState('idle'); return undefined }
    if (cleanName === '') { setNameState('idle'); return undefined }
    if (cleanName.length < 3) { setNameState('short'); return undefined }
    setNameState('checking')
    const mine = ++checkRef.current
    const t = setTimeout(async () => {
      const { data } = await supabase.from('profiles').select('id').eq('username', cleanName).neq('id', user.id).maybeSingle()
      if (checkRef.current === mine) setNameState(data ? 'taken' : 'free')
    }, 450)
    return () => clearTimeout(t)
  }, [cleanName, user?.id])

  function requestBack() {
    if (changed && !saving) setLeaving(true)
    else navigate(-1)
  }

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    setError('')
    const normalised = linkLines.filter(Boolean).map((l) => (/^https?:\/\//i.test(l) ? l : `https://${l}`))
    const { error: saveError } = await saveProfileDetails({
      username: cleanName || null,
      bio: bio.trim(),
      location: location.trim(),
      links: normalised.join('\n'),
    })
    setSaving(false)
    if (saveError) {
      setError(saveError.message?.includes('duplicate') ? 'That username is already taken.' : saveError.message)
      return
    }
    navigate('/profile', { replace: true })
  }

  return (
    <div className="app-shell relative">
      {/* Header */}
      <div className="bg-white flex items-center justify-between px-3 shrink-0 border-b border-gray-100" style={{ height: 56 }}>
        <button onClick={requestBack} aria-label="Close" className="w-10 h-10 rounded-full flex items-center justify-center"><X size={22} /></button>
        <h1 className="font-semibold text-lg">Edit profile</h1>
        <button onClick={handleSave} disabled={!canSave} className="min-w-[64px] h-9 px-4 rounded-full bg-brand-purple text-white text-sm font-semibold disabled:opacity-35 flex items-center justify-center">
          {saving ? <Loader2 size={16} className="animate-spin" /> : 'Save'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ paddingBottom: 40 }}>
        {/* Photos */}
        <div className="relative">
          <button onClick={() => photos.pick('cover')} className="block w-full relative" style={{ aspectRatio: '3 / 1', minHeight: 120, background: 'linear-gradient(135deg, var(--brand-purple, #6C4CE0), #241B4E)' }}>
            {profile?.cover_url ? <img src={profile.cover_url} alt="" className="w-full h-full object-cover" /> : null}
            <span className="absolute inset-0 bg-black/20 flex items-center justify-center">
              <span className="flex items-center gap-1.5 bg-black/50 text-white text-xs font-medium rounded-full px-3 py-1.5"><Camera size={14} /> {profile?.cover_url ? 'Change cover' : 'Add cover'}</span>
            </span>
          </button>
          <div className="px-4" style={{ marginTop: -40 }}>
            <button onClick={() => photos.pick('avatar')} aria-label="Change profile photo" className="relative block rounded-full bg-white p-1 shadow-sm">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-[88px] h-[88px] rounded-full object-cover" />
              ) : (
                <span className="w-[88px] h-[88px] rounded-full bg-brand-light flex items-center justify-center text-3xl font-bold text-brand-purple">{(profile?.full_name || '?').slice(0, 1).toUpperCase()}</span>
              )}
              <span className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-brand-purple border-[3px] border-white flex items-center justify-center"><Camera size={14} className="text-white" /></span>
            </button>
          </div>
        </div>
        {photos.error ? <p className="mx-4 mt-3 text-sm text-red-500">{photos.error}</p> : null}

        <div className="px-4 pb-6">
          {/* Name and role come from the school */}
          <div className="mt-5 rounded-xl bg-gray-50 px-4 py-3 flex items-start gap-3">
            <Lock size={16} className="text-gray-400 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{profile?.full_name || 'Schoolink member'}{profile?.role ? <span className="font-normal text-gray-400"> · {profile.role}</span> : null}</p>
              <p className="text-xs text-gray-400 mt-0.5">Your name and role are set by your school and can't be changed here.</p>
            </div>
          </div>

          <Field
            label="Username"
            hint="3 to 20 letters, numbers, dots or underscores."
            error={nameState === 'taken' ? 'That username is already taken.' : nameState === 'short' ? 'Use at least 3 characters.' : ''}
            right={nameState === 'checking' ? <Loader2 size={15} className="animate-spin text-gray-400" /> : nameState === 'free' ? <span className="text-xs text-green-600 flex items-center gap-1"><Check size={14} strokeWidth={3} /> Available</span> : null}
          >
            <div className="relative">
              <AtSign size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="yourname" className={`${inputClass} pl-10`} />
            </div>
          </Field>

          <Field label="Bio" right={<span className={`text-xs ${bio.length > BIO_MAX - 20 ? 'text-amber-500' : 'text-gray-400'}`}>{bio.length}/{BIO_MAX}</span>}>
            <textarea value={bio} maxLength={BIO_MAX} onChange={(e) => setBio(e.target.value)} rows={4} placeholder="Tell people a bit about yourself…" className={`${inputClass} resize-none leading-relaxed`} />
          </Field>

          <Field label="Location">
            <div className="relative">
              <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Harare, Zimbabwe" className={`${inputClass} pl-10`} />
            </div>
          </Field>

          <Field label="Links" hint="Your website, portfolio or social pages.">
            <div className="space-y-2.5">
              {links.map((value, i) => (
                <div key={i}>
                  <div className="relative">
                    <Link2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={value} onChange={(e) => setLinks((prev) => prev.map((l, j) => (j === i ? e.target.value : l)))} inputMode="url" autoCapitalize="none" autoCorrect="off" placeholder="example.com" className={`${inputClass} pl-10 ${badLink === i ? '!border-red-400' : ''}`} />
                  </div>
                  {badLink === i ? <p className="text-xs text-red-500 mt-1">This doesn't look like a web address.</p> : null}
                </div>
              ))}
            </div>
            {links.length < MAX_LINKS ? (
              <button onClick={() => setLinks((prev) => [...prev, ''])} className="mt-3 flex items-center gap-1.5 text-sm font-medium text-brand-purple"><Plus size={16} /> Add another link</button>
            ) : null}
          </Field>

          {error ? <p className="text-sm text-red-500 mt-5 flex items-center gap-1.5"><AlertCircle size={15} /> {error}</p> : null}
        </div>
      </div>

      {leaving ? (
        <BottomSheet onClose={() => setLeaving(false)}>
          <p className="font-semibold text-lg px-4 pt-2">Discard changes?</p>
          <p className="text-sm text-gray-500 px-4 mt-1">What you changed hasn't been saved.</p>
          <button onClick={() => setLeaving(false)} className="w-[calc(100%-16px)] mx-2 mt-5 bg-brand-purple text-white font-semibold py-3.5 rounded-full">Keep editing</button>
          <button onClick={() => navigate(-1)} className="w-full mt-1 py-3.5 text-red-500 font-medium">Discard</button>
        </BottomSheet>
      ) : null}

      {photos.element}
    </div>
  )
    }
