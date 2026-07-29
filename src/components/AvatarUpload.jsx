import { useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function AvatarUpload() {
  const { user, profile, saveProfileDetails } = useAuth()
  const fileInputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file || !user) return

    setUploading(true)
    setError('')

    const ext = file.name.split('.').pop()
    const path = `${user.id}/avatar.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      setError(uploadError.message)
      setUploading(false)
      return
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    const avatarUrl = `${data.publicUrl}?t=${Date.now()}`

    await saveProfileDetails({ avatar_url: avatarUrl })
    setUploading(false)
  }

  return (
    <div className="relative w-20 h-20">
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} alt="Profile" className="w-20 h-20 rounded-full object-cover" />
      ) : (
        <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-3xl">🙂</div>
      )}
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-brand-purple flex items-center justify-center border-2 border-brand-navy"
      >
        <Camera size={14} className="text-white" />
      </button>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
      {error ? <p className="absolute top-full mt-1 text-[10px] text-red-300 w-40">{error}</p> : null}
    </div>
  )
        }
