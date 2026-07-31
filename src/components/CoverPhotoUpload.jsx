import { useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function CoverPhotoUpload() {
  const { user, profile, saveProfileDetails } = useAuth()
  const fileInputRef = useRef(null)
  const [uploading, setUploading] = useState(false)

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setUploading(true)

    const ext = file.name.split('.').pop()
    const path = `${user.id}/cover.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('covers')
      .upload(path, file, { upsert: true })

    if (!uploadError) {
      const { data } = supabase.storage.from('covers').getPublicUrl(path)
      await saveProfileDetails({ cover_url: `${data.publicUrl}?t=${Date.now()}` })
    }
    setUploading(false)
  }

  return (
    <div className="relative w-full h-40 bg-gradient-to-br from-brand-purple to-brand-navy">
      {profile?.cover_url ? (
        <img src={profile.cover_url} alt="" className="w-full h-full object-cover" />
      ) : null}
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="absolute bottom-3 right-3 w-9 h-9 rounded-full bg-black/40 flex items-center justify-center"
      >
        <Camera size={16} className="text-white" />
      </button>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
    </div>
  )
}
