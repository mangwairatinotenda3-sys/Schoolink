import { useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import ImageCropper from './ImageCropper.jsx'
import AvatarViewer from './AvatarViewer.jsx'

export default function AvatarUpload() {
  const { user, profile, saveProfileDetails } = useAuth()
  const fileInputRef = useRef(null)
  const [picked, setPicked] = useState(null)
  const [viewing, setViewing] = useState(false)
  const [error, setError] = useState('')

  // Step 1: choose a photo. Step 2: move and zoom it inside the circle. Step 3: Done saves it.
  function handleFileChange(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !user) return
    if (!file.type.startsWith('image/')) {
      setError('Please choose a photo.')
      return
    }
    setError('')
    setPicked(file)
  }

  async function saveCropped(blob) {
    const path = `${user.id}/avatar.jpg`
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, blob, { upsert: true, contentType: 'image/jpeg' })

    if (uploadError) {
      setError(uploadError.message)
      setPicked(null)
      return
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    await saveProfileDetails({ avatar_url: `${data.publicUrl}?t=${Date.now()}` })
    setPicked(null)
  }

  return (
    <div className="relative w-20 h-20">
      <button onClick={() => profile?.avatar_url && setViewing(true)} aria-label="View profile photo" className="block">
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="Profile" className="w-20 h-20 rounded-full object-cover" />
        ) : (
          <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-11 h-11 text-white/70" fill="currentColor" aria-hidden="true">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8z" />
            </svg>
          </div>
        )}
      </button>
      <button
        onClick={() => fileInputRef.current?.click()}
        aria-label="Change profile photo"
        className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-brand-purple flex items-center justify-center border-2 border-brand-navy"
      >
        <Camera size={14} className="text-white" />
      </button>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
      {error ? <p className="absolute top-full mt-1 text-[10px] text-red-300 w-40">{error}</p> : null}
      {picked ? <ImageCropper file={picked} round title="Move and zoom" onCancel={() => setPicked(null)} onDone={saveCropped} /> : null}
      {viewing ? <AvatarViewer imageUrl={profile?.avatar_url} onClose={() => setViewing(false)} /> : null}
    </div>
  )
    }
