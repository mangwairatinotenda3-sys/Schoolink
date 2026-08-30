import { useRef, useState } from 'react'
import { Image as ImageIcon, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { isSchoolMember } from '../lib/permissions.js'

const categories = ['General', 'Announcement', 'Event', 'News', 'Sports Update', 'Photo']

export default function AddPost() {
  const navigate = useNavigate()
  const { profile, user } = useAuth()
  const fileInputRef = useRef(null)

  const [content, setContent] = useState('')
  const [category, setCategory] = useState('General')
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
    if (!content.trim() && !imageFile) return
    setBusy(true)
    setError('')

    let imageUrl = null
    if (imageFile) {
      const ext = imageFile.name.split('.').pop()
      const path = `${user.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('post-images').upload(path, imageFile)
      if (uploadError) {
        setError(uploadError.message)
        setBusy(false)
        return
      }
      const { data } = supabase.storage.from('post-images').getPublicUrl(path)
      imageUrl = data.publicUrl
    }

    const { error: insertError } = await supabase.from('posts').insert({
      author_id: user.id,
      author_name: profile?.full_name || user.email,
      author_role: profile?.role || '',
      content,
      category,
      image_url: imageUrl,
    })
    setBusy(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    navigate('/home')
  }

  if (!isSchoolMember(profile)) {
    return (
      <div className="app-shell">
        <BackHeader title="Create Post" />
        <div className="screen-scroll px-6 flex flex-col items-center justify-center text-center gap-2">
          <p className="text-gray-500">
            Only school staff members can post. Join a school with an invite code from Settings to unlock posting.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <BackHeader title="Create Post" />
      <div className="screen-scroll px-4 pt-2">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border ${
                category === c ? 'bg-brand-purple text-white border-brand-purple' : 'border-gray-200 text-gray-600'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <textarea
          autoFocus
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What's on your mind?"
          rows={6}
          className="w-full border border-gray-200 rounded-xl p-4 outline-brand-purple resize-none mt-2"
        />

        {imagePreview ? (
          <div className="relative mt-3">
            <img src={imagePreview} alt="Preview" className="w-full rounded-xl max-h-64 object-cover" />
            <button
              onClick={removeImage}
              className="absolute top-2 right-2 bg-black/60 rounded-full p-1.5"
            >
              <X size={16} className="text-white" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="mt-3 w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500"
          >
            <ImageIcon size={18} />
            Add a photo
          </button>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

        {error ? <p className="text-red-500 text-sm mt-2">{error}</p> : null}

        <button
          onClick={handlePost}
          disabled={busy}
          className="mt-4 w-full bg-brand-purple text-white font-medium py-3.5 rounded-xl disabled:opacity-60"
        >
          {busy ? 'Posting…' : 'Post'}
        </button>
      </div>
    </div>
  )
  }
