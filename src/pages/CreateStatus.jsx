import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Send, Type, Image as ImageIcon, Camera, Palette, Plus, Trash2, Check, Loader2, AlertCircle, Globe, School, Users, Play } from 'lucide-react'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { isStaffMember } from '../lib/permissions.js'
import { containsProfanity } from '../lib/moderation.js'
import { uploadWithProgress } from '../lib/uploadWithProgress.js'
import { prepareImage, videoInfo, formatSize, formatDuration, safeFileName } from '../lib/mediaTools.js'
import {
  STATUS_AUDIENCES, STATUS_BACKGROUNDS, STATUS_FONTS, STATUS_MAX_LENGTH, STATUS_MAX_VIDEO_SECONDS, STATUS_MAX_ITEMS,
} from '../lib/statusUtils.js'

const MAX_PHOTO_MB = 25
const MAX_VIDEO_MB = 50
const AUDIENCE_ICONS = { public: Globe, school_only: School, staff_only: Users }

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export default function CreateStatus() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const galleryRef = useRef(null)
  const cameraRef = useRef(null)
  const textRef = useRef(null)
  const abortRef = useRef(null)
  const uploadedRef = useRef(new Map())

  const hasSchool = !!profile?.school_id
  const canStaffOnly = hasSchool && isStaffMember(profile)
  const audienceOptions = STATUS_AUDIENCES.filter((a) => {
    if (a.key === 'public') return true
    if (a.key === 'school_only') return hasSchool
    return canStaffOnly
  })

  const [mode, setMode] = useState('text')
  const [content, setContent] = useState('')
  const [bgIndex, setBgIndex] = useState(0)
  const [fontIndex, setFontIndex] = useState(0)
  const [items, setItems] = useState([])
  const [active, setActive] = useState(0)
  const [audience, setAudience] = useState(hasSchool ? 'school_only' : 'public')
  const [sheet, setSheet] = useState(null)
  const [posting, setPosting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!notice) return undefined
    const t = setTimeout(() => setNotice(''), 2400)
    return () => clearTimeout(t)
  }, [notice])

  useEffect(() => {
    if (mode === 'text') textRef.current?.focus()
  }, [mode])

  if (!user) return null

  const bg = STATUS_BACKGROUNDS[bgIndex]
  const font = STATUS_FONTS[fontIndex]
  const current = items[Math.min(active, items.length - 1)]
  const isMedia = mode === 'media' && items.length > 0
  const AudienceIcon = AUDIENCE_ICONS[audience] || Globe
  const audienceName = (STATUS_AUDIENCES.find((a) => a.key === audience) || STATUS_AUDIENCES[0]).label
  const mediaReady = items.length > 0 && items.every((it) => it.ready)
  const canSend = !posting && (isMedia ? mediaReady : content.trim().length > 0)

  function cycleBackground() {
    setBgIndex((i) => (i + 1) % STATUS_BACKGROUNDS.length)
  }

  function cycleFont() {
    const next = (fontIndex + 1) % STATUS_FONTS.length
    setFontIndex(next)
    setNotice(STATUS_FONTS[next].label)
  }

  async function addFiles(e) {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (!files.length) return
    const room = STATUS_MAX_ITEMS - items.length
    const fresh = []
    for (const file of files) {
      const isVideo = file.type.startsWith('video/')
      const isImage = file.type.startsWith('image/')
      if (!isVideo && !isImage) continue
      if (fresh.length >= room) {
        setNotice(`You can share up to ${STATUS_MAX_ITEMS} at a time.`)
        break
      }
      if (isImage && file.size > MAX_PHOTO_MB * 1024 * 1024) {
        setNotice(`${file.name} is bigger than ${MAX_PHOTO_MB} MB.`)
        continue
      }
      if (isVideo && file.size > MAX_VIDEO_MB * 1024 * 1024) {
        setNotice(`Videos can be up to ${MAX_VIDEO_MB} MB. Yours is ${formatSize(file.size)}.`)
        continue
      }
      fresh.push({ id: newId(), file, kind: isVideo ? 'video' : 'image', url: URL.createObjectURL(file), caption: '', ready: !isVideo, poster: null, duration: 0 })
    }
    if (!fresh.length) return
    setError('')
    const startAt = items.length
    setItems((prev) => [...prev, ...fresh])
    setActive(startAt)
    setMode('media')

    for (const it of fresh.filter((x) => x.kind === 'video')) {
      // eslint-disable-next-line no-await-in-loop
      const info = await videoInfo(it.url)
      if (info.duration > STATUS_MAX_VIDEO_SECONDS) {
        setNotice(`Status videos can be up to ${STATUS_MAX_VIDEO_SECONDS} seconds.`)
        setItems((prev) => prev.filter((x) => x.id !== it.id))
        URL.revokeObjectURL(it.url)
        continue
      }
      setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, ready: true, poster: info.poster, duration: info.duration } : x)))
    }
  }

  function removeCurrent() {
    if (!current) return
    URL.revokeObjectURL(current.url)
    uploadedRef.current.delete(current.id)
    const next = items.filter((x) => x.id !== current.id)
    setItems(next)
    setActive((a) => Math.max(0, Math.min(a, next.length - 1)))
    if (!next.length) setMode('text')
  }

  function setCaption(value) {
    setItems((prev) => prev.map((x) => (x.id === current?.id ? { ...x, caption: value.slice(0, STATUS_MAX_LENGTH) } : x)))
  }

  const hasWork = isMedia || content.trim().length > 0

  function requestClose() {
    if (posting) return
    if (hasWork) setSheet('discard')
    else navigate(-1)
  }

  function discard() {
    items.forEach((x) => URL.revokeObjectURL(x.url))
    navigate(-1)
  }

  async function handleSend() {
    if (!canSend) return
    const texts = isMedia ? items.map((it) => it.caption).join(' ') : content
    if (containsProfanity(texts)) {
      setError("This contains language that isn't allowed on Schoolink. Please edit it and try again.")
      return
    }
    setError('')
    setPosting(true)
    setProgress(0)
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const base = {
        user_id: user.id,
        audience,
        school_id: profile?.school_id ?? null,
      }
      let rows = []

      if (!isMedia) {
        setStage('Sharing your update…')
        rows = [{ ...base, content: content.trim(), bg_color: bg.key, font_style: font.key, media_type: null }]
      } else {
        setStage('Getting ready…')
        const jobs = []
        for (const it of items) {
          if (!uploadedRef.current.has(it.id)) {
            const file = it.kind === 'image' ? await prepareImage(it.file) : it.file
            jobs.push({ key: it.id, file, bucket: it.kind === 'image' ? 'post-images' : 'post-videos' })
            if (it.kind === 'video' && it.poster) {
              const blob = await (await fetch(it.poster)).blob()
              jobs.push({ key: `${it.id}:thumb`, file: new File([blob], 'thumb.jpg', { type: 'image/jpeg' }), bucket: 'post-images' })
            }
          }
        }
        const total = jobs.reduce((sum, j) => sum + j.file.size, 0) || 1
        const mediaJobs = jobs.filter((j) => !j.key.endsWith(':thumb')).length
        let done = 0
        let mediaStep = 0
        for (const job of jobs) {
          if (!job.key.endsWith(':thumb')) {
            mediaStep += 1
            setStage(mediaJobs > 1 ? `Uploading (${mediaStep} of ${mediaJobs})` : 'Uploading…')
          }
          const path = `${user.id}/status-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${safeFileName(job.file.name)}`
          // eslint-disable-next-line no-await-in-loop
          const url = await uploadWithProgress({
            bucket: job.bucket,
            path,
            file: job.file,
            signal: controller.signal,
            onProgress: (_, loaded) => setProgress(Math.min(99, Math.round(((done + loaded) / total) * 100))),
          })
          done += job.file.size
          uploadedRef.current.set(job.key, url)
        }
        setStage('Sharing…')
        setProgress(100)
        rows = items.map((it) => ({
          ...base,
          content: it.caption.trim(),
          image_url: it.kind === 'image' ? uploadedRef.current.get(it.id) : null,
          media_url: uploadedRef.current.get(it.id),
          media_type: it.kind,
          thumb_url: it.kind === 'video' ? uploadedRef.current.get(`${it.id}:thumb`) || null : null,
          duration_seconds: it.kind === 'video' ? Math.round(it.duration) : null,
          bg_color: 'night',
        }))
      }

      const { error: insertError } = await supabase.from('statuses').insert(rows)
      if (insertError) throw insertError
      items.forEach((x) => URL.revokeObjectURL(x.url))
      navigate('/home', { replace: true })
    } catch (err) {
      if (err?.name === 'AbortError') setError('Cancelled. Nothing was shared.')
      else setError(`${err?.message || 'Something went wrong.'} Tap send to try again — what already uploaded won't be sent twice.`)
    } finally {
      setPosting(false)
      abortRef.current = null
    }
  }

  const textSize = content.length > 160 ? 'text-xl' : content.length > 70 ? 'text-2xl' : 'text-3xl'

  return (
    <div className="fixed inset-0 z-50 flex flex-col text-white" style={{ background: isMedia ? '#000' : bg.css }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0 z-10" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <button onClick={requestClose} aria-label="Close" className="w-10 h-10 rounded-full bg-black/30 flex items-center justify-center"><X size={20} /></button>
        {isMedia ? (
          <div className="flex items-center gap-2">
            <button onClick={() => galleryRef.current?.click()} disabled={items.length >= STATUS_MAX_ITEMS} aria-label="Add more" className="w-10 h-10 rounded-full bg-black/30 flex items-center justify-center disabled:opacity-40"><Plus size={20} /></button>
            <button onClick={removeCurrent} aria-label="Remove this one" className="w-10 h-10 rounded-full bg-black/30 flex items-center justify-center"><Trash2 size={18} /></button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button onClick={cycleFont} aria-label="Change font" className="w-10 h-10 rounded-full bg-black/30 flex items-center justify-center font-bold text-sm">Aa</button>
            <button onClick={cycleBackground} aria-label="Change colour" className="w-10 h-10 rounded-full bg-black/30 flex items-center justify-center"><Palette size={19} /></button>
          </div>
        )}
      </div>

      {notice ? <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 bg-black/70 text-white text-xs rounded-full px-4 py-1.5 whitespace-nowrap max-w-[90%] truncate">{notice}</div> : null}

      {/* Middle */}
      {!isMedia ? (
        <div className="flex-1 min-h-0 flex items-center justify-center px-6" onClick={() => textRef.current?.focus()}>
          <textarea
            ref={textRef}
            value={content}
            maxLength={STATUS_MAX_LENGTH}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Type a status"
            rows={Math.min(8, Math.max(2, Math.ceil(content.length / 22)))}
            style={{ background: 'transparent', color: '#fff', ...font.css }}
            className={`w-full text-center ${textSize} leading-snug border-0 outline-none resize-none placeholder:!text-white/60`}
          />
        </div>
      ) : (
        <div className="flex-1 min-h-0 relative flex items-center justify-center">
          {current ? (
            current.kind === 'image' ? (
              <img src={current.url} alt="" className="max-w-full max-h-full object-contain" />
            ) : (
              <video key={current.id} src={current.url} controls playsInline loop className="max-w-full max-h-full" />
            )
          ) : null}
          {current && current.kind === 'video' ? (
            <span className="absolute top-2 left-4 bg-black/60 text-xs rounded-md px-2 py-0.5 flex items-center gap-1">
              <Play size={10} fill="currentColor" /> {current.ready ? `${formatDuration(current.duration)} · ${formatSize(current.file.size)}` : 'Checking video…'}
            </span>
          ) : null}
        </div>
      )}

            {/* Bottom */}
      <div className="shrink-0 z-10 px-4 pt-2" style={{ paddingBottom: 'max(14px, env(safe-area-inset-bottom))' }}>
        {error ? (
          <div className="flex gap-2 items-start bg-red-500/90 text-white text-xs rounded-xl p-3 mb-2">
            <AlertCircle size={15} className="shrink-0 mt-0.5" /> <span>{error}</span>
          </div>
        ) : null}

        {isMedia && items.length > 1 ? (
          <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
            {items.map((it, i) => (
              <button key={it.id} onClick={() => setActive(i)} className={`relative shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 ${i === active ? 'border-white' : 'border-transparent opacity-60'}`}>
                {it.kind === 'image' ? <img src={it.url} alt="" className="w-full h-full object-cover" /> : it.poster ? <img src={it.poster} alt="" className="w-full h-full object-cover" /> : <span className="w-full h-full bg-neutral-700 flex items-center justify-center"><Play size={14} /></span>}
              </button>
            ))}
          </div>
        ) : null}

        {isMedia ? (
          <input
            value={current?.caption || ''}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Add a caption…"
            className="w-full bg-white/15 text-white placeholder-white/60 rounded-full px-4 py-3 text-sm outline-none mb-3"
          />
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <button onClick={() => setSheet('audience')} className="flex items-center gap-2 bg-black/35 rounded-full pl-3 pr-4 py-2.5 text-sm">
            <AudienceIcon size={16} /> {audienceName}
          </button>

          {!isMedia ? (
            <div className="flex items-center gap-1 bg-black/30 rounded-full p-1">
              <button aria-label="Text" className="w-10 h-10 rounded-full bg-white/25 flex items-center justify-center"><Type size={18} /></button>
              <button onClick={() => galleryRef.current?.click()} aria-label="Photo or video" className="w-10 h-10 rounded-full flex items-center justify-center"><ImageIcon size={18} /></button>
              <button onClick={() => cameraRef.current?.click()} aria-label="Camera" className="w-10 h-10 rounded-full flex items-center justify-center"><Camera size={18} /></button>
            </div>
          ) : (
            <span className="text-xs text-white/60">{items.length > 1 ? `${items.length} updates` : ''}</span>
          )}

          <button onClick={handleSend} disabled={!canSend} aria-label="Share" className="w-14 h-14 rounded-full bg-brand-purple flex items-center justify-center shadow-lg disabled:opacity-40">
            <Send size={22} className="text-white ml-0.5" />
          </button>
        </div>
        <p className="text-center text-[11px] text-white/50 mt-2">Disappears after 24 hours</p>
      </div>

      <input ref={galleryRef} type="file" accept="image/*,video/*" multiple onChange={addFiles} className="hidden" />
      <input ref={cameraRef} type="file" accept="image/*,video/*" capture="environment" onChange={addFiles} className="hidden" />

      {/* Who can see it */}
      {sheet === 'audience' ? (
        <div className="absolute inset-0 z-30 bg-black/60 flex items-end" onClick={() => setSheet(null)}>
          <div className="bg-neutral-900 w-full rounded-t-3xl p-4 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-3" />
            <p className="font-semibold mb-1 px-1">Who can see this update?</p>
            {audienceOptions.map((a) => {
              const Icon = AUDIENCE_ICONS[a.key] || Globe
              return (
                <button key={a.key} onClick={() => { setAudience(a.key); setSheet(null) }} className="w-full flex items-center gap-3 py-3 px-1 text-left">
                  <span className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"><Icon size={18} /></span>
                  <span className="flex-1">
                    <span className="block text-sm font-medium">{a.label}</span>
                    <span className="block text-xs text-white/50">{a.hint}</span>
                  </span>
                  {audience === a.key ? <Check size={18} className="text-brand-purple" /> : null}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      {/* Discard? */}
      {sheet === 'discard' ? (
        <div className="absolute inset-0 z-30 bg-black/60 flex items-end" onClick={() => setSheet(null)}>
          <div className="bg-neutral-900 w-full rounded-t-3xl p-4 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-3" />
            <p className="font-semibold px-1">Discard this update?</p>
            <p className="text-sm text-white/50 px-1 mt-1">What you have made so far will be lost.</p>
            <button onClick={() => setSheet(null)} className="w-full mt-4 bg-brand-purple text-white font-medium py-3 rounded-full">Keep editing</button>
            <button onClick={discard} className="w-full mt-2 text-red-400 font-medium py-3">Discard</button>
          </div>
        </div>
      ) : null}

      {/* Uploading */}
      {posting ? (
        <div className="absolute inset-0 z-40 bg-black/65 flex items-center justify-center px-8">
          <div className="bg-neutral-900 rounded-2xl p-5 w-full max-w-[320px]">
            <p className="font-semibold text-center flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" /> {stage || 'Working…'}</p>
            <div className="mt-4 h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-brand-purple rounded-full transition-all duration-200" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-center text-xs text-white/50 mt-2">{progress}%</p>
            <button onClick={() => abortRef.current?.abort()} className="w-full mt-3 text-sm text-white/60 py-2">Cancel</button>
          </div>
        </div>
      ) : null}
    </div>
  )
      }
