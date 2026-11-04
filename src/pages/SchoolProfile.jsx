import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Camera, MapPin, Phone, Mail, MessageSquare, Plus, FileText, ExternalLink, Bell, BellRing, Video,
  Download, Share2, Heart, Star, Trash2, X, ChevronLeft, ChevronRight, Settings, Pencil, Loader2, Check, Upload,
} from 'lucide-react'
import VerifiedBadge, { refreshVerifiedIds } from '../components/VerifiedBadge.jsx'
import SchoolPlusBadge, { useIsPlusSchool } from '../components/SchoolPlusBadge.jsx'
import FormPicker from '../components/FormPicker.jsx'
import AvatarViewer from '../components/AvatarViewer.jsx'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { canManageStaff, isStaffMember } from '../lib/permissions.js'
import { useOnlineIds } from '../lib/presence.jsx'

const tabs = ['Posts', 'About', 'Staff', 'Media', 'Events', 'Documents']
const ROLE_RANK = { Headteacher: 0, 'Deputy Head': 1 }
const MAX_FILE_MB = 50
const MAX_BATCH = 30

// Colours come from this page, not the app theme, so text stays readable in light and dark mode.
function paletteFor(dark) {
  return dark
    ? {
        ink: '#F5F3FF', sub: '#A7A3C2', faint: '#7E7A99', line: '#2A2646', surface: '#120F28', panel: '#1A1636',
        accent: '#8B6CFF', accentInk: '#FFFFFF', accentSoft: 'rgba(139,108,255,0.16)', coverA: '#16123A', coverB: '#2C2070', danger: '#F87171',
      }
    : {
        ink: '#1B1733', sub: '#625E7A', faint: '#9A97AD', line: '#E9E7F1', surface: '#FFFFFF', panel: '#F6F5FA',
        accent: '#6C4CE0', accentInk: '#FFFFFF', accentSoft: 'rgba(108,76,224,0.10)', coverA: '#1B1640', coverB: '#3A2A86', danger: '#DC2626',
      }
}

// Headteacher and deputy first, then everyone by name
function sortStaff(list) {
  return [...list].sort(
    (a, b) => (ROLE_RANK[a.role] ?? 2) - (ROLE_RANK[b.role] ?? 2)
      || String(a.full_name || '').localeCompare(String(b.full_name || '')),
  )
}

