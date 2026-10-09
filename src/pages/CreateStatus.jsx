import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Image as ImageIcon } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { isStaffMember } from '../lib/permissions.js'
import { containsProfanity } from '../lib/moderation.js'
import { STATUS_AUDIENCES, STATUS_BACKGROUNDS, STATUS_MAX_LENGTH, backgroundFor } from '../lib/statusUtils.js'

export default function CreateStatus() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const fileInputRef = useRef(null)

  const hasSchool = !!profile?.school_id
  const canStaffOnly = hasSchool && isStaffMember(profile)
  const audienceOptions = STATUS_AUDIENCES.filter((a) => {
    if (a.key === 'public') return true
    if (a.key === 'school_only') return hasSchool
    return canStaffOnly
  })

  const [content, setContent] = useState('')
  const [bg, setBg] = useState('theme')
  const [audience, setAudience] = useState(hasSchool ? 'school_only' : 'public')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  function removeImage() {
    setImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handlePost() {
    if (busy) return
    if (!content.trim() && !imageFile) return
    if (containsProfanity(content)) {
      setError("This contains language that isn't allowed on Schoolink. Please edit it and try again.")
      return
    }
    setBusy(true)
    setError('')

    let imageUrl = null
    if (imageFile) {
      const ext = imageFile.name.split('.').pop()
      const path = `${user.id}/status-${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('post-images').upload(path, imageFile)
      if (uploadError) {
        setError(uploadError.message)
        setBusy(false)
        return
      }
      const { data } = supabase.storage.from('post-images').getPublicUrl(path)
      imageUrl = data.publicUrl
    }

    const { error: insertError } = await supabase.from('statuses').insert({
      user_id: user.id,
      content: content.trim(),
      image_url: imageUrl,
      audience,
      school_id: profile?.school_id ?? null,
      bg_color: bg,
    })
    setBusy(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    navigate('/home')
  }

  const activeAudience = audienceOptions.find((a) => a.key === audience) || audienceOptions[0]

  return (
    <div className="app-shell">
      <BackHeader title="Add Status Update" />
      <div className="screen-scroll px-4 pt-3">
        <p className="text-xs text-gray-400 mb-2">Your update will disappear after 24 hours.</p>

        <div className="rounded-2xl overflow-hidden" style={{ background: backgroundFor(bg) }}>
          {imagePreview ? (
            <div className="relative px-4 pt-4">
              <img src={imagePreview} alt="Preview" className="w-full rounded-xl max-h-64 object-contain" />
              <button onClick={removeImage} className="absolute top-6 right-6 bg-black/60 rounded-full p-1.5">
                <X size={16} className="text-white" />
              </button>
            </div>
          ) : null}
          <textarea
            autoFocus
            value={content}
            maxLength={STATUS_MAX_LENGTH}
            onChange={(e) => setContent(e.target.value)}
            placeholder={imagePreview ? 'Add a caption…' : 'Type a status'}
            rows={imagePreview ? 2 : 7}
            style={{ background: 'transparent', color: '#fff' }}
            className={`w-full p-5 border-0 outline-none resize-none placeholder:!text-white/70 ${
              imagePreview ? 'text-base' : 'text-xl font-semibold text-center'
            }`}
          />
        </div>
        <p className="text-right text-xs text-gray-400 mt-1">{content.length}/{STATUS_MAX_LENGTH}</p>

        {!imagePreview ? (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="mt-2 w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500"
          >
            <ImageIcon size={18} /> Add a photo
          </button>
        ) : null}
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

        <p className="text-xs font-semibold text-gray-400 uppercase mt-5 mb-2">Background</p>
        <div className="flex gap-3 overflow-x-auto py-1 px-1">
          {STATUS_BACKGROUNDS.map((b) => (
            <button
              key={b.key}
              onClick={() => setBg(b.key)}
              aria-label={b.label}
              style={{ background: b.css }}
              className={`w-9 h-9 rounded-full shrink-0 ring-offset-2 ring-offset-[color:var(--shell-bg)] ${
                bg === b.key ? 'ring-2 ring-brand-purple' : ''
              }`}
            />
          ))}
        </div>

        <p className="text-xs font-semibold text-gray-400 uppercase mt-5 mb-2">Who can see this</p>
        <div className="flex gap-2 flex-wrap">
          {audienceOptions.map((a) => (
            <button
              key={a.key}
              onClick={() => setAudience(a.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                audience === a.key ? 'bg-brand-purple text-white border-brand-purple' : 'border-gray-200 text-gray-600'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
        {activeAudience ? <p className="text-xs text-gray-400 mt-2">{activeAudience.hint}</p> : null}

        {error ? <p className="text-red-500 text-sm mt-3">{error}</p> : null}

        <button
          onClick={handlePost}
          disabled={busy || (!content.trim() && !imageFile)}
          className="mt-4 w-full bg-brand-purple text-white font-medium py-3.5 rounded-xl disabled:opacity-60"
        >
          {busy ? 'Posting…' : 'Share Update'}
        </button>
      </div>
    </div>
  )
}
