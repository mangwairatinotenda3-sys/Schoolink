import { useRef, useState } from 'react'
import { Image as ImageIcon, X, Video, FileText } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { isSchoolMember } from '../lib/permissions.js'

const categories = ['General', 'Announcement', 'Event', 'News', 'Sports Update', 'Photo']

export default function AddPost() {
  const navigate = useNavigate()
  const { profile, user, loading } = useAuth() // added loading
  const imageInputRef = useRef(null)
  const videoInputRef = useRef(null)
  const fileInputRef = useRef(null)

  const [content, setContent] = useState('')
  const [category, setCategory] = useState('General')

  // changed to arrays for multiple
  const [imageFiles, setImageFiles] = useState([])
  const [imagePreviews, setImagePreviews] = useState([])
  const [videoFile, setVideoFile] = useState(null)
  const [videoPreview, setVideoPreview] = useState(null)
  const [docFile, setDocFile] = useState(null)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // LOADING + AUTH GUARDS
  if (loading) {
    return (
      <div className="app-shell">
        <BackHeader title="Create Post" />
        <p className="text-center mt-10 text-gray-500">Loading...</p>
      </div>
    )
  }

  if (!user) {
    navigate('/login')
    return null
  }

  function handleImageChange(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setImageFiles(prev => [...prev,...files])
    const previews = files.map(file => URL.createObjectURL(file))
    setImagePreviews(prev => [...prev,...previews])
  }

  function removeImage(index) {
    setImageFiles(prev => prev.filter((_, i) => i!== index))
    setImagePreviews(prev => prev.filter((_, i) => i!== index))
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  function handleVideoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setVideoFile(file)
    setVideoPreview(URL.createObjectURL(file))
  }

  function removeVideo() {
    setVideoFile(null)
    setVideoPreview(null)
    if (videoInputRef.current) videoInputRef.current.value = ''
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setDocFile(file)
  }

  function removeDoc() {
    setDocFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function uploadFile(file, bucket) {
    const ext = file.name.split('.').pop()
    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file)
    if (uploadError) throw uploadError
    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    return data.publicUrl
  }

  async function handlePost() {
    if (!user) {
      setError("You need to be logged in")
      navigate('/login')
      return
    }
    if (!content.trim() &&!imageFiles.length &&!videoFile &&!docFile) return
    setBusy(true)
    setError('')

    try {
      // 1. Upload multiple images
      const imageUrls = []
      for (const file of imageFiles) {
        const url = await uploadFile(file, 'post-images')
        imageUrls.push(url)
      }

      // 2. Upload video
      let videoUrl = null
      if (videoFile) {
        videoUrl = await uploadFile(videoFile, 'post-videos')
      }

      // 3. Upload document
      let fileUrl = null
      if (docFile) {
        fileUrl = await uploadFile(docFile, 'post-files')
      }

      const { error: insertError } = await supabase.from('posts').insert({
        author_id: user.id,
        author_name: profile?.full_name || user.email,
        author_role: profile?.role || '',
        content,
        category,
        image_urls: imageUrls, // changed to array
        video_url: videoUrl,
        file_url: fileUrl,
        file_name: docFile?.name || null,
      })

      if (insertError) throw insertError
      navigate('/home')

    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!isSchoolMember(profile)) {
    return (
      <div className="app-shell">
        <BackHeader title="Create Post" />
        <div className="screen-scroll px-6 flex flex-col items-center justify-center text-center gap-4">
          <p className="text-gray-500">
            Only school staff members can post. Join a school with an invite code from Settings to unlock posting.
          </p>
          <button
            onClick={() => navigate('/settings')}
            className="bg-brand-purple text-white px-4 py-2 rounded-xl"
          >
            Go to Settings
          </button>
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
                category === c? 'bg-brand-purple text-white border-brand-purple' : 'border-gray-200 text-gray-600'
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
          className="w-full border-gray-200 rounded-xl p-4 outline-brand-purple resize-none mt-2"
        />

        {/* Image Previews Grid */}
        {imagePreviews.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mt-3">
            {imagePreviews.map((src, i) => (
              <div key={i} className="relative">
                <img src={src} alt="Preview" className="w-full h-24 rounded-xl object-cover" />
                <button
                  onClick={() => removeImage(i)}
                  className="absolute top-1 right-1 bg-black/60 rounded-full p-1"
                >
                  <X size={14} className="text-white" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Video Preview */}
        {videoPreview && (
          <div className="relative mt-3">
            <video src={videoPreview} controls className="w-full rounded-xl max-h-64" />
            <button
              onClick={removeVideo}
              className="absolute top-2 right-2 bg-black/60 rounded-full p-1.5"
            >
              <X size={16} className="text-white" />
            </button>
          </div>
        )}

        {/* File Preview */}
        {docFile && (
          <div className="flex items-center justify-between mt-3 border border-gray-200 rounded-xl p-3">
            <div className="flex items-center gap-2">
              <FileText size={18} />
              <span className="text-sm truncate">{docFile.name}</span>
            </div>
            <button onClick={removeDoc}><X size={16} /></button>
          </div>
        )}

        {/* Upload Buttons */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => imageInputRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500"
          >
            <ImageIcon size={18} />
            Add Photos
          </button>
          <button
            onClick={() => videoInputRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-2 border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500"
          >
            <Video size={18} />
            Add Video
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500"
          >
            <FileText size={18} />
            Add File
          </button>
        </div>

        <input ref={imageInputRef} type="file" accept="image/*" multiple onChange={handleImageChange} className="hidden" />
        <input ref={videoInputRef} type="file" accept="video/*" onChange={handleVideoChange} className="hidden" />
        <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" onChange={handleFileChange} className="hidden" />

        {error? <p className="text-red-500 text-sm mt-2">{error}</p> : null}

        <button
          onClick={handlePost}
          disabled={busy}
          className="mt-4 w-full bg-brand-purple text-white font-medium py-3.5 rounded-xl disabled:opacity-60"
        >
          {busy? 'Posting…' : 'Post'}
        </button>
      </div>
    </div>
  )
}
