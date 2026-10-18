import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Camera, ArrowRight, Check, Loader2, Shield, X, Lock, Globe } from 'lucide-react'
import ScreenHeader from '../components/ScreenHeader.jsx'
import PersonAvatar from '../components/PersonAvatar.jsx'
import PeoplePicker from '../components/PeoplePicker.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

const CATEGORIES = ['School', 'Subject', 'Role']

function Label({ children }) {
  return <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2 mt-6">{children}</p>
}

function Chip({ active, onClick, children }) {
  return <button type="button" onClick={onClick} className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${active ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-600'}`}>{children}</button>
}

// Two steps, like making a WhatsApp group: first choose people, then name it. You become the admin.
export default function CreateCommunity() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { user, profile } = useAuth()
  const fileRef = useRef(null)

  const [step, setStep] = useState('people')
  const [selected, setSelected] = useState([])
  const [admins, setAdmins] = useState(new Set())
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [postingMode, setPostingMode] = useState('everyone')
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Started from a chat: the person you were talking to is already chosen
  const withId = params.get('with')
  useEffect(() => {
    if (!withId) return
    supabase.from('profiles').select('id, full_name, role, avatar_url, class_name, school_id, account_type').eq('id', withId).maybeSingle().then(({ data }) => {
      if (data) setSelected((prev) => (prev.some((p) => p.id === data.id) ? prev : [data, ...prev]))
    })
  }, [withId])

  useEffect(() => () => { if (avatarPreview) URL.revokeObjectURL(avatarPreview) }, [avatarPreview])

  function pickAvatar(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  function toggleAdmin(id) {
    setAdmins((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function dropPerson(id) {
    setSelected((prev) => prev.filter((p) => p.id !== id))
    setAdmins((prev) => { const next = new Set(prev); next.delete(id); return next })
  }

  async function create() {
    if (name.trim().length < 2 || saving) return
    setSaving(true)
    setError('')
    const ids = selected.map((p) => p.id)
    const { data, error: err } = await supabase.rpc('create_community', {
      p_name: name.trim(),
      p_description: description.trim(),
      p_category: category || null,
      p_private: isPrivate,
      p_posting: postingMode,
      p_members: ids,
      p_admins: ids.filter((id) => admins.has(id)),
    })
    if (err || !data?.ok) {
      setSaving(false)
      setError(err?.message || data?.error || 'Could not create the community. Try again.')
      return
    }

    // The picture can only be uploaded now that the community has an id
    if (avatarFile) {
      const ext = (avatarFile.name.split('.').pop() || 'jpg').toLowerCase()
      const path = `${data.id}/avatar.${ext}`
      const { error: upErr } = await supabase.storage.from('community-media').upload(path, avatarFile, { upsert: true })
      if (!upErr) {
        const { data: pub } = supabase.storage.from('community-media').getPublicUrl(path)
        await supabase.from('communities').update({ avatar_url: `${pub.publicUrl}?t=${Date.now()}` }).eq('id', data.id)
      }
    }
    setSaving(false)
    navigate(`/communities/${data.id}`, { replace: true })
  }

  const canCreate = name.trim().length >= 2 && !saving

  if (step === 'people') {
    return (      <div className="app-shell relative">
        <ScreenHeader title="New community" sub={selected.length ? `${selected.length} selected` : 'Add participants'} onBack={() => navigate(-1)} />
        <PeoplePicker meId={user?.id} schoolId={profile?.school_id} selected={selected} setSelected={setSelected} />
        <button onClick={() => setStep('info')} aria-label="Next" className="absolute right-5 w-14 h-14 rounded-full bg-brand-purple text-white shadow-lg flex items-center justify-center" style={{ bottom: 'max(24px, env(safe-area-inset-bottom))' }}>
          <ArrowRight size={24} />
        </button>
      </div>
    )
  }

  return (
    <div className="app-shell relative">
      <ScreenHeader title="New community" sub="Add details" onBack={() => setStep('people')} />
      <div className="flex-1 overflow-y-auto px-5 pb-28">
        <div className="flex items-center gap-4 pt-5">
          <button onClick={() => fileRef.current?.click()} className="relative shrink-0" aria-label="Add a picture">
            {avatarPreview ? (
              <img src={avatarPreview} alt="" className="w-20 h-20 rounded-full object-cover" />
            ) : (
              <span className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center"><Camera size={26} className="text-gray-400" /></span>
            )}
            <span className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-brand-purple flex items-center justify-center border-2 border-white"><Camera size={13} className="text-white" /></span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={pickAvatar} className="hidden" />
          <div className="flex-1 min-w-0">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Community name" className="w-full text-lg font-semibold pb-2 outline-none border-b-2 border-brand-purple placeholder:text-gray-300" />
            <p className="text-[11px] text-gray-400 text-right mt-1">{name.length}/80</p>
          </div>
        </div>

        <Label>Description</Label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={500} placeholder="What is this community about? (optional)" className="w-full bg-gray-100 rounded-xl px-4 py-3 text-[15px] outline-none resize-none" />

        <Label>Category</Label>
        <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <Chip active={!category} onClick={() => setCategory('')}>None</Chip>
          {CATEGORIES.map((c) => <Chip key={c} active={category === c} onClick={() => setCategory(c)}>{c}</Chip>)}
        </div>

        <Label>Who can join</Label>
        <div className="flex gap-2">
          <Chip active={!isPrivate} onClick={() => setIsPrivate(false)}><span className="inline-flex items-center gap-1.5"><Globe size={14} /> Anyone</span></Chip>
          <Chip active={isPrivate} onClick={() => setIsPrivate(true)}><span className="inline-flex items-center gap-1.5"><Lock size={14} /> Admins approve</span></Chip>
        </div>
        <p className="text-xs text-gray-400 mt-2">{isPrivate ? 'People ask to join and an admin decides.' : 'Anyone on Schoolink can find and join it.'}</p>

        <Label>Who can send messages</Label>
        <div className="flex gap-2">
          <Chip active={postingMode === 'everyone'} onClick={() => setPostingMode('everyone')}>Everyone</Chip>
          <Chip active={postingMode === 'approval'} onClick={() => setPostingMode('approval')}>Admins approve</Chip>
          <Chip active={postingMode === 'admins_only'} onClick={() => setPostingMode('admins_only')}>Only admins</Chip>
        </div>
        <p className="text-xs text-gray-400 mt-2">{postingMode === 'everyone' ? 'All members can post.' : postingMode === 'approval' ? 'Messages from members wait until an admin approves them.' : 'Everyone else can read but not post.'}</p>

        <Label>Participants · {selected.length + 1}</Label>
        <div className="rounded-2xl border border-gray-100 divide-y divide-gray-50">
          <div className="flex items-center gap-3 p-3">
            <PersonAvatar p={profile} size={42} />
            <span className="flex-1 min-w-0">
              <span className="block font-medium truncate">You</span>
              <span className="block text-xs text-gray-400">{profile?.role || 'Creator'}</span>
            </span>
            <span className="text-[11px] font-semibold text-brand-purple bg-brand-light rounded-full px-2.5 py-1">Admin</span>
          </div>
          {selected.map((p) => (
            <div key={p.id} className="flex items-center gap-3 p-3">
              <PersonAvatar p={p} size={42} />
              <span className="flex-1 min-w-0">
                <span className="block font-medium truncate">{p.full_name || 'Schoolink member'}</span>
                <span className="block text-xs text-gray-400 truncate">{p.role === 'Student' && p.class_name ? `Student · ${p.class_name}` : p.role || 'Member'}</span>
              </span>
              <button onClick={() => toggleAdmin(p.id)} aria-pressed={admins.has(p.id)} className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ${admins.has(p.id) ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-500'}`}>
                <Shield size={12} /> {admins.has(p.id) ? 'Admin' : 'Make admin'}
              </button>
              <button onClick={() => dropPerson(p.id)} aria-label={`Remove ${p.full_name}`} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 active:bg-gray-100"><X size={17} /></button>
            </div>
          ))}
        </div>
        <button onClick={() => setStep('people')} className="mt-3 text-sm font-semibold text-brand-purple">Add or change participants</button>

        {error ? <p className="text-sm text-red-500 mt-4">{error}</p> : null}
      </div>

      <button onClick={create} disabled={!canCreate} aria-label="Create community" className="absolute right-5 w-14 h-14 rounded-full bg-brand-purple text-white shadow-lg flex items-center justify-center disabled:opacity-40" style={{ bottom: 'max(24px, env(safe-area-inset-bottom))' }}>
        {saving ? <Loader2 size={22} className="animate-spin" /> : <Check size={26} />}
      </button>
    </div>
  )
            }
