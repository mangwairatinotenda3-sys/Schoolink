import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Camera, MapPin, Phone, Mail, MessageSquare, Plus, ExternalLink, Bell, BellRing, Video,
  Download, Share2, Heart, Star, Trash2, X, ChevronLeft, ChevronRight, Settings, Pencil, Loader2, Check, Upload,
  MoreVertical, Eye, CircleDot, Link2, UserMinus, ImagePlus,
} from 'lucide-react'
import VerifiedBadge, { refreshVerifiedIds } from '../components/VerifiedBadge.jsx'
import SchoolPlusBadge, { useIsPlusSchool } from '../components/SchoolPlusBadge.jsx'
import FormPicker from '../components/FormPicker.jsx'
import AvatarViewer from '../components/AvatarViewer.jsx'
import BackHeader from '../components/BackHeader.jsx'
import BottomSheet, { SheetAction } from '../components/BottomSheet.jsx'
import StatusRing from '../components/StatusRing.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { canManageStaff, isStaffMember } from '../lib/permissions.js'
import { timeAgo } from '../lib/statusUtils.js'
import { useOnlineIds } from '../lib/presence.jsx'

const tabs = ['Posts', 'About', 'Staff', 'Media', 'Events', 'Documents']
const ROLE_RANK = { Headteacher: 0, 'Deputy Head': 1 }
const MAX_FILE_MB = 50
const MAX_BATCH = 30
const DAY_MS = 24 * 60 * 60 * 1000

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

