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
// user sees at the top of Home for 48 hours.
export default function ControllerAnnounce() {
  const { user } = useAuth()
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
    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
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
