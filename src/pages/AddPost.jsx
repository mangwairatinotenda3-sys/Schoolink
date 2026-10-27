import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import {
  X, Image as ImageIcon, Video, FileText, Plus, Play, AlertCircle, Loader2, Smile, Hash, MapPin, Eye, MessageCircle, Star,
} from 'lucide-react'
import Switch from '../components/Switch.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { isSchoolMember } from '../lib/permissions.js'
import { containsProfanity } from '../lib/moderation.js'
import { uploadWithProgress } from '../lib/uploadWithProgress.js'
import { prepareImage, videoInfo, formatSize, formatDuration, fileExtension, safeFileName } from '../lib/mediaTools.js'

const CATEGORIES = [
  { key: 'General', icon: '💬', starters: ['Good morning everyone! ☀️', 'So proud of our learners today 👏', 'A quick reminder: '] },
  { key: 'Announcement', icon: '📢', starters: ['📢 Notice to all parents and guardians: ', '📢 School will close early on ', '📢 Reminder: fees are due by '] },
  { key: 'Event', icon: '📅', starters: ['📅 Join us on ', 'Save the date! ', 'We are hosting '] },
  { key: 'News', icon: '📰', starters: ['📰 News from school: ', 'Congratulations to ', 'This week at school: '] },
  { key: 'Sports Update', icon: '⚽', starters: ['⚽ Match day! ', 'Final score: ', 'Training starts at '] },
  { key: 'Photo', icon: '📷', starters: ['Moments from today 📷', 'Throwback to ', 'Look at this! '] },
]

const MODES = {
  photo: { category: 'Photo', title: 'Add photos', hint: 'Pick up to 10 photos from your phone.', icon: ImageIcon },
  video: { category: 'General', title: 'Add a video', hint: 'Videos can be up to 50 MB.', icon: Video },
  file: { category: 'General', title: 'Share a file', hint: 'PDF, Word, Excel, PowerPoint, text or CSV.', icon: FileText },
  announcement: { category: 'Announcement' },
}

const EMOJIS = [
  '😀', '😂', '🥰', '😍', '😎', '🤩', '😊', '😇', '🙏', '👏', '🙌', '👍', '💪', '❤️', '💜', '🔥',
  '✨', '🎉', '🎊', '🏆', '🥇', '⚽', '🏀', '🏏', '📚', '✏️', '🎓', '🏫', '📢', '📅', '⏰', '📍',
  '🌟', '💯', '👀', '🤝', '😢', '😮', '🥳', '🎂', '🍎', '🚌', '🎶', '🖼️', '📷', '🎨', '🔬', '💡',
]

