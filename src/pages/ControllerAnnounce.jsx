import { useEffect, useRef, useState } from 'react'
import { Trash2, Image as ImageIcon, Video, FileText, X } from 'lucide-react'
import ControllerShell, { ctl } from '../components/ControllerShell.jsx'
import { AnnouncementCard } from '../components/SiteAnnouncements.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { timeAgo } from '../lib/team.js'

const BUCKET = 'announcement-media'
const MAX_ITEMS = 10
const MAX_MB = 50

function sizeLabel(bytes) {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

// Owner only: post an update (text, photos, videos with sound, files) that every
// user sees in the Home feed, first, for 48 hours.
export default function ControllerAnnounce() {
  const { profile } = useAuth()
  const photoRef = useRef(null)
  const videoRef = useRef(null)
  const fileRef = useRef(null)
  const [text, setText] = useState('')
  const [picked, setPicked] = useState([])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const [items, setItems] = useState([])

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('site_announcements')
      .select('id, body, media, created_at, expires_at')
      .order('created_at', { ascending: false })
      .limit(20)
    setItems(data ?? [])
  }

  function addFiles(e, kind) {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    setError('')
    const tooBig = files.find((f) => f.size > MAX_MB * 1048576)
    if (tooBig) {
      setError(`"${tooBig.name}" is bigger than ${MAX_MB} MB. Pick a smaller file.`)
      return
    }
    const next = files.map((f) => ({
      id: Math.random().toString(36).slice(2),
      kind,
      file: f,
      previewUrl: kind === 'file' ? '' : URL.createObjectURL(f),
    }))
    setPicked((prev) => {
      const all = [...prev, ...next]
      if (all.length > MAX_ITEMS) setError(`You can attach up to ${MAX_ITEMS} items.`)
      return all.slice(0, MAX_ITEMS)
    })
  }

  function removePicked(id) {
    setPicked((prev) => {
      const gone = prev.find((p) => p.id === id)
      if (gone?.previewUrl) URL.revokeObjectURL(gone.previewUrl)
      return prev.filter((p) => p.id !== id)
    })
  }

  async function uploadOne(item) {
    const ext = (item.file.name.split('.').pop() || 'bin').toLowerCase()
    // No account id in the path, so the link never points back to you.
    const path = `updates/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, item.file, { contentType: item.file.type || undefined })
    if (upErr) throw upErr
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    return { type: item.kind, url: data.publicUrl, name: item.file.name }
  }

  async function post() {
    const body = text.trim()
    if (!body && picked.length === 0) return
    setBusy(true)
    setError('')
    setDone('')
    try {
      const media = []
      for (let i = 0; i < picked.length; i++) {
        setProgress(`Uploading ${i + 1} of ${picked.length}…`)
        media.push(await uploadOne(picked[i]))
      }
      setProgress('Posting…')
      const { error: err } = await supabase.rpc('post_site_announcement', { p_body: body, p_media: media })
      if (err) throw err
      picked.forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl))
      setPicked([])
      setText('')
      setDone('Posted. Everyone will see it for the next 48 hours.')
      load()
    } catch (err) {
      setError(err.message || 'Something went wrong. Try again.')
    }
    setProgress('')
    setBusy(false)
  }

  async function remove(item) {
    if (!window.confirm('Remove this update now?')) return
    const { error: err } = await supabase.rpc('delete_site_announcement', { p_id: item.id })
    if (err) {
      setError(err.message)
      return
    }
    const paths = (item.media || [])
      .map((m) => (m.url || '').split(`/${BUCKET}/`)[1])
      .filter(Boolean)
    if (paths.length) await supabase.storage.from(BUCKET).remove(paths)
    setItems((prev) => prev.filter((a) => a.id !== item.id))
  }

  const now = Date.now()
  const previewMedia = picked.map((p) => ({ type: p.kind, url: p.previewUrl, name: p.file.name }))
  const canPost = !busy && (text.trim() || picked.length > 0)

  return (
    <ControllerShell title="Post an Update" allow={['owner']}>
      <p className="text-xs mb-3" style={{ color: ctl.muted }}>
        Your update shows in the Home feed for everyone, first, from "Schoolink", and disappears after 48 hours.
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={1000}
        rows={5}
        placeholder="Write your update…"
        className="w-full rounded-xl p-3 text-sm outline-none"
        style={{ background: ctl.card, border: `1px solid ${ctl.border}`, color: ctl.text }}
      />
      <p className="text-right text-[11px] mt-1" style={{ color: ctl.muted }}>{text.length}/1000</p>

      <div className="flex gap-2 mt-2">
        {[
          { label: 'Photos', icon: ImageIcon, ref: photoRef },
          { label: 'Video', icon: Video, ref: videoRef },
          { label: 'File', icon: FileText, ref: fileRef },
        ].map(({ label, icon: Icon, ref }) => (
          <button
            key={label}
            type="button"
            onClick={() => ref.current?.click()}
            disabled={busy}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-medium"
            style={{ background: ctl.card, border: `1px solid ${ctl.border}`, color: ctl.text }}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>
      <input ref={photoRef} type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e, 'image')} />
      <input ref={videoRef} type="file" accept="video/*" multiple hidden onChange={(e) => addFiles(e, 'video')} />
      <input ref={fileRef} type="file" multiple hidden onChange={(e) => addFiles(e, 'file')} />
      <p className="text-[11px] mt-1" style={{ color: ctl.muted }}>
        Up to {MAX_ITEMS} items, {MAX_MB} MB each. Videos keep their sound.
      </p>

      {picked.length > 0 ? (
        <div className="mt-3 space-y-1.5">
          {picked.map((p) => {
            const Icon = p.kind === 'image' ? ImageIcon : p.kind === 'video' ? Video : FileText
            return (
              <div
                key={p.id}
                className="flex items-center gap-2 rounded-lg px-3 py-2"
                style={{ background: ctl.card, border: `1px solid ${ctl.border}` }}
              >
                <Icon size={16} style={{ color: ctl.accent }} className="shrink-0" />
                <span className="text-xs truncate flex-1">{p.file.name}</span>
                <span className="text-[11px] shrink-0" style={{ color: ctl.muted }}>{sizeLabel(p.file.size)}</span>
                <button onClick={() => removePicked(p.id)} disabled={busy} aria-label="Remove" style={{ color: ctl.bad }}>
                  <X size={16} />
                </button>
              </div>
            )
          })}
        </div>
      ) : null}

      {text.trim() || picked.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs mb-1" style={{ color: ctl.muted }}>Preview</p>
          <AnnouncementCard body={text.trim()} media={previewMedia} avatarUrl={profile?.avatar_url} />
        </div>
      ) : null}

      {error ? <p className="text-sm mt-3" style={{ color: ctl.bad }}>{error}</p> : null}
      {done ? <p className="text-sm mt-3" style={{ color: ctl.good }}>{done}</p> : null}

      <button
        onClick={post}
        disabled={!canPost}
        className="w-full mt-4 rounded-xl py-3 font-semibold text-sm"
        style={{ background: 'linear-gradient(135deg, #6366F1, #7C3AED)', color: '#fff', opacity: canPost ? 1 : 0.5 }}
      >
        {busy ? progress || 'Posting…' : 'Post for 48 hours'}
      </button>

      <h2 className="text-sm font-semibold mt-7 mb-2">Recent updates</h2>
      {items.length === 0 ? (
        <p className="text-xs" style={{ color: ctl.muted }}>Nothing posted yet.</p>
      ) : (
        <div className="space-y-2">
          {items.map((a) => {
            const live = new Date(a.expires_at).getTime() > now
            const count = Array.isArray(a.media) ? a.media.length : 0
            return (
              <div key={a.id} className="rounded-xl p-3" style={{ background: ctl.card, border: `1px solid ${ctl.border}` }}>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: live ? ctl.good : ctl.border, color: live ? '#04210F' : ctl.muted }}
                  >
                    {live ? 'LIVE' : 'ENDED'}
                  </span>
                  <span className="text-[11px] flex-1" style={{ color: ctl.muted }}>
                    {timeAgo(a.created_at)}{count ? ` · ${count} attachment${count > 1 ? 's' : ''}` : ''}
                  </span>
                  <button onClick={() => remove(a)} aria-label="Remove update" style={{ color: ctl.bad }}>
                    <Trash2 size={16} />
                  </button>
                </div>
                {a.body ? <p className="text-sm whitespace-pre-wrap break-words">{a.body}</p> : null}
              </div>
            )
          })}
        </div>
      )}
    </ControllerShell>
  )
    }