function monogram(name) {
  const letters = String(name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('')
  return letters.toUpperCase() || '?'
}

function storagePathFromUrl(url, bucket) {
  if (!url) return null
  const marker = `/${bucket}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  return decodeURIComponent(url.slice(idx + marker.length).split('?')[0])
}

function safeFileName(name) {
  return String(name || 'file').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-80)
}

function extOf(name) {
  const m = /\.([a-z0-9]+)$/i.exec(name || '')
  return m ? m[1].toLowerCase() : ''
}

function dateLabel(value) {
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

// ---------- Static skeletons (no animation) ----------
function Block({ p, className = '', style }) {
  return <div className={className} style={{ background: p.line, borderRadius: 10, ...style }} aria-hidden="true" />
}

function ListSkeleton({ p }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3 py-3.5" style={{ borderTop: i ? `1px solid ${p.line}` : 'none' }}>
          <Block p={p} className="w-11 h-11 shrink-0" style={{ borderRadius: 999 }} />
          <div className="flex-1 space-y-2">
            <Block p={p} className="h-3.5 w-1/2" />
            <Block p={p} className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

function PageSkeleton({ p, onBack }) {
  return (
    <div aria-busy="true" aria-label="Loading school" className="pb-10">
      <div className="relative h-[168px]" style={{ background: p.line }}>
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="absolute top-3 left-3 w-9 h-9 rounded-full flex items-center justify-center text-white"
          style={{ background: 'rgba(0,0,0,0.28)' }}
        >
          <ChevronLeft size={21} />
        </button>
      </div>
      <div className="px-5 -mt-12 relative">
        <Block p={p} className="w-[84px] h-[84px]" style={{ borderRadius: 22, boxShadow: `0 0 0 4px ${p.surface}` }} />
        <Block p={p} className="h-5 w-3/5 mt-4" />
        <Block p={p} className="h-3.5 w-2/5 mt-2.5" />
        <Block p={p} className="h-3.5 w-1/2 mt-3" />
      </div>
      <div className="mx-5 mt-6 grid grid-cols-4 gap-3 rounded-2xl border p-4" style={{ borderColor: p.line }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <Block p={p} className="h-5 w-9" />
            <Block p={p} className="h-2.5 w-12" />
          </div>
        ))}
      </div>
      <div className="mx-5 mt-6 space-y-2.5">
        <Block p={p} className="h-3 w-20" />
        <Block p={p} className="h-3.5 w-full" />
        <Block p={p} className="h-3.5 w-11/12" />
        <Block p={p} className="h-3.5 w-2/3" />
      </div>
      <div className="flex gap-7 px-5 mt-8 border-b" style={{ borderColor: p.line }}>
        {[0, 1, 2, 3].map((i) => <Block key={i} p={p} className="h-3.5 w-14 mb-3" />)}
      </div>
      <div className="px-5 mt-2"><ListSkeleton p={p} /></div>
    </div>
  )
}

function EmptyNote({ p, text }) {
  return <p className="text-center text-[14px] py-14" style={{ color: p.sub }}>{text}</p>
}

function SelectMark({ p, on, inline = false }) {
  return (
    <span
      className={`${inline ? '' : 'absolute top-2 right-2'} w-6 h-6 rounded-full flex items-center justify-center border-2 shrink-0`}
      style={{ background: on ? p.accent : 'rgba(0,0,0,0.28)', borderColor: on ? p.accent : '#FFFFFF' }}
    >
      {on ? <Check size={13} color="#FFFFFF" strokeWidth={3} /> : null}
    </span>
  )
}

function ContentToolbar({ p, count, noun, canManage, hasItems, selectMode, onToggleSelect, onUpload, busy }) {
  return (
    <div className="flex items-center justify-between gap-3 pb-3">
      <p className="text-[13px]" style={{ color: p.sub }}>{count} {count === 1 ? noun : `${noun}s`}</p>
      {canManage ? (
        <div className="flex items-center gap-2">
          {hasItems ? (
            <button
              type="button"
              onClick={onToggleSelect}
              className="h-9 px-3.5 rounded-full text-[13px] font-medium border"
              style={{ borderColor: p.line, color: p.ink }}
            >
              {selectMode ? 'Done' : 'Select'}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onUpload}
            disabled={busy}
            className="h-9 px-3.5 rounded-full text-[13px] font-semibold flex items-center gap-1.5 disabled:opacity-50"
            style={{ background: p.accent, color: p.accentInk }}
          >
            <Upload size={14} /> Upload
          </button>
        </div>
      ) : null}
    </div>
  )
}

function UploadBar({ p, progress }) {
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0
  return (
    <div className="mb-3 rounded-xl border px-4 py-3" style={{ borderColor: p.line, background: p.panel }}>
      <div className="flex items-center justify-between text-[13px]" style={{ color: p.ink }}>
        <span>{progress.label}</span>
        <span style={{ color: p.sub }}>{progress.done} of {progress.total}</span>
      </div>
      <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: p.line }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: p.accent }} />
      </div>
    </div>
  )
}

function StarRow({ p, average, myRating, count, interactive, onRate, size = 14 }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!interactive}
          onClick={(e) => { e.stopPropagation(); onRate?.(n) }}
          aria-label={`Rate ${n} out of 5`}
        >
          <Star
            size={size}
            color={n <= Math.round(interactive ? myRating || average : average) ? '#F59E0B' : p.faint}
            fill={n <= Math.round(interactive ? myRating || average : average) ? '#F59E0B' : 'none'}
          />
        </button>
      ))}
      {count > 0 ? <span className="text-[11px] ml-1" style={{ color: p.sub }}>{average.toFixed(1)} ({count})</span> : null}
    </div>
  )
}

export default function SchoolProfile() {
  const navigate = useNavigate()
  const { schoolId: paramSchoolId } = useParams()
  const { user, profile, saveProfileDetails } = useAuth()
  const onlineIds = useOnlineIds()
  const p = paletteFor(!!profile?.dark_mode)
  const logoInputRef = useRef(null)
  const galleryInputRef = useRef(null)
  const docInputRef = useRef(null)
  const tabsRef = useRef(null)
  const tabReq = useRef(0) // only the latest tab request may update the screen
  const tabRef = useRef('Posts')

  const targetSchoolId = paramSchoolId || profile?.school_id

  const [school, setSchool] = useState(null)
  const [form, setForm] = useState({})
  const [loading, setLoading] = useState(true)
  const [tabLoading, setTabLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(null)
  const [memberCount, setMemberCount] = useState(0)
  const [staffCount, setStaffCount] = useState(0)
  const [studentCount, setStudentCount] = useState(0)
  const [memberIds, setMemberIds] = useState([])
  const [isFollowing, setIsFollowing] = useState(false)

  const [activeTab, setActiveTab] = useState('Posts')
  const [posts, setPosts] = useState([])
  const [staff, setStaff] = useState([])
  const [gallery, setGallery] = useState([])
  const [events, setEvents] = useState([])
  const [documents, setDocuments] = useState([])

  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(() => new Set())

  const [galleryLikes, setGalleryLikes] = useState({})
  const [galleryRatings, setGalleryRatings] = useState({})
  const [docLikes, setDocLikes] = useState({})
  const [docRatings, setDocRatings] = useState({})
  const [lightboxItem, setLightboxItem] = useState(null)
  const [toast, setToast] = useState('')
  const [viewingLogo, setViewingLogo] = useState(null)
  const [followRow, setFollowRow] = useState(null)
  const [followerStats, setFollowerStats] = useState({ follows: 0, members: 0, total: 0 })
  const [sheet, setSheet] = useState(null) // 'follow' | 'form' | null
  const [asStudent, setAsStudent] = useState(false)
  const [formValue, setFormValue] = useState('')
  const [sheetBusy, setSheetBusy] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteText, setDeleteText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const plusActive = useIsPlusSchool(school?.id)

  const isMember = !!school && profile?.school_id === school.id
  const canEdit = isMember && canManageStaff(profile)
  const canManageMedia = isMember && isStaffMember(profile)
  const isOnline = memberIds.some((id) => onlineIds.has(id))
  const handle = school?.name ? '@' + school.name.toLowerCase().replace(/[^a-z0-9]/g, '') : ''

  tabRef.current = activeTab

  useEffect(() => {
    if (!targetSchoolId) {
      setLoading(false)
      return
    }
    loadSchool()
  }, [targetSchoolId])

  // Load each tab's data when it is opened (or the school changes)
  useEffect(() => {
    setSelectMode(false)
    setSelectedIds(new Set())
    if (school?.id) loadTabData(activeTab, school.id)
  }, [activeTab, school?.id])

  // Members and staff counts stay live
  useEffect(() => {
    if (!school?.id) return undefined
    const channel = supabase
      .channel(`school-members-${school.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `school_id=eq.${school.id}` }, () => {
        refreshMembers(school.id)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [school?.id])

  // Photos, documents and events stay live for everyone looking at the school
  useEffect(() => {
    if (!school?.id) return undefined
    let timer = null
    const later = () => {
      clearTimeout(timer)
      timer = setTimeout(() => refreshContent(school.id), 250)
    }
    const channel = supabase
      .channel(`school-content-${school.id}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'school_gallery', filter: `school_id=eq.${school.id}` }, later)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'school_documents', filter: `school_id=eq.${school.id}` }, later)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `school_id=eq.${school.id}` }, later)
      .subscribe()
    return () => {
      clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [school?.id])

  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(''), 2400)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => { refreshVerifiedIds(true) }, [school?.id])

  async function refreshContent(schoolId) {
    const { data: pics } = await supabase.from('school_gallery').select('*').eq('school_id', schoolId).order('created_at', { ascending: false })
    setGallery(pics ?? [])
    await loadTabData(tabRef.current, schoolId, true)
  }

  async function refreshMembers(schoolId) {
    const { data: members } = await supabase.from('profiles').select('id, role').eq('school_id', schoolId).eq('status', 'active')
    setMemberCount(members?.length ?? 0)
    setMemberIds((members ?? []).map((m) => m.id))
    setStudentCount((members ?? []).filter((m) => m.role === 'Student').length)

    const { data: staffRows } = await supabase.from('profiles').select('*').eq('school_id', schoolId).eq('status', 'active').neq('role', 'Student')
    setStaff(sortStaff(staffRows ?? []))
    setStaffCount(staffRows?.length ?? 0)
  }

  async function refreshFollowerStats(id) {
    const { data } = await supabase.rpc('school_follower_count', { p_school: id })
    if (data) setFollowerStats(data)
  }

  async function loadSchool() {
    setLoading(true)
    const { data } = await supabase.from('schools').select('*').eq('id', targetSchoolId).maybeSingle()

    if (data) {
      await refreshMembers(data.id)

      const { data: followRowData } = await supabase
        .from('school_follows')
        .select('*')
        .eq('school_id', data.id)
        .eq('user_id', user.id)
        .maybeSingle()
      setIsFollowing(!!followRowData)
      setFollowRow(followRowData ?? null)
      refreshFollowerStats(data.id)

      const { data: pics } = await supabase.from('school_gallery').select('*').eq('school_id', data.id).order('created_at', { ascending: false })
      setGallery(pics ?? [])
    }

    setSchool(data ?? null)
    setForm(data ?? {})
    setLoading(false)
  }

  async function loadGalleryEngagement(ids) {
    if (!ids.length) { setGalleryLikes({}); setGalleryRatings({}); return }
    const [{ data: likes }, { data: ratings }] = await Promise.all([
      supabase.from('school_gallery_likes').select('gallery_id, user_id').in('gallery_id', ids),
      supabase.from('school_gallery_ratings').select('gallery_id, user_id, rating').in('gallery_id', ids),
    ])
    const likeMap = {}
    ;(likes ?? []).forEach((l) => {
      if (!likeMap[l.gallery_id]) likeMap[l.gallery_id] = { count: 0, likedByMe: false }
      likeMap[l.gallery_id].count += 1
      if (l.user_id === user.id) likeMap[l.gallery_id].likedByMe = true
    })
    const ratingMap = {}
    ;(ratings ?? []).forEach((r) => {
      if (!ratingMap[r.gallery_id]) ratingMap[r.gallery_id] = { sum: 0, count: 0, myRating: 0 }
      ratingMap[r.gallery_id].sum += r.rating
      ratingMap[r.gallery_id].count += 1
      if (r.user_id === user.id) ratingMap[r.gallery_id].myRating = r.rating
    })
    setGalleryLikes(likeMap)
    setGalleryRatings(ratingMap)
  }

  async function loadDocEngagement(ids) {
    if (!ids.length) { setDocLikes({}); setDocRatings({}); return }
    const [{ data: likes }, { data: ratings }] = await Promise.all([
      supabase.from('school_document_likes').select('document_id, user_id').in('document_id', ids),
      supabase.from('school_document_ratings').select('document_id, user_id, rating').in('document_id', ids),
    ])
    const likeMap = {}
    ;(likes ?? []).forEach((l) => {
      if (!likeMap[l.document_id]) likeMap[l.document_id] = { count: 0, likedByMe: false }
      likeMap[l.document_id].count += 1
      if (l.user_id === user.id) likeMap[l.document_id].likedByMe = true
    })
    const ratingMap = {}
    ;(ratings ?? []).forEach((r) => {
      if (!ratingMap[r.document_id]) ratingMap[r.document_id] = { sum: 0, count: 0, myRating: 0 }
      ratingMap[r.document_id].sum += r.rating
      ratingMap[r.document_id].count += 1
      if (r.user_id === user.id) ratingMap[r.document_id].myRating = r.rating
    })
    setDocLikes(likeMap)
    setDocRatings(ratingMap)
  }

  async function loadTabData(tab, schoolId, silent = false) {
    if (!schoolId) return
    const req = ++tabReq.current
    if (!silent) setTabLoading(true)
    try {
      if (tab === 'Posts') {
        // Fetch the members here so posts never load before we know who the members are
        const { data: members } = await supabase.from('profiles').select('id').eq('school_id', schoolId).eq('status', 'active')
        const ids = (members ?? []).map((m) => m.id)
        const { data } = ids.length
          ? await supabase.from('posts').select('*').in('author_id', ids).order('created_at', { ascending: false }).limit(20)
          : { data: [] }
        if (req === tabReq.current) setPosts(data ?? [])
      } else if (tab === 'Staff') {
        await refreshMembers(schoolId)
      } else if (tab === 'Media') {
        const { data } = await supabase.from('school_gallery').select('*').eq('school_id', schoolId).order('created_at', { ascending: false })
        if (req !== tabReq.current) return
        setGallery(data ?? [])
        await loadGalleryEngagement((data ?? []).map((g) => g.id))
      } else if (tab === 'Events') {
        const { data } = await supabase.from('events').select('*').eq('school_id', schoolId).order('event_date', { ascending: true })
        if (req === tabReq.current) setEvents(data ?? [])
      } else if (tab === 'Documents') {
        const { data } = await supabase.from('school_documents').select('*').eq('school_id', schoolId).order('created_at', { ascending: false })
        if (req !== tabReq.current) return
        setDocuments(data ?? [])
        await loadDocEngagement((data ?? []).map((d) => d.id))
      }
    } finally {
      if (req === tabReq.current) setTabLoading(false)
    }
  }

  function updateField(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSave() {
    if (!form.name?.trim()) {
      setMessage('Add the school name before saving.')
      return
    }
    setSaving(true)
    setMessage('')
    const { error } = await supabase
      .from('schools')
      .update({
        name: form.name.trim(),
        location: form.location,
        school_type: form.school_type,
        motto: form.motto,
        vision: form.vision,
        mission: form.mission,
        pass_rate: form.pass_rate || null,
        established_year: form.established_year,
        phone: form.phone,
        contact_email: form.contact_email,
        total_students: studentCount,
        total_teachers: form.total_teachers || null,
        non_teaching_staff: form.non_teaching_staff || null,
        total_classes: form.total_classes || null,
      })
      .eq('id', school.id)
    setSaving(false)
    if (error) {
      setMessage(`Couldn't save: ${error.message}`)
      return
    }
    setSchool((s) => ({ ...s, ...form, name: form.name.trim(), total_students: studentCount }))
    setMessage('Saved')
    setTimeout(() => setMessage(''), 2000)
  }

  async function handleLogoChange(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploadingLogo(true)
    const path = `${school.id}/logo.${extOf(file.name) || 'jpg'}`
    const { error } = await supabase.storage.from('school-media').upload(path, file, { upsert: true })
    if (error) {
      setToast("Couldn't upload the logo. Try again.")
    } else {
      const { data } = supabase.storage.from('school-media').getPublicUrl(path)
      const logoUrl = `${data.publicUrl}?t=${Date.now()}`
      await supabase.from('schools').update({ logo_url: logoUrl }).eq('id', school.id)
      setSchool((s) => ({ ...s, logo_url: logoUrl }))
      setForm((f) => ({ ...f, logo_url: logoUrl }))
      setToast('Logo updated')
    }
    setUploadingLogo(false)
  }

  // Uploads several photos, videos or documents one after another, with progress.
  async function uploadMany(fileList, kind) {
    const all = Array.from(fileList || [])
    const batch = all.slice(0, MAX_BATCH)
    const skipped = all.length - batch.length
    const tooBig = batch.filter((f) => f.size > MAX_FILE_MB * 1024 * 1024)
    const files = batch.filter((f) => f.size <= MAX_FILE_MB * 1024 * 1024)
    if (!files.length) {
      setToast(tooBig.length ? `Files must be under ${MAX_FILE_MB} MB` : 'Nothing to upload')
      return
    }

    setUploadProgress({ label: kind === 'gallery' ? 'Uploading photos and videos' : 'Uploading documents', done: 0, total: files.length })
    const added = []
    let failed = 0

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i]
      const stamp = `${Date.now()}-${i}`
      try {
        if (kind === 'gallery') {
          const ext = extOf(file.name) || (file.type.startsWith('video') ? 'mp4' : 'jpg')
          const path = `${school.id}/gallery/${stamp}.${ext}`
          const { error: upErr } = await supabase.storage.from('school-media').upload(path, file, { contentType: file.type || 'application/octet-stream' })
          if (upErr) throw upErr
          const { data: url } = supabase.storage.from('school-media').getPublicUrl(path)
          const { data: row, error: insErr } = await supabase
            .from('school_gallery')
            .insert({
              school_id: school.id,
              image_url: url.publicUrl,
              media_type: file.type.startsWith('video') ? 'video' : 'image',
              uploaded_by: user.id,
            })
            .select()
            .maybeSingle()
          if (insErr) throw insErr
          if (row) added.push(row)
        } else {
          const path = `${school.id}/documents/${stamp}-${safeFileName(file.name)}`
          const { error: upErr } = await supabase.storage.from('school-media').upload(path, file, { contentType: file.type || 'application/octet-stream' })
          if (upErr) throw upErr
          const { data: url } = supabase.storage.from('school-media').getPublicUrl(path)
          const { data: row, error: insErr } = await supabase
            .from('school_documents')
            .insert({ school_id: school.id, title: file.name, file_url: url.publicUrl, uploaded_by: user.id })
            .select()
            .maybeSingle()
          if (insErr) throw insErr
          if (row) added.push(row)
        }
      } catch {
        failed += 1
      }
      setUploadProgress((pr) => (pr ? { ...pr, done: i + 1 } : pr))
    }

    setUploadProgress(null)
    if (added.length) {
      if (kind === 'gallery') setGallery((prev) => [...added, ...prev.filter((x) => !added.some((a) => a.id === x.id))])
      else setDocuments((prev) => [...added, ...prev.filter((x) => !added.some((a) => a.id === x.id))])
    }
    const parts = [
      added.length ? `${added.length} added` : '',
      failed ? `${failed} failed` : '',
      tooBig.length ? `${tooBig.length} too large (max ${MAX_FILE_MB} MB)` : '',
      skipped ? `${skipped} skipped (max ${MAX_BATCH} at once)` : '',
    ].filter(Boolean)
    setToast(parts.join(' · ') || 'Nothing added')
  }

  // Deletes the database rows first, then the files. If the rows fail, nothing is lost.
  async function deleteItems(kind, list) {
    if (!list.length) return false
    const table = kind === 'gallery' ? 'school_gallery' : 'school_documents'
    const ids = list.map((x) => x.id)
    const { error } = await supabase.from(table).delete().in('id', ids)
    if (error) {
      setToast("Couldn't delete. Try again.")
      return false
    }
    const paths = list
      .map((x) => storagePathFromUrl(kind === 'gallery' ? x.image_url : x.file_url, 'school-media'))
      .filter(Boolean)
    if (paths.length) {
      try { await supabase.storage.from('school-media').remove(paths) } catch { /* the row is gone; leftover files are harmless */ }
    }
    if (kind === 'gallery') setGallery((prev) => prev.filter((x) => !ids.includes(x.id)))
    else setDocuments((prev) => prev.filter((x) => !ids.includes(x.id)))
    return true
  }

  async function deleteSelected() {
    const kind = activeTab === 'Documents' ? 'document' : 'gallery'
    const source = kind === 'gallery' ? gallery : documents
    const list = source.filter((x) => selectedIds.has(x.id))
    if (!list.length) return
    const noun = kind === 'gallery' ? (list.length === 1 ? 'item' : 'items') : (list.length === 1 ? 'document' : 'documents')
    if (!window.confirm(`Delete ${list.length} ${noun}? This cannot be undone.`)) return
    const ok = await deleteItems(kind, list)
    if (ok) {
      setSelectMode(false)
      setSelectedIds(new Set())
      setToast(`Deleted ${list.length}`)
    }
  }

  async function deleteOpenItem() {
    if (!lightboxItem) return
    const kind = lightboxItem.kind === 'gallery' ? 'gallery' : 'document'
    const noun = kind === 'gallery' ? 'item' : 'document'
    if (!window.confirm(`Delete this ${noun}? This cannot be undone.`)) return
    const ok = await deleteItems(kind, [lightboxItem])
    if (ok) setLightboxItem(null)
  }

  // Authors can delete their own posts. Everyone loses sight of it straight away.
  async function deletePost(post) {
    if (!window.confirm('Delete this post? Everyone will stop seeing it.')) return
    const { error } = await supabase.from('posts').delete().eq('id', post.id)
    if (error) {
      setToast("Couldn't delete that post.")
      return
    }
    setPosts((prev) => prev.filter((x) => x.id !== post.id))
    setToast('Post deleted')
  }

  function toggleSelected(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectMode() {
    if (selectMode) {
      setSelectMode(false)
      setSelectedIds(new Set())
    } else {
      setSelectMode(true)
    }
  }

  async function toggleGalleryLike(galleryId) {
    const current = galleryLikes[galleryId]
    if (current?.likedByMe) {
      await supabase.from('school_gallery_likes').delete().eq('gallery_id', galleryId).eq('user_id', user.id)
      setGalleryLikes((prev) => ({ ...prev, [galleryId]: { count: Math.max(0, (prev[galleryId]?.count || 1) - 1), likedByMe: false } }))
    } else {
      await supabase.from('school_gallery_likes').insert({ gallery_id: galleryId, user_id: user.id })
      setGalleryLikes((prev) => ({ ...prev, [galleryId]: { count: (prev[galleryId]?.count || 0) + 1, likedByMe: true } }))
    }
  }

  async function toggleDocLike(documentId) {
    const current = docLikes[documentId]
    if (current?.likedByMe) {
      await supabase.from('school_document_likes').delete().eq('document_id', documentId).eq('user_id', user.id)
      setDocLikes((prev) => ({ ...prev, [documentId]: { count: Math.max(0, (prev[documentId]?.count || 1) - 1), likedByMe: false } }))
    } else {
      await supabase.from('school_document_likes').insert({ document_id: documentId, user_id: user.id })
      setDocLikes((prev) => ({ ...prev, [documentId]: { count: (prev[documentId]?.count || 0) + 1, likedByMe: true } }))
    }
  }

  async function rateGalleryItem(galleryId, rating) {
    await supabase.from('school_gallery_ratings').upsert({ gallery_id: galleryId, user_id: user.id, rating }, { onConflict: 'gallery_id,user_id' })
    setGalleryRatings((prev) => {
      const existing = prev[galleryId] || { sum: 0, count: 0, myRating: 0 }
      const hadMine = existing.myRating > 0
      return { ...prev, [galleryId]: { sum: existing.sum - existing.myRating + rating, count: hadMine ? existing.count : existing.count + 1, myRating: rating } }
    })
  }

  async function rateDocument(documentId, rating) {
    await supabase.from('school_document_ratings').upsert({ document_id: documentId, user_id: user.id, rating }, { onConflict: 'document_id,user_id' })
    setDocRatings((prev) => {
      const existing = prev[documentId] || { sum: 0, count: 0, myRating: 0 }
      const hadMine = existing.myRating > 0
      return { ...prev, [documentId]: { sum: existing.sum - existing.myRating + rating, count: hadMine ? existing.count : existing.count + 1, myRating: rating } }
    })
  }

  function downloadItem(url, filename) {
    const a = document.createElement('a')
    a.href = url
    a.download = filename || ''
    a.target = '_blank'
    a.rel = 'noreferrer'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  function shareItem(url, title) {
    if (navigator.share) {
      navigator.share({ title: title || 'Schoolink', url }).catch(() => {})
    } else {
      navigator.clipboard?.writeText(url)
      setToast('Link copied')
    }
  }

  function openFollow() {
    setAsStudent(false)
    setFormValue('')
    setSheet('follow')
  }

  async function confirmFollow() {
    if (sheetBusy) return
    setSheetBusy(true)
    const { error } = await supabase.from('school_follows').insert({ school_id: school.id, user_id: user.id })
    if (error && error.code !== '23505') {
      setSheetBusy(false)
      setToast("Couldn't follow. Try again.")
      return
    }
    if (asStudent) await supabase.rpc('set_follow_form', { p_school: school.id, p_form: formValue, p_is_student: true })
    setIsFollowing(true)
    setFollowRow({ is_student: asStudent, form_class: asStudent ? formValue : null })
    refreshFollowerStats(school.id)
    setSheetBusy(false)
    setSheet(null)
    setToast(`You follow ${school.name}`)
  }

  async function unfollow() {
    const { error } = await supabase.from('school_follows').delete().eq('school_id', school.id).eq('user_id', user.id)
    if (error) {
      setToast("Couldn't unfollow. Try again.")
      return
    }
    setIsFollowing(false)
    setFollowRow(null)
    refreshFollowerStats(school.id)
  }

  const isStudentMember = isMember && profile?.role === 'Student'
  const myForm = isStudentMember ? profile?.class_name : followRow?.is_student ? followRow?.form_class : ''
  const showMyForm = isStudentMember || (isFollowing && followRow?.is_student)

  async function saveMyForm() {
    if (sheetBusy) return
    setSheetBusy(true)
    if (isStudentMember) {
      const { error } = await supabase.rpc('set_my_form', { p_form: formValue })
      if (error) {
        setSheetBusy(false)
        setToast("Couldn't save your form. Try again.")
        return
      }
      setProfileForm(formValue)
    } else {
      const { error } = await supabase.rpc('set_follow_form', { p_school: school.id, p_form: formValue, p_is_student: true })
      if (error) {
        setSheetBusy(false)
        setToast("Couldn't save your form. Try again.")
        return
      }
      setFollowRow((r) => ({ ...(r || {}), is_student: true, form_class: formValue }))
    }
    setSheetBusy(false)
    setSheet(null)
    setToast('Form updated')
  }

  function setProfileForm(v) {
    saveProfileDetails?.({ class_name: v })
  }

  // Headteacher only: removes the school. Members are moved out of the school but keep their accounts.
  async function removeStorageFolder(path) {
    const { data: items } = await supabase.storage.from('school-media').list(path, { limit: 1000 })
    const files = (items ?? []).filter((i) => i.id).map((i) => `${path}/${i.name}`)
    if (files.length) await supabase.storage.from('school-media').remove(files)
  }

  async function deleteSchool() {
    if (deleting || deleteText.trim().toLowerCase() !== (school.name || '').trim().toLowerCase()) return
    setDeleting(true)
    setDeleteError('')
    try {
      await removeStorageFolder(school.id)
      await removeStorageFolder(`${school.id}/gallery`)
      await removeStorageFolder(`${school.id}/documents`)
    } catch { /* files are best-effort */ }
    const { data: res, error } = await supabase.rpc('delete_school', { p_school: school.id })
    setDeleting(false)
    if (error || !res?.ok) { setDeleteError(res?.error || error?.message || 'Could not delete the school.'); return }
    window.location.hash = '#/home'
    window.location.reload()
  }

  function shareSchool() {
    const url = `${window.location.origin}${window.location.pathname}#/schools/${school.id}`
    if (navigator.share) navigator.share({ title: school.name, url }).catch(() => {})
    else { navigator.clipboard?.writeText(url); setToast('Link copied') }
  }

     function handleMessageSchool() {
    navigate(`/school-chat/${school.id}`)
       }

  function mapsUrl() {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(school?.location || '')}`
  }

  function goTab(t) {
    setActiveTab(t)
    setTimeout(() => tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }

  if (loading) {
    return (
      <div className="app-shell" style={{ background: p.surface }}>
        <div className="screen-scroll">
          <PageSkeleton p={p} onBack={() => navigate(-1)} />
        </div>
      </div>
    )
  }

  if (!school) {
    return (
      <div className="app-shell" style={{ background: p.surface }}>
        <BackHeader title="School" />
        <div className="screen-scroll px-6 flex items-center justify-center text-center" style={{ color: p.sub }}>
          {paramSchoolId ? 'School not found.' : "You're not linked to a school yet."}
        </div>
      </div>
    )
  }

  const aboutText = school.mission || school.description || ''
  const facts = [
    ['Type', school.school_type],
    ['Founded', school.established_year],
    ['Pass rate', school.pass_rate ? `${school.pass_rate}%` : ''],
    ['Classes', school.total_classes],
  ].filter(([, v]) => v)

  const showTabSkeleton = tabLoading && activeTab !== 'About'
  const selectingItems = selectMode && (activeTab === 'Media' || activeTab === 'Documents')
    return (
    <div className="app-shell" style={{ background: p.surface }}>
      <div className="screen-scroll">
        {/* Cover */}
        <div className="relative h-[168px] shrink-0" style={{ background: `linear-gradient(160deg, ${p.coverA}, ${p.coverB})` }}>
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              aria-label="Go back"
              className="w-9 h-9 rounded-full flex items-center justify-center text-white"
              style={{ background: 'rgba(0,0,0,0.28)' }}
            >
              <ChevronLeft size={21} />
            </button>
            <div className="flex gap-2">
              <button onClick={shareSchool} aria-label="Share" className="w-9 h-9 rounded-full flex items-center justify-center text-white" style={{ background: 'rgba(0,0,0,0.28)' }}>
                <Share2 size={16} />
              </button>
              {canManageMedia ? (
                <button onClick={() => navigate('/school-settings')} aria-label="School dashboard" className="w-9 h-9 rounded-full flex items-center justify-center text-white" style={{ background: 'rgba(0,0,0,0.28)' }}>
                  <Settings size={17} />
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* Identity */}
        <div className="px-5 -mt-12 relative">
          <div className="flex items-end justify-between gap-3">
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => school.logo_url && setViewingLogo(school.logo_url)}
                aria-label="View logo"
                className="w-[84px] h-[84px] rounded-[22px] flex items-center justify-center overflow-hidden"
                style={{ background: p.panel, boxShadow: `0 0 0 4px ${p.surface}` }}
              >
                {school.logo_url ? (
                  <img src={school.logo_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[26px] font-semibold tracking-tight" style={{ color: p.accent }}>{monogram(school.name)}</span>
                )}
              </button>
              {isOnline ? <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-green-500" style={{ boxShadow: `0 0 0 3px ${p.surface}` }} /> : null}
              {canEdit ? (
                <button
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadingLogo}
                  aria-label="Change logo"
                  className="absolute -top-1.5 -right-1.5 w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ background: p.accent, boxShadow: `0 0 0 3px ${p.surface}` }}
                >
                  {uploadingLogo ? <Loader2 size={12} color="#FFFFFF" className="animate-spin" /> : <Camera size={12} color="#FFFFFF" />}
                </button>
              ) : null}
              <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
            </div>

            <div className="flex items-center gap-2 pb-1">
              {!isMember ? (
                isFollowing ? (
                  <button onClick={unfollow} className="h-10 px-4 rounded-full text-[14px] font-medium border flex items-center gap-1.5" style={{ borderColor: p.line, color: p.ink }}>
                    <BellRing size={14} /> Following
                  </button>
                ) : (
                  <button onClick={openFollow} className="h-10 px-5 rounded-full text-[14px] font-semibold flex items-center gap-1.5" style={{ background: p.accent, color: p.accentInk }}>
                    <Bell size={14} /> Follow
                  </button>
                )
              ) : null}
              {canEdit ? (
                <button onClick={() => goTab('About')} className="h-10 px-4 rounded-full text-[14px] font-medium border flex items-center gap-1.5" style={{ borderColor: p.line, color: p.ink }}>
                  <Pencil size={13} /> Edit
                </button>
              ) : null}
              <button
                onClick={handleMessageSchool}
                aria-label="Message the headteacher"
                className="h-10 w-10 rounded-full border flex items-center justify-center"
                style={{ borderColor: p.line, color: p.ink }}
              >
                <MessageSquare size={16} />
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <h1 className="text-[22px] font-semibold tracking-[-0.02em] leading-tight" style={{ color: p.ink }}>{school.name}</h1>
            <VerifiedBadge schoolId={school.id} size={18} />
            {plusActive ? <SchoolPlusBadge schoolId={school.id} size={18} /> : null}
          </div>
          <p className="text-[13px] mt-1" style={{ color: p.sub }}>
            {handle}{school.school_type ? ` · ${school.school_type}` : ''}
            {isOnline ? <span className="text-green-600 font-medium"> · Online</span> : null}
          </p>

          {school.location ? (
            <a href={mapsUrl()} target="_blank" rel="noreferrer" className="mt-2.5 flex items-center gap-1.5 text-[14px]" style={{ color: p.ink }}>
              <MapPin size={14} style={{ color: p.accent }} className="shrink-0" />
              <span className="truncate">{school.location}</span>
            </a>
          ) : null}

          {school.motto ? (
            <p className="mt-3 text-[14px] leading-relaxed" style={{ color: p.sub }}>{school.motto}</p>
          ) : null}
        </div>

        {/* Counts */}
        <div className="mx-5 mt-6 grid grid-cols-4 rounded-2xl border" style={{ borderColor: p.line }}>
          {[
            [followerStats.follows, 'Followers'],
            [studentCount, 'Students'],
            [staffCount, 'Staff'],
            [memberCount, 'Members'],
          ].map(([n, label], i) => (
            <div key={label} className="py-3.5 text-center" style={{ borderLeft: i ? `1px solid ${p.line}` : 'none' }}>
              <p className="text-[18px] font-semibold tracking-tight tabular-nums leading-none" style={{ color: p.ink }}>{Number(n || 0).toLocaleString()}</p>
              <p className="text-[10px] uppercase tracking-[0.12em] mt-2" style={{ color: p.sub }}>{label}</p>
            </div>
          ))}
        </div>

        {canManageMedia ? (
          <button
            onClick={() => navigate('/school-settings')}
            className="mx-5 mt-3 w-[calc(100%-2.5rem)] flex items-center justify-between rounded-2xl border px-4 py-3.5 text-left"
            style={{ borderColor: p.line, color: p.ink }}
          >
            <span>
              <span className="block text-[14px] font-medium">School dashboard</span>
              <span className="block text-[12px] mt-0.5" style={{ color: p.sub }}>Learners, reports and school tools</span>
            </span>
            <ChevronRight size={18} style={{ color: p.faint }} />
          </button>
        ) : null}

        {showMyForm ? (
          <div className="mx-5 mt-3 rounded-2xl border px-4 py-3 flex items-center gap-3" style={{ borderColor: p.line }}>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] uppercase tracking-[0.12em]" style={{ color: p.sub }}>Your form</p>
              <p className="text-[15px] font-medium truncate mt-0.5" style={{ color: p.ink }}>{myForm || 'Not set yet'}</p>
            </div>
            <button onClick={() => { setFormValue(myForm || ''); setSheet('form') }} className="text-[14px] font-medium flex items-center gap-1" style={{ color: p.accent }}>
              <Pencil size={13} /> {myForm ? 'Change' : 'Add'}
            </button>
          </div>
        ) : null}

        {profile?.account_type === 'investor' ? (
          <button
            onClick={() => navigate(`/schools/${school.id}/propose`)}
            className="mx-5 mt-3 w-[calc(100%-2.5rem)] py-3.5 rounded-2xl text-[14px] font-semibold"
            style={{ background: p.accent, color: p.accentInk }}
          >
            Send investment proposal
          </button>
        ) : null}

        {/* Details */}
        {(facts.length || school.phone || school.contact_email) ? (
          <div className="mx-5 mt-7">
            <p className="text-[11px] uppercase tracking-[0.12em] mb-2" style={{ color: p.sub }}>Details</p>
            <dl className="rounded-2xl border divide-y" style={{ borderColor: p.line }}>
              {facts.map(([k, v]) => (
                <div key={k} className="flex items-center justify-between px-4 py-3" style={{ borderColor: p.line }}>
                  <dt className="text-[14px]" style={{ color: p.sub }}>{k}</dt>
                  <dd className="text-[14px] font-medium" style={{ color: p.ink }}>{v}</dd>
                </div>
              ))}
              {school.phone ? (
                <a href={`tel:${school.phone}`} className="flex items-center justify-between px-4 py-3" style={{ borderColor: p.line }}>
                  <span className="text-[14px] flex items-center gap-2" style={{ color: p.sub }}><Phone size={13} /> Phone</span>
                  <span className="text-[14px] font-medium" style={{ color: p.accent }}>{school.phone}</span>
                </a>
              ) : null}
              {school.contact_email ? (
                <a href={`mailto:${school.contact_email}`} className="flex items-center justify-between gap-3 px-4 py-3" style={{ borderColor: p.line }}>
                  <span className="text-[14px] flex items-center gap-2 shrink-0" style={{ color: p.sub }}><Mail size={13} /> Email</span>
                  <span className="text-[14px] font-medium truncate" style={{ color: p.accent }}>{school.contact_email}</span>
                </a>
              ) : null}
            </dl>
          </div>
        ) : null}

        {aboutText ? (
          <div className="mx-5 mt-7">
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-[11px] uppercase tracking-[0.12em]" style={{ color: p.sub }}>About</p>
              <button onClick={() => goTab('About')} className="text-[13px] font-medium" style={{ color: p.accent }}>Read more</button>
            </div>
            <p className="text-[14px] leading-relaxed line-clamp-3" style={{ color: p.ink }}>{aboutText}</p>
          </div>
        ) : null}

        {/* Recent media */}
        {gallery.length > 0 ? (
          <div className="mx-5 mt-7">
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-[11px] uppercase tracking-[0.12em]" style={{ color: p.sub }}>Recent photos</p>
              <button onClick={() => goTab('Media')} className="text-[13px] font-medium" style={{ color: p.accent }}>See all</button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {gallery.slice(0, 3).map((g) => (
                <button key={g.id} onClick={() => setLightboxItem({ ...g, kind: 'gallery' })} className="relative aspect-square rounded-xl overflow-hidden" style={{ background: p.panel }}>
                  {g.media_type === 'video' ? (
                    <>
                      <video src={g.image_url} className="w-full h-full object-cover" muted preload="metadata" />
                      <span className="absolute inset-0 flex items-center justify-center bg-black/20"><Video size={18} color="#FFFFFF" /></span>
                    </>
                  ) : (
                    <img src={g.image_url} alt="" className="w-full h-full object-cover" />
                  )}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Tabs */}
        <div ref={tabsRef} className="sticky top-0 z-20 mt-7 border-b scroll-mt-0" style={{ background: p.surface, borderColor: p.line }}>
          <div className="flex gap-7 overflow-x-auto px-5" style={{ scrollbarWidth: 'none' }}>
            {tabs.map((t) => {
              const on = activeTab === t
              return (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  aria-current={on ? 'page' : undefined}
                  className="relative py-3.5 text-[14px] shrink-0"
                  style={{ color: on ? p.ink : p.sub, fontWeight: on ? 600 : 500 }}
                >
                  {t}
                  {on ? <span className="absolute left-0 right-0 -bottom-px h-[2px]" style={{ background: p.accent }} /> : null}
                </button>
              )
            })}
          </div>
        </div>

        <div className={`px-5 pt-5 ${selectingItems ? 'pb-28' : 'pb-10'}`}>
          {showTabSkeleton ? <ListSkeleton p={p} /> : (
          <>

                      {activeTab === 'Posts' ? (
            posts.length === 0 ? (
              <EmptyNote p={p} text="No posts from this school yet." />
            ) : (
              <div className="space-y-3">
                {posts.map((post) => (
                  <div key={post.id} className="rounded-2xl border p-4" style={{ borderColor: p.line }}>
                    <div className="flex items-start justify-between gap-3">
                      <button onClick={() => navigate(`/post/${post.id}`)} className="flex-1 min-w-0 text-left">
                        <p className="text-[14px] font-semibold truncate" style={{ color: p.ink }}>{post.author_name}</p>
                        <p className="text-[11px] mt-0.5" style={{ color: p.faint }}>{dateLabel(post.created_at)}</p>
                      </button>
                      {post.author_id === user.id ? (
                        <button
                          type="button"
                          onClick={() => deletePost(post)}
                          aria-label="Delete post"
                          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                          style={{ color: p.danger }}
                        >
                          <Trash2 size={15} />
                        </button>
                      ) : null}
                    </div>
                    <button onClick={() => navigate(`/post/${post.id}`)} className="block w-full text-left mt-2">
                      <p className="text-[14px] leading-relaxed line-clamp-3" style={{ color: p.sub }}>{post.content}</p>
                    </button>
                  </div>
                ))}
              </div>
            )
          ) : null}

          {activeTab === 'About' ? (
            <div className="space-y-6">
              {canEdit ? (
                <div className="grid grid-cols-1 gap-4">
                  {[
                    ['School name', 'name'],
                    ['Location', 'location'],
                  ].map(([label, key]) => (
                    <div key={key}>
                      <p className="text-[11px] uppercase tracking-[0.12em] mb-1.5" style={{ color: p.sub }}>{label}</p>
                      <input
                        value={form[key] || ''}
                        onChange={(e) => updateField(key, e.target.value)}
                        className="w-full rounded-xl border px-3.5 py-3 text-[14px] outline-none"
                        style={{ borderColor: p.line, background: p.panel, color: p.ink }}
                      />
                    </div>
                  ))}
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.12em] mb-1.5" style={{ color: p.sub }}>School type</p>
                    <select
                      value={form.school_type || ''}
                      onChange={(e) => updateField('school_type', e.target.value)}
                      className="w-full rounded-xl border px-3.5 py-3 text-[14px] outline-none"
                      style={{ borderColor: p.line, background: p.panel, color: p.ink }}
                    >
                      <option value="">Select type</option>
                      <option value="Primary School">Primary School</option>
                      <option value="High School">High School</option>
                      <option value="Combined School">Combined School</option>
                      <option value="College">College</option>
                      <option value="University">University</option>
                    </select>
                  </div>
                </div>
              ) : null}

              {['motto', 'vision', 'mission'].map((key) => (
                <div key={key}>
                  <p className="text-[11px] uppercase tracking-[0.12em] mb-1.5" style={{ color: p.sub }}>{key}</p>
                  {canEdit ? (
                    <textarea
                      value={form[key] || ''}
                      onChange={(e) => updateField(key, e.target.value)}
                      rows={2}
                      className="w-full rounded-xl border px-3.5 py-3 text-[14px] outline-none resize-none"
                      style={{ borderColor: p.line, background: p.panel, color: p.ink }}
                    />
                  ) : (
                    <p className="text-[14px] leading-relaxed" style={{ color: p.ink }}>{school[key] || '—'}</p>
                  )}
                </div>
              ))}

              {canEdit ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      ['pass_rate', 'Pass rate %'],
                      ['established_year', 'Established year'],
                      ['total_teachers', 'Teachers'],
                      ['non_teaching_staff', 'Non-teaching staff'],
                      ['total_classes', 'Classes'],
                      ['phone', 'Phone'],
                      ['contact_email', 'Contact email'],
                    ].map(([key, label]) => (
                      <div key={key} className={key === 'contact_email' ? 'col-span-2' : ''}>
                        <p className="text-[11px] uppercase tracking-[0.12em] mb-1.5" style={{ color: p.sub }}>{label}</p>
                        <input
                          value={form[key] || ''}
                          onChange={(e) => updateField(key, e.target.value)}
                          className="w-full rounded-xl border px-3.5 py-3 text-[14px] outline-none"
                          style={{ borderColor: p.line, background: p.panel, color: p.ink }}
                        />
                      </div>
                    ))}
                    <div className="col-span-2 rounded-xl border px-3.5 py-3 text-[14px] flex items-center justify-between" style={{ borderColor: p.line, color: p.sub }}>
                      <span>Total students (from members)</span>
                      <span className="font-medium" style={{ color: p.ink }}>{studentCount}</span>
                    </div>
                  </div>
                  {message ? <p className="text-[13px]" style={{ color: p.accent }}>{message}</p> : null}
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full py-3.5 rounded-2xl text-[14px] font-semibold flex items-center justify-center disabled:opacity-50"
                    style={{ background: p.accent, color: p.accentInk }}
                  >
                    {saving ? <Loader2 size={18} className="animate-spin" color="#FFFFFF" /> : 'Save changes'}
                  </button>
                </>
              ) : null}

              {isMember && profile?.role === 'Headteacher' ? (
                <div className="pt-6 border-t" style={{ borderColor: p.line }}>
                  <p className="text-[11px] uppercase tracking-[0.12em] mb-1.5" style={{ color: p.danger }}>Delete school</p>
                  <p className="text-[13px] mb-3 leading-relaxed" style={{ color: p.sub }}>
                    This removes the school's profile, photos, documents, events and followers for good. Members keep their accounts but leave the school.
                  </p>
                  <button
                    onClick={() => { setDeleteText(''); setDeleteError(''); setDeleteOpen(true) }}
                    className="w-full flex items-center justify-center gap-2 border py-3 rounded-2xl text-[14px] font-medium"
                    style={{ borderColor: p.danger, color: p.danger }}
                  >
                    <Trash2 size={15} /> Delete school
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {activeTab === 'Staff' ? (
            staff.length === 0 ? (
              <EmptyNote p={p} text="No staff members yet." />
            ) : (
              <div>
                {staff.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-3.5 py-3.5" style={{ borderTop: i ? `1px solid ${p.line}` : 'none' }}>
                    {s.avatar_url ? (
                      <img src={s.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
                    ) : (
                      <span
                        className="w-11 h-11 rounded-full flex items-center justify-center text-[15px] font-semibold shrink-0"
                        style={{ background: p.accentSoft, color: p.accent }}
                      >
                        {monogram(s.full_name)}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-medium truncate" style={{ color: p.ink }}>{s.full_name || 'Staff member'}</p>
                      <p className="text-[12px] mt-0.5" style={{ color: p.sub }}>{s.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : null}

          {activeTab === 'Media' ? (
            <>
              <ContentToolbar
                p={p}
                count={gallery.length}
                noun="item"
                canManage={canManageMedia}
                hasItems={gallery.length > 0}
                selectMode={selectMode}
                onToggleSelect={toggleSelectMode}
                onUpload={() => galleryInputRef.current?.click()}
                busy={!!uploadProgress}
              />
              <input ref={galleryInputRef} type="file" accept="image/*,video/*" multiple onChange={(e) => { const files = e.target.files; e.target.value = ''; uploadMany(files, 'gallery') }} className="hidden" />
              {uploadProgress && activeTab === 'Media' ? <UploadBar p={p} progress={uploadProgress} /> : null}
              {!canManageMedia ? <p className="text-[12px] mb-3" style={{ color: p.faint }}>Only school staff can add photos and videos.</p> : null}

              {gallery.length === 0 ? (
                <EmptyNote p={p} text="No photos or videos yet." />
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {gallery.map((g) => {
                    const on = selectedIds.has(g.id)
                    return (
                      <button
                        key={g.id}
                        onClick={() => (selectMode ? toggleSelected(g.id) : setLightboxItem({ ...g, kind: 'gallery' }))}
                        className="relative aspect-square rounded-xl overflow-hidden"
                        style={{ background: p.panel, outline: selectMode && on ? `2px solid ${p.accent}` : 'none', outlineOffset: -2 }}
                      >
                        {g.media_type === 'video' ? (
                          <>
                            <video src={g.image_url} className="w-full h-full object-cover" muted preload="metadata" />
                            <span className="absolute inset-0 flex items-center justify-center bg-black/20"><Video size={18} color="#FFFFFF" /></span>
                          </>
                        ) : (
                          <img src={g.image_url} alt="" className="w-full h-full object-cover" />
                        )}
                        {selectMode ? <SelectMark p={p} on={on} /> : null}
                        {!selectMode && galleryLikes[g.id]?.count > 0 ? (
                          <span className="absolute bottom-1.5 left-1.5 bg-black/55 text-white text-[10px] rounded-full px-2 py-0.5 flex items-center gap-1">
                            <Heart size={10} color="#FFFFFF" fill="#FFFFFF" /> {galleryLikes[g.id].count}
                          </span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          ) : null}

          {activeTab === 'Events' ? (
            <>
              {canManageMedia ? (
                <button
                  onClick={() => navigate('/calendar/create')}
                  className="w-full flex items-center justify-center gap-2 border rounded-2xl py-3 text-[14px] font-medium mb-4"
                  style={{ borderColor: p.line, color: p.ink }}
                >
                  <Plus size={16} /> Add event
                </button>
              ) : null}
              {events.length === 0 ? (
                <EmptyNote p={p} text="No events scheduled." />
              ) : (
                <div>
                  {events.map((e, i) => {
                    const d = new Date(e.event_date)
                    return (
                      <div key={e.id} className="flex items-center gap-4 py-3.5" style={{ borderTop: i ? `1px solid ${p.line}` : 'none' }}>
                        <div className="w-14 shrink-0 text-center rounded-xl py-2" style={{ background: p.panel }}>
                          <p className="text-[10px] uppercase tracking-[0.12em]" style={{ color: p.accent }}>{d.toLocaleDateString(undefined, { month: 'short' })}</p>
                          <p className="text-[20px] font-semibold leading-none mt-1" style={{ color: p.ink }}>{d.getDate()}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[14px] font-medium truncate" style={{ color: p.ink }}>{e.title}</p>
                          <p className="text-[12px] mt-0.5" style={{ color: p.sub }}>{d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          ) : null}

          {activeTab === 'Documents' ? (
            <>
              <ContentToolbar
                p={p}
                count={documents.length}
                noun="document"
                canManage={canManageMedia}
                hasItems={documents.length > 0}
                selectMode={selectMode}
                onToggleSelect={toggleSelectMode}
                onUpload={() => docInputRef.current?.click()}
                busy={!!uploadProgress}
              />
              <input ref={docInputRef} type="file" multiple onChange={(e) => { const files = e.target.files; e.target.value = ''; uploadMany(files, 'documents') }} className="hidden" />
              {uploadProgress && activeTab === 'Documents' ? <UploadBar p={p} progress={uploadProgress} /> : null}
              {!canManageMedia ? <p className="text-[12px] mb-3" style={{ color: p.faint }}>Only school staff can add documents.</p> : null}

              {documents.length === 0 ? (
                <EmptyNote p={p} text="No documents yet." />
              ) : (
                <div>
                  {documents.map((d, i) => {
                    const on = selectedIds.has(d.id)
                    const ext = extOf(d.title).toUpperCase().slice(0, 4) || 'FILE'
                    return (
                      <div key={d.id} className="flex items-center gap-3 py-3.5" style={{ borderTop: i ? `1px solid ${p.line}` : 'none' }}>
                        {selectMode ? <SelectMark p={p} on={on} inline /> : null}
                        <button
                          onClick={() => (selectMode ? toggleSelected(d.id) : setLightboxItem({ ...d, kind: 'document' }))}
                          className="flex-1 min-w-0 flex items-center gap-3.5 text-left"
                        >
                          <span className="w-11 h-11 rounded-xl flex items-center justify-center text-[10px] font-semibold tracking-wide shrink-0" style={{ background: p.panel, color: p.accent }}>
                            {ext}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[14px] font-medium truncate" style={{ color: p.ink }}>{d.title}</span>
                            <span className="block text-[12px] mt-0.5" style={{ color: p.sub }}>
                              {dateLabel(d.created_at)}
                              {docLikes[d.id]?.count > 0 ? ` · ${docLikes[d.id].count} like${docLikes[d.id].count > 1 ? 's' : ''}` : ''}
                              {docRatings[d.id]?.count > 0 ? ` · ${(docRatings[d.id].sum / docRatings[d.id].count).toFixed(1)} rating` : ''}
                            </span>
                          </span>
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          ) : null}
          </>
          )}
        </div>
      </div>

            {selectingItems ? (
        <div className="absolute left-4 right-4 bottom-5 z-40 rounded-2xl px-4 py-3 flex items-center justify-between shadow-lg" style={{ background: p.ink, color: p.surface }}>
          <span className="text-[14px] font-medium">{selectedIds.size} selected</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const list = activeTab === 'Documents' ? documents : gallery
                setSelectedIds(new Set(list.map((x) => x.id)))
              }}
              className="h-9 px-3 rounded-full text-[13px] font-medium"
              style={{ color: p.surface }}
            >
              All
            </button>
            <button
              type="button"
              onClick={deleteSelected}
              disabled={selectedIds.size === 0}
              className="h-9 px-4 rounded-full text-[13px] font-semibold flex items-center gap-1.5 disabled:opacity-40"
              style={{ background: p.danger, color: '#FFFFFF' }}
            >
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </div>
      ) : null}

      {toast && !lightboxItem ? (
        <div role="status" className="absolute left-1/2 -translate-x-1/2 z-50 text-[13px] rounded-full px-4 py-2 shadow-lg whitespace-nowrap" style={{ bottom: selectingItems ? 92 : 24, background: p.ink, color: p.surface }}>
          {toast}
        </div>
      ) : null}

      {sheet ? (
        <div className="absolute inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => !sheetBusy && setSheet(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full rounded-t-3xl px-6 pt-3 pb-8 max-h-[88%] overflow-y-auto" style={{ background: p.surface }}>
            <span className="block w-10 h-1 rounded-full mx-auto mb-5" style={{ background: p.line }} />
            {sheet === 'follow' ? (
              <>
                <p className="text-[18px] font-semibold tracking-tight" style={{ color: p.ink }}>Follow {school.name}</p>
                <p className="text-[14px] mt-1.5" style={{ color: p.sub }}>See their posts, events and news.</p>
                <button
                  type="button"
                  onClick={() => setAsStudent((v) => !v)}
                  className="mt-5 w-full flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left"
                  style={{ borderColor: asStudent ? p.accent : p.line }}
                >
                  <span className="w-5 h-5 rounded-md flex items-center justify-center shrink-0" style={{ background: asStudent ? p.accent : 'transparent', border: `2px solid ${asStudent ? p.accent : p.faint}` }}>
                    {asStudent ? <Check size={12} color="#FFFFFF" strokeWidth={3} /> : null}
                  </span>
                  <span className="flex-1">
                    <span className="block text-[14px] font-medium" style={{ color: p.ink }}>I'm a student at this school</span>
                    <span className="block text-[12px] mt-0.5" style={{ color: p.sub }}>Tell them which form you are in</span>
                  </span>
                </button>
                {asStudent ? <div className="mt-4"><FormPicker value={formValue} onChange={setFormValue} schoolType={school.school_type} /></div> : null}
                <button
                  onClick={confirmFollow}
                  disabled={sheetBusy || (asStudent && !formValue.trim())}
                  className="mt-6 w-full py-3.5 rounded-2xl text-[14px] font-semibold disabled:opacity-40 flex items-center justify-center"
                  style={{ background: p.accent, color: p.accentInk }}
                >
                  {sheetBusy ? <Loader2 size={18} color="#FFFFFF" className="animate-spin" /> : 'Follow'}
                </button>
              </>
            ) : (
              <>
                <p className="text-[18px] font-semibold tracking-tight" style={{ color: p.ink }}>Which form are you in?</p>
                <div className="mt-4"><FormPicker value={formValue} onChange={setFormValue} schoolType={school.school_type} /></div>
                <button
                  onClick={saveMyForm}
                  disabled={sheetBusy || !formValue.trim()}
                  className="mt-6 w-full py-3.5 rounded-2xl text-[14px] font-semibold disabled:opacity-40 flex items-center justify-center"
                  style={{ background: p.accent, color: p.accentInk }}
                >
                  {sheetBusy ? <Loader2 size={18} color="#FFFFFF" className="animate-spin" /> : 'Save'}
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}

      {lightboxItem ? (
        <div className="absolute inset-0 z-50 flex flex-col" style={{ background: '#05040C' }}>
          <div className="flex items-center justify-between px-5 py-4">
            <p className="text-white text-[14px] font-medium truncate pr-3">
              {lightboxItem.kind === 'document' ? lightboxItem.title : 'Photo'}
            </p>
            <button onClick={() => setLightboxItem(null)} aria-label="Close" className="text-white shrink-0">
              <X size={22} />
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center px-4 min-h-0">
            {lightboxItem.kind === 'gallery' ? (
              lightboxItem.media_type === 'video' ? (
                <video src={lightboxItem.image_url} className="max-w-full max-h-full rounded-xl" controls />
              ) : (
                <img src={lightboxItem.image_url} alt="" className="max-w-full max-h-full rounded-xl object-contain" />
              )
            ) : (
              <div className="rounded-2xl px-10 py-12 flex flex-col items-center gap-4" style={{ background: p.surface }}>
                <span className="w-16 h-16 rounded-2xl flex items-center justify-center text-[12px] font-semibold tracking-wide" style={{ background: p.panel, color: p.accent }}>
                  {extOf(lightboxItem.title).toUpperCase().slice(0, 4) || 'FILE'}
                </span>
                <p className="text-[14px] text-center" style={{ color: p.ink }}>{lightboxItem.title}</p>
              </div>
            )}
          </div>

          <div className="rounded-t-3xl px-5 pt-5 pb-7 space-y-4" style={{ background: p.surface }}>
            <div className="flex items-center justify-between">
              <button
                onClick={() => (lightboxItem.kind === 'gallery' ? toggleGalleryLike(lightboxItem.id) : toggleDocLike(lightboxItem.id))}
                className="flex items-center gap-2 text-[14px] font-medium"
                style={{ color: p.ink }}
              >
                <Heart
                  size={18}
                  color={(lightboxItem.kind === 'gallery' ? galleryLikes[lightboxItem.id]?.likedByMe : docLikes[lightboxItem.id]?.likedByMe) ? p.danger : p.faint}
                  fill={(lightboxItem.kind === 'gallery' ? galleryLikes[lightboxItem.id]?.likedByMe : docLikes[lightboxItem.id]?.likedByMe) ? p.danger : 'none'}
                />
                {(lightboxItem.kind === 'gallery' ? galleryLikes[lightboxItem.id]?.count : docLikes[lightboxItem.id]?.count) || 0}
              </button>

              <StarRow
                p={p}
                average={
                  lightboxItem.kind === 'gallery'
                    ? (galleryRatings[lightboxItem.id]?.count ? galleryRatings[lightboxItem.id].sum / galleryRatings[lightboxItem.id].count : 0)
                    : (docRatings[lightboxItem.id]?.count ? docRatings[lightboxItem.id].sum / docRatings[lightboxItem.id].count : 0)
                }
                myRating={(lightboxItem.kind === 'gallery' ? galleryRatings[lightboxItem.id]?.myRating : docRatings[lightboxItem.id]?.myRating) || 0}
                count={(lightboxItem.kind === 'gallery' ? galleryRatings[lightboxItem.id]?.count : docRatings[lightboxItem.id]?.count) || 0}
                interactive
                size={17}
                onRate={(n) => (lightboxItem.kind === 'gallery' ? rateGalleryItem(lightboxItem.id, n) : rateDocument(lightboxItem.id, n))}
              />
            </div>

            <div className="flex gap-2">
              {lightboxItem.kind === 'document' ? (
                <button
                  onClick={() => window.open(lightboxItem.file_url, '_blank', 'noreferrer')}
                  className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-[13px] font-semibold"
                  style={{ background: p.accent, color: p.accentInk }}
                >
                  <ExternalLink size={15} /> Open
                </button>
              ) : null}
              <button
                onClick={() => downloadItem(lightboxItem.kind === 'gallery' ? lightboxItem.image_url : lightboxItem.file_url, lightboxItem.title)}
                className="flex-1 flex items-center justify-center gap-1.5 border py-3 rounded-xl text-[13px] font-medium"
                style={{ borderColor: p.line, color: p.ink }}
              >
                <Download size={15} /> Download
              </button>
              <button
                onClick={() => shareItem(lightboxItem.kind === 'gallery' ? lightboxItem.image_url : lightboxItem.file_url, lightboxItem.title)}
                className="flex-1 flex items-center justify-center gap-1.5 border py-3 rounded-xl text-[13px] font-medium"
                style={{ borderColor: p.line, color: p.ink }}
              >
                <Share2 size={15} /> Share
              </button>
              {canManageMedia ? (
                <button
                  onClick={deleteOpenItem}
                  aria-label="Delete"
                  className="flex items-center justify-center border py-3 px-3.5 rounded-xl"
                  style={{ borderColor: p.danger, color: p.danger }}
                >
                  <Trash2 size={15} />
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {deleteOpen ? (
        <div className="absolute inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => !deleting && setDeleteOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full rounded-t-3xl px-6 pt-3 pb-8" style={{ background: p.surface }}>
            <span className="block w-10 h-1 rounded-full mx-auto mb-5" style={{ background: p.line }} />
            <p className="text-[18px] font-semibold tracking-tight" style={{ color: p.danger }}>Delete {school.name}?</p>
            <p className="text-[14px] mt-1.5 leading-relaxed" style={{ color: p.sub }}>This cannot be undone. Type the school's name to confirm.</p>
            <input
              value={deleteText}
              onChange={(e) => setDeleteText(e.target.value)}
              placeholder={school.name}
              className="mt-5 w-full rounded-xl border px-4 py-3 text-[14px] outline-none"
              style={{ borderColor: p.line, background: p.panel, color: p.ink }}
            />
            {deleteError ? <p className="text-[13px] mt-2" style={{ color: p.danger }}>{deleteError}</p> : null}
            <div className="flex gap-2 mt-5">
              <button onClick={() => setDeleteOpen(false)} disabled={deleting} className="flex-1 border rounded-2xl py-3.5 text-[14px] font-medium" style={{ borderColor: p.line, color: p.ink }}>Cancel</button>
              <button
                onClick={deleteSchool}
                disabled={deleting || deleteText.trim().toLowerCase() !== (school.name || '').trim().toLowerCase()}
                className="flex-1 rounded-2xl py-3.5 text-[14px] font-semibold disabled:opacity-40 flex items-center justify-center"
                style={{ background: p.danger, color: '#FFFFFF' }}
              >
                {deleting ? <Loader2 size={18} color="#FFFFFF" className="animate-spin" /> : 'Delete forever'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {viewingLogo ? <AvatarViewer imageUrl={viewingLogo} onClose={() => setViewingLogo(null)} /> : null}
    </div>
  )
                      }