const MAX_PHOTOS = 10
const MAX_PHOTO_MB = 25
const MAX_VIDEO_MB = 50
const MAX_DOC_MB = 25
const MAX_TEXT = 2000
const DOC_TYPES = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv'

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export default function AddPost() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const mode = MODES[params.get('mode')] ? params.get('mode') : ''
  const { profile, user, loading } = useAuth()
  const photoInputRef = useRef(null)
  const videoInputRef = useRef(null)
  const docInputRef = useRef(null)
  const textRef = useRef(null)
  const abortRef = useRef(null)
  const uploadedRef = useRef(new Map())
  const draftKey = `schoolink_post_draft_${user?.id || 'x'}`

  const [content, setContent] = useState('')
  const [category, setCategory] = useState(MODES[mode]?.category || 'General')
  const [photos, setPhotos] = useState([])
  const [video, setVideo] = useState(null)
  const [doc, setDoc] = useState(null)
  const [location, setLocation] = useState('')
  const [showLocation, setShowLocation] = useState(false)
  const [commentsOn, setCommentsOn] = useState(true)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [preview, setPreview] = useState(false)
  const [leaveAsk, setLeaveAsk] = useState(false)
  const [posting, setPosting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // A half-written post is kept, so leaving the screen never loses your words.
  useEffect(() => {
    if (!user) return
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey) || 'null')
      if (saved) {
        setContent(saved.content || '')
        if (saved.category && !mode) setCategory(saved.category)
        if (saved.location) { setLocation(saved.location); setShowLocation(true) }
        if (saved.commentsOn === false) setCommentsOn(false)
      }
    } catch {
      // ignore
    }
  }, [user?.id])

  useEffect(() => {
    if (!user) return
    try {
      if (content.trim()) localStorage.setItem(draftKey, JSON.stringify({ content, category, location, commentsOn }))
      else localStorage.removeItem(draftKey)
    } catch {
      // ignore
    }
  }, [content, category, location, commentsOn])

  // The text box grows as you type.
  useEffect(() => {
    const el = textRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(96, el.scrollHeight)}px`
  }, [content])

  useEffect(() => {
    if (!notice) return undefined
    const t = setTimeout(() => setNotice(''), 3200)
    return () => clearTimeout(t)
  }, [notice])

  if (loading) {
    return (
      <div className="app-shell items-center justify-center">
        <Loader2 className="animate-spin text-brand-purple" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />

  if (!isSchoolMember(profile)) {
    return (
      <div className="app-shell">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <button onClick={() => navigate(-1)} aria-label="Close"><X size={22} /></button>
          <p className="font-semibold">New post</p>
        </div>
        <div className="screen-scroll px-8 flex flex-col items-center justify-center text-center gap-4">
          <span className="w-16 h-16 rounded-full bg-brand-light flex items-center justify-center text-3xl">🏫</span>
          <p className="font-semibold">Posting is for school members</p>
          <p className="text-sm text-gray-500">Join your school with an invite code from Settings to share posts with your school community.</p>
          <button onClick={() => navigate('/settings')} className="bg-brand-purple text-white font-medium px-6 py-3 rounded-full">Go to Settings</button>
        </div>
      </div>
    )
  }

  const hasAnything = !!(content.trim() || photos.length || video || doc)
  const activeCategory = CATEGORIES.find((c) => c.key === category) || CATEGORIES[0]
  const modeInfo = MODES[mode]
  const showDrop = !!modeInfo?.title && !photos.length && !video && !doc

  function insertAtCursor(text) {
    const el = textRef.current
    const start = el?.selectionStart ?? content.length
    const end = el?.selectionEnd ?? start
    const next = content.slice(0, start) + text + content.slice(end)
    if (next.length > MAX_TEXT) return
    setContent(next)
    requestAnimationFrame(() => {
      if (!el) return
      el.focus()
      const pos = start + text.length
      el.setSelectionRange(pos, pos)
    })
  }

  function addPhotos(e) {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (!files.length) return
    const room = MAX_PHOTOS - photos.length
    const accepted = []
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue
      if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
        setNotice(`${file.name} is bigger than ${MAX_PHOTO_MB} MB.`)
        continue
      }
      if (accepted.length >= room) {
        setNotice(`You can add up to ${MAX_PHOTOS} photos.`)
        break
      }
      accepted.push({ id: newId(), file, url: URL.createObjectURL(file) })
    }
    if (accepted.length) {
      setPhotos((prev) => [...prev, ...accepted])
      setError('')
    }
  }

  function removePhoto(id) {
    setPhotos((prev) => {
      const gone = prev.find((p) => p.id === id)
      if (gone) URL.revokeObjectURL(gone.url)
      return prev.filter((p) => p.id !== id)
    })
    uploadedRef.current.delete(id)
  }

  function makeCover(id) {
    setPhotos((prev) => {
      const pick = prev.find((p) => p.id === id)
      if (!pick) return prev
      return [pick, ...prev.filter((p) => p.id !== id)]
    })
  }

  async function addVideo(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('video/')) {
      setNotice('Please choose a video.')
      return
    }
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      setNotice(`Videos can be up to ${MAX_VIDEO_MB} MB. Yours is ${formatSize(file.size)}.`)
      return
    }
    const url = URL.createObjectURL(file)
    const item = { id: newId(), file, url, poster: null, duration: 0, ready: false }
    if (video) URL.revokeObjectURL(video.url)
    setVideo(item)
    setError('')
    const info = await videoInfo(url)
    setVideo((current) => (current && current.id === item.id ? { ...current, poster: info.poster, duration: info.duration, ready: true } : current))
  }

  function removeVideo() {
    if (video) {
      URL.revokeObjectURL(video.url)
      uploadedRef.current.delete(video.id)
    }
    setVideo(null)
  }

  function addDoc(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > MAX_DOC_MB * 1024 * 1024) {
      setNotice(`Files can be up to ${MAX_DOC_MB} MB.`)
      return
    }
    if (doc) uploadedRef.current.delete(doc.id)
    setDoc({ id: newId(), file })
    setError('')
  }

  function removeDoc() {
    if (doc) uploadedRef.current.delete(doc.id)
    setDoc(null)
  }

  function requestClose() {
    if (posting) return
    if (hasAnything) setLeaveAsk(true)
    else navigate(-1)
  }

  function discardAndLeave() {
    try {
      localStorage.removeItem(draftKey)
    } catch {
      // ignore
    }
    photos.forEach((p) => URL.revokeObjectURL(p.url))
    if (video) URL.revokeObjectURL(video.url)
    navigate(-1)
  }

  function cancelPosting() {
    abortRef.current?.abort()
  }

  async function handlePost() {
    if (posting || !hasAnything) return
    if (containsProfanity(content)) {
      setError("This contains language that isn't allowed on Schoolink. Please edit it and try again.")
      return
    }
    setError('')
    setPosting(true)
    setProgress(0)
    const controller = new AbortController()
    abortRef.current = controller

    try {
      // Prepare everything first so progress covers the real amount of data.
      setStage('Getting your photos ready…')
      const jobs = []
      for (const p of photos) {
        const file = uploadedRef.current.has(p.id) ? p.file : await prepareImage(p.file)
        jobs.push({ id: p.id, file, bucket: 'post-images', kind: 'photo' })
      }
      if (video) jobs.push({ id: video.id, file: video.file, bucket: 'post-videos', kind: 'video' })
      if (doc) jobs.push({ id: doc.id, file: doc.file, bucket: 'post-files', kind: 'file' })

      const pending = jobs.filter((j) => !uploadedRef.current.has(j.id))
      const totalBytes = pending.reduce((sum, j) => sum + j.file.size, 0) || 1
      let doneBytes = 0
      let step = 0

      for (const job of pending) {
        step += 1
        const label = job.kind === 'photo' ? 'photo' : job.kind === 'video' ? 'video' : 'file'
        setStage(pending.length > 1 ? `Uploading ${label} (${step} of ${pending.length})` : `Uploading ${label}`)
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${safeFileName(job.file.name)}`
        const url = await uploadWithProgress({
          bucket: job.bucket,
          path,
          file: job.file,
          signal: controller.signal,
          onProgress: (_, loaded) => setProgress(Math.min(99, Math.round(((doneBytes + loaded) / totalBytes) * 100))),
        })
        doneBytes += job.file.size
        uploadedRef.current.set(job.id, url)
      }

      setStage('Posting…')
      setProgress(100)
      const imageUrls = photos.map((p) => uploadedRef.current.get(p.id)).filter(Boolean)
      const row = {
        author_id: user.id,
        author_name: profile?.full_name || user.email,
        author_role: profile?.role || '',
        content: content.trim(),
        category,
        image_urls: imageUrls,
        video_url: video ? uploadedRef.current.get(video.id) || null : null,
        file_url: doc ? uploadedRef.current.get(doc.id) || null : null,
        file_name: doc?.file.name || null,
      }
      const extras = { comments_off: !commentsOn, location: location.trim() || null }
      let { error: insertError } = await supabase.from('posts').insert({ ...row, ...extras })
      // The new post options need the updates SQL. Until it is run, post without them instead of failing.
      if (insertError && /comments_off|location|column/i.test(insertError.message || '')) {
        ;({ error: insertError } = await supabase.from('posts').insert(row))
      }
      if (insertError) throw insertError

      try {
        localStorage.removeItem(draftKey)
      } catch {
        // ignore
      }
      navigate('/home', { replace: true })
    } catch (err) {
      if (err?.name === 'AbortError') setError('Posting cancelled. Nothing was shared.')
      else setError(`${err?.message || 'Something went wrong.'} Tap Post to try again — what already uploaded won't be sent twice.`)
    } finally {
      setPosting(false)
      abortRef.current = null
    }
  }

  const over = content.length > MAX_TEXT * 0.85
  const tiles = photos.length

  return (
    <div className="app-shell">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
        <button onClick={requestClose} aria-label="Close" className="w-9 h-9 -ml-2 rounded-full flex items-center justify-center"><X size={22} /></button>
        <p className="font-semibold">New post</p>
        <button
          onClick={handlePost}
          disabled={!hasAnything || posting}
          className="bg-brand-purple text-white text-sm font-semibold rounded-full px-5 py-1.5 disabled:opacity-40"
        >
          Post
        </button>
      </div>

      <div className="screen-scroll px-4 pt-3 pb-4">
        {/* Who is posting */}
        <div className="flex items-center gap-3">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover" />
          ) : (
            <span className="w-11 h-11 rounded-full bg-brand-light flex items-center justify-center text-brand-purple font-semibold">{(profile?.full_name || '?').slice(0, 1).toUpperCase()}</span>
          )}
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{profile?.full_name || 'You'}</p>
            <p className="text-xs text-gray-400 truncate">{profile?.role || 'School member'}</p>
          </div>
        </div>

        {/* Category */}
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 mt-3 pb-1" style={{ scrollbarWidth: 'none' }}>
          {CATEGORIES.map((c) => {
            const on = c.key === category
            return (
              <button
                key={c.key}
                onClick={() => setCategory(c.key)}
                className={`shrink-0 h-9 px-3.5 rounded-full text-[13px] font-semibold flex items-center gap-1.5 border ${on ? 'bg-brand-navy text-white border-brand-navy' : 'bg-white text-gray-500 border-gray-200'}`}
              >
                <span>{c.icon}</span> {c.key}
              </button>
            )
          })}
        </div>

        <textarea
          ref={textRef}
          autoFocus={!modeInfo?.title}
          value={content}
          maxLength={MAX_TEXT}
          onChange={(e) => setContent(e.target.value)}
          placeholder={category === 'Announcement' ? 'What should everyone know?' : "What's happening at school?"}
          className="w-full mt-3 bg-transparent border-0 outline-none resize-none text-[17px] leading-relaxed placeholder:text-gray-400"
          style={{ minHeight: 96 }}
        />
        {over ? <p className={`text-right text-xs ${content.length >= MAX_TEXT ? 'text-red-500' : 'text-gray-400'}`}>{content.length}/{MAX_TEXT}</p> : null}

        {/* Quick starters */}
        {!content.trim() ? (
          <div className="mt-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400 mb-2">Need a start?</p>
            <div className="flex flex-wrap gap-2">
              {activeCategory.starters.map((s) => (
                <button key={s} onClick={() => insertAtCursor(s)} className="text-[13px] text-brand-purple bg-brand-light rounded-full px-3.5 py-2 text-left">{s}</button>
              ))}
            </div>
          </div>
        ) : null}

        {/* The shortcut that opened this screen */}
        {showDrop ? (
          <button
            onClick={() => (mode === 'photo' ? photoInputRef : mode === 'video' ? videoInputRef : docInputRef).current?.click()}
            className="w-full mt-4 rounded-2xl border-2 border-dashed border-brand-purple/40 bg-brand-light py-7 flex flex-col items-center gap-2"
          >
            <span className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center">{modeInfo.icon ? <modeInfo.icon size={26} className="text-brand-purple" /> : null}</span>
            <span className="font-bold text-brand-navy">{modeInfo.title}</span>
            <span className="text-xs text-gray-500">{modeInfo.hint}</span>
          </button>
        ) : null}

        {/* Photos */}
        {tiles > 0 ? (
          <div className="grid grid-cols-3 gap-1.5 mt-3">
            {photos.map((p, i) => (
              <div key={p.id} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                <img src={p.url} alt="" className="w-full h-full object-cover" />
                <button onClick={() => removePhoto(p.id)} aria-label="Remove photo" className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/65 flex items-center justify-center"><X size={14} className="text-white" /></button>
                {i === 0 ? (
                  <span className="absolute bottom-1.5 left-1.5 text-[10px] font-bold bg-black/65 text-white rounded-full px-2 py-0.5 flex items-center gap-1"><Star size={10} fill="currentColor" /> Cover</span>
                ) : (
                  <button onClick={() => makeCover(p.id)} className="absolute bottom-1.5 left-1.5 text-[10px] font-semibold bg-black/55 text-white rounded-full px-2 py-0.5">Set cover</button>
                )}
              </div>
            ))}
            {tiles < MAX_PHOTOS ? (
              <button onClick={() => photoInputRef.current?.click()} aria-label="Add more photos" className="aspect-square rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 gap-1">
                <Plus size={22} />
                <span className="text-[11px]">Add</span>
              </button>
            ) : null}
          </div>
        ) : null}

        {/* Video */}
        {video ? (
          <div className="relative mt-3 rounded-xl overflow-hidden bg-black aspect-video">
            {video.poster ? <img src={video.poster} alt="" className="w-full h-full object-contain" /> : <video src={`${video.url}#t=0.5`} muted playsInline className="w-full h-full object-contain" />}
            <div className="absolute inset-0 flex items-center justify-center">
              {video.ready ? (
                <span className="w-14 h-14 rounded-full bg-black/55 flex items-center justify-center"><Play size={26} className="text-white ml-1" fill="currentColor" /></span>
              ) : (
                <Loader2 className="text-white animate-spin" />
              )}
            </div>
            <span className="absolute bottom-2 left-2 bg-black/65 text-white text-[11px] rounded-md px-1.5 py-0.5">{video.duration ? `${formatDuration(video.duration)} · ` : ''}{formatSize(video.file.size)}</span>
            <button onClick={removeVideo} aria-label="Remove video" className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/65 flex items-center justify-center"><X size={15} className="text-white" /></button>
          </div>
        ) : null}

        {/* File */}
        {doc ? (
          <div className="flex items-center gap-3 mt-3 border border-gray-100 rounded-xl p-3">
            <span className="w-11 h-11 rounded-lg bg-brand-light text-brand-purple flex items-center justify-center text-[11px] font-bold shrink-0">{fileExtension(doc.file.name)}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{doc.file.name}</p>
              <p className="text-xs text-gray-400">{formatSize(doc.file.size)}</p>
            </div>
            <button onClick={removeDoc} aria-label="Remove file" className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0"><X size={15} /></button>
          </div>
        ) : null}

        {/* Post options */}
        <div className="mt-5 rounded-2xl border border-gray-100 divide-y divide-gray-100">
          {showLocation ? (
            <div className="flex items-center gap-3 px-4 py-3">
              <MapPin size={18} className="text-brand-purple shrink-0" />
              <input
                autoFocus={!location}
                value={location}
                maxLength={80}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Where is this? (e.g. School hall)"
                className="flex-1 min-w-0 bg-transparent outline-none text-sm"
              />
              <button onClick={() => { setLocation(''); setShowLocation(false) }} aria-label="Remove place"><X size={16} className="text-gray-400" /></button>
            </div>
          ) : (
            <button onClick={() => setShowLocation(true)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
              <MapPin size={18} className="text-gray-400 shrink-0" />
              <span className="text-sm text-gray-500">Add a place</span>
            </button>
          )}
          <div className="flex items-center gap-3 px-4 py-3">
            <MessageCircle size={18} className={commentsOn ? 'text-gray-400' : 'text-brand-purple'} />
            <span className="flex-1">
              <span className="block text-sm text-brand-navy">Allow comments</span>
              <span className="block text-xs text-gray-400">{commentsOn ? 'Anyone who sees this post can comment.' : 'Comments are turned off for this post.'}</span>
            </span>
            <Switch checked={commentsOn} onChange={setCommentsOn} label="Allow comments" />
          </div>
        </div>

        {error ? (
          <div className="mt-4 flex gap-2 items-start bg-red-50 text-red-600 text-sm rounded-xl p-3">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        ) : null}
      </div>

      {notice ? <div className="mx-4 mb-2 bg-gray-900 text-white text-xs rounded-full px-4 py-2 text-center shrink-0">{notice}</div> : null}

      {/* Emoji tray */}
      {emojiOpen ? (
        <div className="shrink-0 border-t border-gray-100 px-3 py-2 grid grid-cols-8 gap-1 max-h-40 overflow-y-auto">
          {EMOJIS.map((em) => (
            <button key={em} onClick={() => insertAtCursor(em)} className="text-2xl leading-none p-1.5 rounded-lg active:bg-gray-100">{em}</button>
          ))}
        </div>
      ) : null}

      {/* Add-to-post bar */}
      <div className="shrink-0 border-t border-gray-100 px-2 py-2 flex items-center justify-between">
        <div className="flex items-center">
          <button onClick={() => photoInputRef.current?.click()} disabled={posting} aria-label="Add photos" className="relative w-11 h-11 rounded-full flex items-center justify-center active:bg-gray-100">
            <ImageIcon size={23} className="text-green-500" />
            {tiles ? <span className="absolute top-1 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-brand-purple text-white text-[10px] font-bold flex items-center justify-center">{tiles}</span> : null}
          </button>
          <button onClick={() => videoInputRef.current?.click()} disabled={posting} aria-label="Add a video" className="w-11 h-11 rounded-full flex items-center justify-center active:bg-gray-100"><Video size={23} className="text-red-500" /></button>
          <button onClick={() => docInputRef.current?.click()} disabled={posting} aria-label="Add a file" className="w-11 h-11 rounded-full flex items-center justify-center active:bg-gray-100"><FileText size={23} className="text-blue-500" /></button>
          <button onClick={() => setEmojiOpen((v) => !v)} aria-label="Emoji" className={`w-11 h-11 rounded-full flex items-center justify-center ${emojiOpen ? 'bg-brand-light' : 'active:bg-gray-100'}`}><Smile size={23} className="text-amber-500" /></button>
          <button onClick={() => insertAtCursor('#')} aria-label="Add a hashtag" className="w-11 h-11 rounded-full flex items-center justify-center active:bg-gray-100"><Hash size={22} className="text-brand-purple" /></button>
        </div>
        <button onClick={() => setPreview(true)} disabled={!hasAnything} className="h-10 px-4 rounded-full border border-gray-200 text-sm font-semibold text-brand-navy flex items-center gap-1.5 disabled:opacity-40">
          <Eye size={16} /> Preview
        </button>
      </div>

      <input ref={photoInputRef} type="file" accept="image/*" multiple onChange={addPhotos} className="hidden" />
      <input ref={videoInputRef} type="file" accept="video/*" onChange={addVideo} className="hidden" />
      <input ref={docInputRef} type="file" accept={DOC_TYPES} onChange={addDoc} className="hidden" />

      {/* Preview */}
      {preview ? (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-end" onClick={() => setPreview(false)}>
          <div className="bg-white w-full rounded-t-3xl p-4 pb-6 max-w-[520px] mx-auto max-h-[88dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-3" />
            <p className="font-semibold px-1 mb-3">This is how it will look</p>
            <div className="border border-gray-100 rounded-xl p-4">
              <p className="font-semibold">{profile?.full_name || 'You'}</p>
              <p className="text-xs text-gray-400">{profile?.role}{profile?.role ? ' · ' : ''}just now{location ? ` · 📍 ${location}` : ''}</p>
              {category !== 'General' ? <span className="inline-block mt-2 text-[10px] font-medium px-2 py-0.5 rounded-full bg-brand-light text-brand-purple">{category}</span> : null}
              {content.trim() ? <p className="text-sm whitespace-pre-wrap break-words mt-2">{content.trim()}</p> : null}
              {photos.length ? (
                <div className={`grid gap-1 mt-2 rounded-xl overflow-hidden ${photos.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {photos.slice(0, 4).map((p) => <img key={p.id} src={p.url} alt="" className="w-full h-32 object-cover" />)}
                </div>
              ) : null}
              {video ? <p className="mt-2 text-xs text-gray-500 flex items-center gap-1.5"><Video size={14} /> Video · {formatSize(video.file.size)}</p> : null}
              {doc ? <p className="mt-2 text-xs text-gray-500 flex items-center gap-1.5"><FileText size={14} /> {doc.file.name}</p> : null}
              <p className="mt-3 text-xs text-gray-400">{commentsOn ? 'Comments on' : 'Comments off'}</p>
            </div>
            <button onClick={() => setPreview(false)} className="w-full mt-4 bg-brand-purple text-white font-medium py-3 rounded-full">Back to editing</button>
          </div>
        </div>
      ) : null}

      {/* Discard? */}
      {leaveAsk ? (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-end" onClick={() => setLeaveAsk(false)}>
          <div className="bg-white w-full rounded-t-3xl p-4 pb-6 max-w-[520px] mx-auto" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-3" />
            <p className="font-semibold px-1">Leave without posting?</p>
            <p className="text-sm text-gray-500 px-1 mt-1">Your words are saved as a draft. Photos, videos and files are not.</p>
            <button onClick={() => setLeaveAsk(false)} className="w-full mt-4 bg-brand-purple text-white font-medium py-3 rounded-full">Keep editing</button>
            <button onClick={discardAndLeave} className="w-full mt-2 text-red-500 font-medium py-3">Delete draft and leave</button>
            <button onClick={() => navigate(-1)} className="w-full text-gray-500 font-medium py-2">Save draft and leave</button>
          </div>
        </div>
      ) : null}

      {/* Uploading */}
      {posting ? (
        <div className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center px-8">
          <div className="bg-white rounded-2xl p-5 w-full max-w-[320px]">
            <p className="font-semibold text-center">{stage || 'Working…'}</p>
            <div className="mt-4 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-brand-purple rounded-full transition-all duration-200" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-center text-xs text-gray-400 mt-2">{progress}%</p>
            <button onClick={cancelPosting} className="w-full mt-3 text-sm text-gray-500 py-2">Cancel</button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