// Full-screen viewer for a school's updates. Tap the right side for the next one, the left for the previous one.
function UpdateViewer({ list, index, onIndex, onClose, school, canDelete, onDelete }) {
  const u = list[index]
  if (!u) return null
  const next = () => (index < list.length - 1 ? onIndex(index + 1) : onClose())
  const prev = () => { if (index > 0) onIndex(index - 1) }
  const hasMedia = !!u.media_url
  const isVideo = u.media_type === 'video'
  const initial = (school.name || '?').trim().slice(0, 1).toUpperCase()

  return (
    <div className="absolute inset-0 z-[60] flex flex-col text-white" style={{ background: '#05040C' }}>
      <div className="px-3 pt-3 flex gap-1">
        {list.map((x, i) => (
          <span key={x.id} className="flex-1 h-[3px] rounded-full" style={{ background: i <= index ? '#FFFFFF' : 'rgba(255,255,255,0.3)' }} />
        ))}
      </div>

      <div className="flex items-center gap-3 px-4 py-3">
        {school.logo_url ? (
          <img src={school.logo_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
        ) : (
          <span className="w-9 h-9 rounded-full flex items-center justify-center text-[14px] font-semibold shrink-0" style={{ background: '#6C4CE0' }}>{initial}</span>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold truncate">{school.name}</p>
          <p className="text-[11px] text-white/60">{timeAgo(u.created_at)}</p>
        </div>
        {canDelete ? (
          <button type="button" onClick={() => onDelete(u)} aria-label="Delete update" className="w-9 h-9 rounded-full flex items-center justify-center">
            <Trash2 size={17} />
          </button>
        ) : null}
        <button type="button" onClick={onClose} aria-label="Close" className="w-9 h-9 flex items-center justify-center">
          <X size={22} />
        </button>
      </div>

      <div className="flex-1 min-h-0 relative flex items-center justify-center overflow-hidden">
        {hasMedia && isVideo ? (
          <video key={u.id} src={u.media_url} className="max-w-full max-h-full" autoPlay playsInline controls />
        ) : hasMedia ? (
          <img src={u.media_url} alt="" className="max-w-full max-h-full object-contain" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center px-8" style={{ background: 'linear-gradient(160deg, #6D4DFF, #241B4E)' }}>
            <p className="text-center text-[26px] font-bold leading-snug whitespace-pre-wrap break-words">{u.content}</p>
          </div>
        )}
        <button type="button" aria-label="Previous update" onClick={prev} className="absolute left-0 top-0 w-1/3 z-10" style={{ bottom: hasMedia ? 56 : 0 }} />
        <button type="button" aria-label="Next update" onClick={next} className="absolute right-0 top-0 w-2/3 z-10" style={{ bottom: hasMedia ? 56 : 0 }} />
      </div>

      {hasMedia && u.content ? <p className="px-5 pb-6 pt-2 text-[15px] text-center">{u.content}</p> : null}
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
  const composerInputRef = useRef(null)
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

  const [updates, setUpdates] = useState([]) // the school's updates from the last 24 hours
  const [seenUpdateIds, setSeenUpdateIds] = useState(() => new Set())
  const [updateIndex, setUpdateIndex] = useState(null)

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
  const [moreOpen, setMoreOpen] = useState(false)
  const [unfollowOpen, setUnfollowOpen] = useState(false)
  const [asStudent, setAsStudent] = useState(false)
  const [formValue, setFormValue] = useState('')
  const [sheetBusy, setSheetBusy] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteText, setDeleteText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const [composer, setComposer] = useState(null) // 'post' | 'update' | null
  const [composerText, setComposerText] = useState('')
  const [composerFile, setComposerFile] = useState(null) // { file, kind, url }
  const [composerBusy, setComposerBusy] = useState(false)
  const [composerError, setComposerError] = useState('')
  const plusActive = useIsPlusSchool(school?.id)

  const isMember = !!school && profile?.school_id === school.id
  const canEdit = isMember && canManageStaff(profile)
  const canManageMedia = isMember && isStaffMember(profile)
  const isOnline = memberIds.some((id) => onlineIds.has(id))
  const handle = school?.name ? '@' + school.name.toLowerCase().replace(/[^a-z0-9]/g, '') : ''
  const unseenUpdates = updates.filter((u) => !seenUpdateIds.has(u.id)).length

  // Authors can delete their own posts. Staff can delete any post from their school's members.
  const canDeletePost = (post) => post.author_id === user?.id || canManageMedia

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

  // Photos, documents, events and updates stay live for everyone looking at the school
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'statuses', filter: `school_author_id=eq.${school.id}` }, () => loadSchoolUpdates(school.id))
      .subscribe()
    return () => {
      clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [school?.id])

  // Opening an update marks it as seen, the same way a status is marked seen for a person
  useEffect(() => {
    if (updateIndex === null || !user) return
    const u = updates[updateIndex]
    if (!u || seenUpdateIds.has(u.id)) return
    setSeenUpdateIds((prev) => new Set(prev).add(u.id))
    supabase.from('status_views').insert({ status_id: u.id, viewer_id: user.id }).then(() => {})
  }, [updateIndex, updates])

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

  // The school's updates from the last 24 hours, and which of them I have already seen
  async function loadSchoolUpdates(schoolId) {
    const cutoff = new Date(Date.now() - DAY_MS).toISOString()
    const { data } = await supabase
      .from('statuses')
      .select('*')
      .eq('school_author_id', schoolId)
      .gt('created_at', cutoff)
      .order('created_at', { ascending: true })
    const list = data ?? []
    setUpdates(list)
    if (!list.length || !user) {
      setSeenUpdateIds(new Set())
      return
    }
    const { data: views } = await supabase.from('status_views').select('status_id').eq('viewer_id', user.id).in('status_id', list.map((s) => s.id))
    setSeenUpdateIds(new Set((views ?? []).map((v) => v.status_id)))
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
      loadSchoolUpdates(data.id)

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

  // One photo, video or document, from its tile
  function deleteOne(kind, item) {
    const noun = kind === 'gallery' ? 'item' : 'document'
    if (!window.confirm(`Delete this ${noun}? This cannot be undone.`)) return
    deleteItems(kind, [item]).then((ok) => { if (ok) setToast('Deleted') })
  }

  async function deleteOpenItem() {
    if (!lightboxItem) return
    const kind = lightboxItem.kind === 'gallery' ? 'gallery' : 'document'
    const noun = kind === 'gallery' ? 'item' : 'document'
    if (!window.confirm(`Delete this ${noun}? This cannot be undone.`)) return
    const ok = await deleteItems(kind, [lightboxItem])
    if (ok) setLightboxItem(null)
  }

  // Authors and school staff can delete a post. Everyone loses sight of it straight away.
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

  // Staff can take down a school update. It disappears for everyone straight away.
  async function deleteUpdate(u) {
    if (!window.confirm('Delete this update? This cannot be undone.')) return
    const { error } = await supabase.from('statuses').delete().eq('id', u.id)
    if (error) {
      setToast("Couldn't delete that update.")
      return
    }
    const path = storagePathFromUrl(u.media_url, 'school-media')
    if (path) {
      try { await supabase.storage.from('school-media').remove([path]) } catch { /* the update is gone; leftover files are harmless */ }
    }
    setUpdates((prev) => prev.filter((x) => x.id !== u.id))
    setUpdateIndex(null)
    setToast('Update deleted')
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
    setUnfollowOpen(false)
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
      await removeStorageFolder(`${school.id}/posts`)
      await removeStorageFolder(`${school.id}/updates`)
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

  async function copySchoolLink() {
    setMoreOpen(false)
    const url = `${window.location.origin}${window.location.pathname}#/schools/${school.id}`
    try {
      await navigator.clipboard.writeText(url)
      setToast('School link copied')
    } catch {
      setToast("Couldn't copy the link")
    }
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

  // Logo tap: the school's updates if there are any, otherwise the full logo (the same as a profile photo)
  function onLogoTap() {
    if (updates.length) setUpdateIndex(0)
    else if (school.logo_url) setViewingLogo(school.logo_url)
  }

  function openComposer(kind) {
    if (composerFile) URL.revokeObjectURL(composerFile.url)
    setComposer(kind)
    setComposerText('')
    setComposerFile(null)
    setComposerError('')
  }

  function closeComposer() {
    if (composerBusy) return
    if (composerFile) URL.revokeObjectURL(composerFile.url)
    setComposerFile(null)
    setComposer(null)
  }

  function pickComposerFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setComposerError(`Files must be under ${MAX_FILE_MB} MB`)
      return
    }
    if (composerFile) URL.revokeObjectURL(composerFile.url)
    setComposerError('')
    setComposerFile({ file, kind: file.type.startsWith('video') ? 'video' : 'image', url: URL.createObjectURL(file) })
  }

  // Posts as the school (shows in the Posts tab and every feed) or shares a 24-hour update
  async function submitComposer() {
    if (composerBusy || !school || !composer) return
    const text = composerText.trim()
    if (!text && !composerFile) {
      setComposerError(composer === 'post' ? 'Write something or add a photo or video.' : 'Add some words, a photo or a video.')
      return
    }
    setComposerBusy(true)
    setComposerError('')
    try {
      let mediaUrl = null
      if (composerFile) {
        const ext = extOf(composerFile.file.name) || (composerFile.kind === 'video' ? 'mp4' : 'jpg')
        const folder = composer === 'post' ? 'posts' : 'updates'
        const path = `${school.id}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`
        const { error: upErr } = await supabase.storage.from('school-media').upload(path, composerFile.file, { contentType: composerFile.file.type || 'application/octet-stream' })
        if (upErr) throw upErr
        mediaUrl = supabase.storage.from('school-media').getPublicUrl(path).data.publicUrl
      }
      const isImage = composerFile?.kind === 'image'
      const isVideo = composerFile?.kind === 'video'

      if (composer === 'post') {
        const { error } = await supabase.from('posts').insert({
          author_id: user.id,
          author_name: school.name,
          author_role: 'School',
          as_school_id: school.id,
          content: text,
          category: 'General',
          image_urls: isImage ? [mediaUrl] : null,
          video_url: isVideo ? mediaUrl : null,
          file_url: null,
          file_name: null,
          comments_off: false,
          location: null,
        })
        if (error) throw error
        setToast(`Posted as ${school.name}`)
        loadTabData('Posts', school.id, true)
      } else {
        const { error } = await supabase.from('statuses').insert({
          user_id: user.id,
          school_id: school.id,
          school_author_id: school.id,
          audience: 'public',
          content: text,
          bg_color: 'theme',
          font_style: 'classic',
          media_type: composerFile ? composerFile.kind : null,
          media_url: mediaUrl,
          image_url: isImage ? mediaUrl : null,
          thumb_url: null,
          duration_seconds: null,
        })
        if (error) throw error
        setToast('Update shared')
        loadSchoolUpdates(school.id)
      }

      if (composerFile) URL.revokeObjectURL(composerFile.url)
      setComposerFile(null)
      setComposer(null)
    } catch (err) {
      setComposerError(`Couldn't share that: ${err?.message || 'something went wrong'}`)
    } finally {
      setComposerBusy(false)
}
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
              <button onClick={() => setMoreOpen(true)} aria-label="More" className="w-9 h-9 rounded-full flex items-center justify-center text-white" style={{ background: 'rgba(0,0,0,0.28)' }}>
                <MoreVertical size={17} />
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
                onClick={onLogoTap}
                aria-label={updates.length ? 'View updates' : 'View logo'}
                className="w-[84px] h-[84px] rounded-[22px] flex items-center justify-center overflow-hidden"
                style={{
                  background: p.panel,
                  boxShadow: updates.length
                    ? `0 0 0 4px ${p.surface}, 0 0 0 6.5px ${unseenUpdates ? p.accent : '#CBD5E1'}`
                    : `0 0 0 4px ${p.surface}`,
                }}
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
                  <button onClick={() => setUnfollowOpen(true)} className="h-10 px-4 rounded-full text-[14px] font-medium border flex items-center gap-1.5" style={{ borderColor: p.line, color: p.ink }}>
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

        {/* Updates: the school's 24-hour updates, like a person's status row */}
        {(updates.length > 0 || canManageMedia) ? (
          <div className="mt-7">
            <div className="mx-5 flex items-baseline justify-between mb-3">
              <p className="text-[11px] uppercase tracking-[0.12em]" style={{ color: p.sub }}>Updates</p>
              <p className="text-[12px]" style={{ color: p.faint }}>Last 24 hours</p>
            </div>
            <div className="flex gap-3.5 overflow-x-auto px-5 pb-1" style={{ scrollbarWidth: 'none' }}>
              {canManageMedia ? (
                <button type="button" onClick={() => openComposer('update')} className="shrink-0 w-[68px] flex flex-col items-center gap-1.5">
                  <span className="w-[62px] h-[62px] rounded-full border-2 border-dashed flex items-center justify-center" style={{ borderColor: p.accent, color: p.accent }}>
                    <Plus size={20} />
                  </span>
                  <span className="text-[11px] text-center" style={{ color: p.sub }}>Add update</span>
                </button>
              ) : null}
              {updates.map((u, i) => {
                const seen = seenUpdateIds.has(u.id)
                const thumb = u.media_type === 'image' && u.media_url ? u.media_url : school.logo_url
                return (
                  <button key={u.id} type="button" onClick={() => setUpdateIndex(i)} className="shrink-0 w-[68px] flex flex-col items-center gap-1.5">
                    <StatusRing
                      src={thumb}
                      name={school.name}
                      size={62}
                      flags={[seen]}
                      seenColor="#CBD5E1"
                      unseenColor={p.accent}
                    />
                    <span className="text-[11px] text-center" style={{ color: p.sub }}>{timeAgo(u.created_at)}</span>
                  </button>
                )
              })}
            </div>
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
                <>
                  {canManageMedia ? (
                    <button
                      type="button"
                      onClick={() => openComposer('post')}
                      className="w-full flex items-center justify-center gap-2 border rounded-2xl py-3 text-[14px] font-medium mb-4"
                      style={{ borderColor: p.line, color: p.ink }}
                    >
                      <Plus size={16} /> Post as {school.name}
                    </button>
                  ) : null}
                  {posts.length === 0 ? (
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
                            {canDeletePost(post) ? (
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
                  )}
                </>
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
