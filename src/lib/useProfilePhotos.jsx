import { useRef, useState } from 'react'
import { supabase } from './supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import ImageCropper from '../components/ImageCropper.jsx'

// Choosing, adjusting and saving the profile photo and the cover photo.
// Put `element` anywhere in your page; call pick('avatar') or pick('cover') to start.
export const COVER_ASPECT = 3

export function useProfilePhotos() {
  const { user, saveProfileDetails } = useAuth()
  const avatarInput = useRef(null)
  const coverInput = useRef(null)
  const [picked, setPicked] = useState(null)
  const [error, setError] = useState('')

  function pick(kind) {
    setError('')
    ;(kind === 'avatar' ? avatarInput : coverInput).current?.click()
  }

  function onFile(kind) {
    return (e) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file || !user) return
      if (!file.type.startsWith('image/')) {
        setError('Please choose a photo.')
        return
      }
      setPicked({ kind, file })
    }
  }

  async function save(blob) {
    const kind = picked.kind
    const bucket = kind === 'avatar' ? 'avatars' : 'covers'
    const path = `${user.id}/${kind}.jpg`
    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
    if (uploadError) {
      setError(uploadError.message)
      setPicked(null)
      return
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    const { error: saveError } = await saveProfileDetails({ [kind === 'avatar' ? 'avatar_url' : 'cover_url']: `${data.publicUrl}?t=${Date.now()}` })
    if (saveError) setError(saveError.message)
    setPicked(null)
  }

  async function remove(kind) {
    setError('')
    const { error: saveError } = await saveProfileDetails({ [kind === 'avatar' ? 'avatar_url' : 'cover_url']: null })
    if (saveError) setError(saveError.message)
  }

  const element = (
    <>
      <input ref={avatarInput} type="file" accept="image/*" onChange={onFile('avatar')} className="hidden" />
      <input ref={coverInput} type="file" accept="image/*" onChange={onFile('cover')} className="hidden" />
      {picked ? (
        <ImageCropper
          file={picked.file}
          round={picked.kind === 'avatar'}
          aspect={picked.kind === 'avatar' ? 1 : COVER_ASPECT}
          title={picked.kind === 'avatar' ? 'Move and zoom' : 'Adjust cover photo'}
          onCancel={() => setPicked(null)}
          onDone={save}
        />
      ) : null}
    </>
  )

  return { pick, remove, element, error, clearError: () => setError('') }
}
