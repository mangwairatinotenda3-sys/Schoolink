import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Camera, MapPin, Phone, Mail, MessageSquare, Plus, FileText, ExternalLink, Bell, BellRing, Video,
  Download, Share2, Heart, Star, Trash2, X, ChevronLeft, ChevronRight, Settings, Pencil, Loader2,
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

function storagePathFromUrl(url, bucket) {
  if (!url) return null
  const marker = `/${bucket}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  return decodeURIComponent(url.slice(idx + marker.length).split('?')[0])
}

function StarRow({ average, myRating, count, interactive, onRate, size = 14 }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!interactive}
          onClick={(e) => { e.stopPropagation(); onRate?.(n) }}
          className={interactive ? 'cursor-pointer' : 'cursor-default'}
        >
          <Star
            size={size}
            className={n <= Math.round(interactive ? myRating || average : average) ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}
          />
        </button>
      ))}
      {count > 0 ? <span className="text-[11px] text-gray-400 ml-1">{average.toFixed(1)} ({count})</span> : null}
    </div>
  )
}

export default function SchoolProfile() {
  const navigate = useNavigate()
  const { schoolId: paramSchoolId } = useParams()
  const { user, profile, saveProfileDetails } = useAuth()
  const onlineIds = useOnlineIds()
  const logoInputRef = useRef(null)
  const galleryInputRef = useRef(null)
  const docInputRef = useRef(null)
  const tabsRef = useRef(null)

  const targetSchoolId = paramSchoolId || profile?.school_id

  const [school, setSchool] = useState(null)
  const [form, setForm] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState(false)
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

  useEffect(() => {
    if (!targetSchoolId) {
      setLoading(false)
      return
    }
    loadSchool()
  }, [targetSchoolId])

  useEffect(() => {
    if (school) loadTabData(activeTab)
  }, [activeTab, school])

  // Keep the Members / Staff numbers live: whenever a profile row
  // for this school changes (someone invited/approved/removed), refresh the
  // counts automatically instead of waiting for a manual page reload.
  useEffect(() => {
    if (!school?.id) return
    const channel = supabase
      .channel(`school-members-${school.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `school_id=eq.${school.id}` }, () => {
        refreshMembers(school.id)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [school?.id])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2000)
    return () => clearTimeout(t)
  }, [toast])
  
  useEffect(() => { refreshVerifiedIds(true) }, [school?.id])

  async function refreshMembers(schoolId) {
    const { data: members } = await supabase.from('profiles').select('id, role').eq('school_id', schoolId).eq('status', 'active')
    setMemberCount(members?.length ?? 0)
    setMemberIds((members ?? []).map((m) => m.id))
    setStudentCount((members ?? []).filter((m) => m.role === 'Student').length)

    const { data: staffRows } = await supabase.from('profiles').select('*').eq('school_id', schoolId).eq('status', 'active').neq('role', 'Student')
    setStaff(staffRows ?? [])
    setStaffCount(staffRows?.length ?? 0)
  }

  async function refreshFollowerStats(id) {
    const { data } = await supabase.rpc('school_follower_count', { p_school: id })
    if (data) setFollowerStats(data)
  }

  async function loadSchool() {
    setLoading(true)
    const { data } = await supabase.from('schools').select('*').eq('id', targetSchoolId).maybeSingle()
    setSchool(data)
    setForm(data ?? {})

    if (data) {
      await refreshMembers(data.id)

      const { data: followRow } = await supabase
        .from('school_follows')
        .select('*')
        .eq('school_id', data.id)
        .eq('user_id', user.id)
        .maybeSingle()
      setIsFollowing(!!followRow)
      setFollowRow(followRow ?? null)
      refreshFollowerStats(data.id)
      const { data: pics } = await supabase.from('school_gallery').select('*').eq('school_id', data.id).order('created_at', { ascending: false })
      setGallery(pics ?? [])
    }

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

  async function loadTabData(tab) {
    if (tab === 'Posts') {
      const ids = memberIds.length ? memberIds : ['00000000-0000-0000-0000-000000000000']
      const { data } = await supabase.from('posts').select('*').in('author_id', ids).order('created_at', { ascending: false }).limit(20)
      setPosts(data ?? [])
    } else if (tab === 'Staff') {
      await refreshMembers(school.id)
    } else if (tab === 'Media') {
      const { data } = await supabase.from('school_gallery').select('*').eq('school_id', school.id).order('created_at', { ascending: false })
      setGallery(data ?? [])
      await loadGalleryEngagement((data ?? []).map((g) => g.id))
    } else if (tab === 'Events') {
      const { data } = await supabase.from('events').select('*').eq('school_id', school.id).order('event_date', { ascending: true })
      setEvents(data ?? [])
    } else if (tab === 'Documents') {
      const { data } = await supabase.from('school_documents').select('*').eq('school_id', school.id).order('created_at', { ascending: false })
      setDocuments(data ?? [])
      await loadDocEngagement((data ?? []).map((d) => d.id))
    }
  }

  function updateField(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    setMessage('')
    const { error } = await supabase
      .from('schools')
      .update({
        name: form.name,
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
      setMessage(error.message)
      return
    }
    setSchool(form)
    setMessage('Saved!')
    setTimeout(() => setMessage(''), 2000)
  }

  async function handleLogoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingLogo(true)
    const ext = file.name.split('.').pop()
    const path = `${school.id}/logo.${ext}`
    const { error } = await supabase.storage.from('school-media').upload(path, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('school-media').getPublicUrl(path)
      const logoUrl = `${data.publicUrl}?t=${Date.now()}`
      await supabase.from('schools').update({ logo_url: logoUrl }).eq('id', school.id)
      setSchool((s) => ({ ...s, logo_url: logoUrl }))
      setForm((f) => ({ ...f, logo_url: logoUrl }))
    }
    setUploadingLogo(false)
    e.target.value = ''
  }

  async function handleGalleryUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    const ext = file.name.split('.').pop()
    const mediaType = file.type.startsWith('video') ? 'video' : 'image'
    const path = `${school.id}/gallery/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('school-media').upload(path, file)
    if (!error) {
      const { data } = supabase.storage.from('school-media').getPublicUrl(path)
      const { data: row } = await supabase
        .from('school_gallery')
        .insert({ school_id: school.id, image_url: data.publicUrl, media_type: mediaType, uploaded_by: user.id })
        .select()
        .maybeSingle()
      if (row) setGallery((prev) => [row, ...prev])
    }
    setUploadingPhoto(false)
    e.target.value = ''
  }

  async function handleDocUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingDoc(true)
    const path = `${school.id}/documents/${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from('school-media').upload(path, file)
    if (!error) {
      const { data } = supabase.storage.from('school-media').getPublicUrl(path)
      const { data: row } = await supabase
        .from('school_documents')
        .insert({ school_id: school.id, title: file.name, file_url: data.publicUrl, uploaded_by: user.id })
        .select()
        .maybeSingle()
      if (row) setDocuments((prev) => [row, ...prev])
    }
    setUploadingDoc(false)
    e.target.value = ''
  }

  async function deleteGalleryItem(item) {
    if (!window.confirm('Delete this item? This cannot be undone.')) return
    const path = storagePathFromUrl(item.image_url, 'school-media')
    if (path) await supabase.storage.from('school-media').remove([path])
    await supabase.from('school_gallery').delete().eq('id', item.id)
    setGallery((prev) => prev.filter((g) => g.id !== item.id))
    setLightboxItem(null)
  }

  async function deleteDocument(doc) {
    if (!window.confirm('Delete this document? This cannot be undone.')) return
    const path = storagePathFromUrl(doc.file_url, 'school-media')
    if (path) await supabase.storage.from('school-media').remove([path])
    await supabase.from('school_documents').delete().eq('id', doc.id)
    setDocuments((prev) => prev.filter((d) => d.id !== doc.id))
    setLightboxItem(null)
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
      setToast('Link copied!')
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
    if (!error || error.code === '23505') {
      if (asStudent) await supabase.rpc('set_follow_form', { p_school: school.id, p_form: formValue, p_is_student: true })
      setIsFollowing(true)
      setFollowRow({ is_student: asStudent, form_class: asStudent ? formValue : null })
      refreshFollowerStats(school.id)
      setSheet(null)
      setToast(`You follow ${school.name}`)
    }
    setSheetBusy(false)
  }

  async function unfollow() {
    await supabase.from('school_follows').delete().eq('school_id', school.id).eq('user_id', user.id)
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
    if (isStudentMember) await supabase.rpc('set_my_form', { p_form: formValue })
    else await supabase.rpc('set_follow_form', { p_school: school.id, p_form: formValue, p_is_student: true })
    if (isStudentMember) setProfileForm(formValue)
    else setFollowRow((r) => ({ ...(r || {}), is_student: true, form_class: formValue }))
    setSheetBusy(false)
    setSheet(null)
    setToast('Form updated')
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

  function setProfileForm(v) {
    saveProfileDetails?.({ class_name: v })
  }

  function shareSchool() {
    const url = `${window.location.origin}${window.location.pathname}#/schools/${school.id}`
    if (navigator.share) navigator.share({ title: school.name, url }).catch(() => {})
    else { navigator.clipboard?.writeText(url); setToast('Link copied!') }
  }

  async function handleMessageSchool() {
    const { data: headteacher } = await supabase.from('profiles').select('id').eq('school_id', school.id).eq('role', 'Headteacher').maybeSingle()
    if (headteacher) navigate(`/chats/${headteacher.id}`)
  }

  function mapsUrl() {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(school?.location || '')}`
        }

  if (loading) {
    return (
      <div className="app-shell">
        <BackHeader title="School" />
        <div className="screen-scroll flex items-center justify-center text-gray-400"><Loader2 className="animate-spin" /></div>
      </div>
    )
  }

  if (!school) {
    return (
      <div className="app-shell">
        <BackHeader title="School" />
        <div className="screen-scroll px-4 flex items-center justify-center text-gray-400 text-center">
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

  function goTab(t) {
    setActiveTab(t)
    setTimeout(() => tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }

  return (
    <div className="app-shell">
      <div className="screen-scroll">
        {/* Cover */}
        <div className="relative h-44 overflow-hidden bg-brand-navy shrink-0">
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 176" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <defs>
              <linearGradient id="sp-cover" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#241B4E" />
                <stop offset="0.65" stopColor="#3A2A86" />
                <stop offset="1" stopColor="#5B3FD0" />
              </linearGradient>
            </defs>
            <rect width="400" height="176" fill="url(#sp-cover)" />
            <g fill="none" stroke="#fff" strokeOpacity="0.1" strokeWidth="1.2">
              <circle cx="360" cy="30" r="70" />
              <circle cx="360" cy="30" r="105" />
              <circle cx="360" cy="30" r="140" />
              <path d="M-10 150 C 80 110, 150 190, 260 140" />
              <path d="M-10 168 C 90 128, 160 205, 270 158" />
            </g>
            <path d="M0 176 L0 138 C 90 112, 170 160, 400 118 L400 176 Z" fill="#fff" fillOpacity="0.06" />
          </svg>
          <button onClick={() => navigate(-1)} aria-label="Go back" className="absolute top-3 left-3 w-9 h-9 rounded-full bg-black/25 backdrop-blur text-white flex items-center justify-center">
            <ChevronLeft size={21} />
          </button>
          <div className="absolute top-3 right-3 flex gap-2">
            <button onClick={shareSchool} aria-label="Share" className="w-9 h-9 rounded-full bg-black/25 backdrop-blur text-white flex items-center justify-center"><Share2 size={16} /></button>
            {canManageMedia ? (
              <button onClick={() => navigate('/school-settings')} aria-label="School dashboard" className="w-9 h-9 rounded-full bg-black/25 backdrop-blur text-white flex items-center justify-center"><Settings size={17} /></button>
            ) : null}
          </div>
        </div>

        {/* Identity */}
        <div className="px-4 -mt-11 relative">
          <div className="flex items-end gap-3">
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => school.logo_url && setViewingLogo(school.logo_url)}
                className="w-[88px] h-[88px] rounded-[26px] bg-white ring-4 ring-white shadow-lg flex items-center justify-center overflow-hidden"
              >
                {school.logo_url ? <img src={school.logo_url} alt="" className="w-full h-full object-cover" /> : <span className="text-4xl">🏫</span>}
              </button>
              {isOnline ? <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-green-500 border-[3px] border-white" /> : null}
              {canEdit ? (
                <button onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo} aria-label="Change logo" className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-brand-navy flex items-center justify-center border-2 border-white">
                  {uploadingLogo ? <Loader2 size={12} className="text-white animate-spin" /> : <Camera size={12} className="text-white" />}
                </button>
              ) : null}
              <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
            </div>
            <div className="flex-1 min-w-0 pb-1 flex justify-end gap-2">
              {!isMember ? (
                isFollowing ? (
                  <button onClick={unfollow} className="h-10 px-5 rounded-full bg-gray-100 text-brand-navy text-sm font-semibold flex items-center gap-1.5"><BellRing size={15} /> Following</button>
                ) : (
                  <button onClick={openFollow} className="h-10 px-6 rounded-full bg-brand-purple text-white text-sm font-semibold flex items-center gap-1.5 shadow-sm"><Bell size={15} /> Follow</button>
                )
              ) : null}
              {canEdit ? (
                <button onClick={() => goTab('About')} className="h-10 px-4 rounded-full border border-gray-200 text-brand-navy text-sm font-semibold flex items-center gap-1.5"><Pencil size={14} /> Edit</button>
              ) : null}
              <button onClick={handleMessageSchool} aria-label="Message school" className="h-10 w-10 rounded-full border border-gray-200 flex items-center justify-center text-brand-navy"><MessageSquare size={17} /></button>
            </div>
          </div>

          <h1 className="mt-3 text-[23px] leading-[1.15] font-extrabold tracking-tight text-brand-navy flex items-center gap-1.5 flex-wrap">
            {school.name}
            <VerifiedBadge schoolId={school.id} size={20} />
          </h1>
          <p className="text-[13px] text-gray-400 mt-0.5">
            {handle}{school.school_type ? ` · ${school.school_type}` : ''}{isOnline ? <span className="text-green-500 font-medium"> · Online</span> : null}
          </p>

          {school.location ? (
            <a href={mapsUrl()} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-1.5 text-sm text-gray-600">
              <MapPin size={14} className="text-brand-purple shrink-0" /> <span className="truncate">{school.location}</span>
            </a>
          ) : null}

          {school.motto ? (
            <p className="mt-3 border-l-[3px] border-brand-purple pl-3 text-[14px] italic text-gray-600 leading-snug">“{school.motto}”</p>
          ) : null}

        </div>

        {/* Ledger */}
        <div className="mx-4 mt-5 grid grid-cols-4 rounded-2xl border border-gray-100 bg-white divide-x divide-gray-100">
          {[
            [followerStats.follows, 'Followers'],
            [studentCount, 'Students'],
            [staffCount, 'Staff'],
            [memberCount, 'Members'],
          ].map(([n, label]) => (
            <div key={label} className="py-3 text-center">
              <p className="text-[19px] font-extrabold tracking-tight tabular-nums text-brand-navy leading-none">{Number(n || 0).toLocaleString()}</p>
              <p className="text-[10px] uppercase tracking-[0.1em] text-gray-400 mt-1.5">{label}</p>
            </div>
          ))}
        </div>

        {canManageMedia ? (
          <button onClick={() => navigate('/school-settings')} className="mx-4 mt-3 w-[calc(100%-2rem)] flex items-center gap-3 rounded-2xl bg-brand-navy text-white px-4 py-3.5 text-left active:opacity-90">
            <span className="w-9 h-9 rounded-xl bg-white/12 flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.12)' }}><Settings size={18} /></span>
            <span className="flex-1">
              <span className="block text-[15px] font-semibold leading-tight">School dashboard</span>
              <span className="block text-xs text-white/60 mt-0.5">Learners, dashboards and school tools</span>
            </span>
            <ChevronRight size={18} className="text-white/50" />
          </button>
        ) : null}

        {showMyForm ? (
          <div className="mx-4 mt-3 rounded-2xl border border-gray-100 px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] uppercase tracking-[0.1em] text-gray-400">Your form</p>
              <p className="text-[15px] font-semibold text-brand-navy truncate">{myForm || 'Not set yet'}</p>
            </div>
            <button onClick={() => { setFormValue(myForm || ''); setSheet('form') }} className="text-sm font-semibold text-brand-purple flex items-center gap-1"><Pencil size={13} /> {myForm ? 'Change' : 'Add'}</button>
          </div>
        ) : null}

        {profile?.account_type === 'investor' ? (
          <button onClick={() => navigate(`/schools/${school.id}/propose`)} className="mx-4 mt-3 w-[calc(100%-2rem)] bg-brand-purple text-white font-semibold py-3 rounded-2xl text-sm">
            Send Investment Proposal
          </button>
        ) : null}

        {/* At a glance */}
        {(facts.length || school.phone || school.contact_email) ? (
          <div className="mx-4 mt-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400 mb-2">At a glance</p>
            <dl className="rounded-2xl border border-gray-100 divide-y divide-gray-100">
              {facts.map(([k, v]) => (
                <div key={k} className="flex items-center justify-between px-4 py-2.5">
                  <dt className="text-sm text-gray-500">{k}</dt>
                  <dd className="text-sm font-semibold text-brand-navy">{v}</dd>
                </div>
              ))}
              {school.phone ? (
                <a href={`tel:${school.phone}`} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm text-gray-500 flex items-center gap-1.5"><Phone size={13} /> Phone</span>
                  <span className="text-sm font-semibold text-brand-purple">{school.phone}</span>
                </a>
              ) : null}
              {school.contact_email ? (
                <a href={`mailto:${school.contact_email}`} className="flex items-center justify-between px-4 py-2.5 gap-3">
                  <span className="text-sm text-gray-500 flex items-center gap-1.5 shrink-0"><Mail size={13} /> Email</span>
                  <span className="text-sm font-semibold text-brand-purple truncate">{school.contact_email}</span>
                </a>
              ) : null}
            </dl>
          </div>
        ) : null}

        {aboutText ? (
          <div className="mx-4 mt-5">
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400">Our story</p>
              <button onClick={() => goTab('About')} className="text-xs text-brand-purple font-semibold">Read all</button>
            </div>
            <p className="text-[14px] text-gray-600 leading-relaxed line-clamp-3">{aboutText}</p>
          </div>
        ) : null}

        {/* Media mosaic */}
        {gallery.length > 0 ? (
          <div className="mx-4 mt-5">
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400">Around the school</p>
              <button onClick={() => goTab('Media')} className="text-xs text-brand-purple font-semibold">View all</button>
            </div>
            <div className="grid grid-cols-3 grid-rows-2 gap-1.5 h-44 rounded-2xl overflow-hidden">
              {gallery.slice(0, 3).map((g, i) => (
                <button key={g.id} onClick={() => setLightboxItem({ ...g, kind: 'gallery' })} className={`relative overflow-hidden bg-gray-100 ${i === 0 ? 'col-span-2 row-span-2' : ''}`}>
                  {g.media_type === 'video' ? (
                    <>
                      <video src={g.image_url} className="w-full h-full object-cover" muted preload="metadata" />
                      <span className="absolute inset-0 flex items-center justify-center bg-black/25"><Video size={18} className="text-white" /></span>
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
        <div ref={tabsRef} className="sticky top-0 z-20 bg-white/95 backdrop-blur mt-5 border-b border-gray-100 scroll-mt-0">
          <div className="flex gap-6 overflow-x-auto px-4" style={{ scrollbarWidth: 'none' }}>
            {tabs.map((t) => (
              <button key={t} onClick={() => setActiveTab(t)} className={`relative py-3 text-[14px] shrink-0 ${activeTab === t ? 'font-bold text-brand-navy' : 'font-medium text-gray-400'}`}>
                {t}
                {activeTab === t ? <span className="absolute left-0 right-0 -bottom-px h-[3px] rounded-full bg-brand-purple" /> : null}
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 py-4 pb-8">
          {activeTab === 'Posts' ? (
            posts.length === 0 ? (
              <p className="text-center text-gray-400 mt-6">No posts from this school yet.</p>
            ) : (
              <div className="space-y-3">
                {posts.map((p) => (
                  <button key={p.id} onClick={() => navigate(`/post/${p.id}`)} className="w-full text-left rounded-2xl border border-gray-100 p-4 active:bg-gray-50">
                    <p className="font-semibold text-sm text-brand-navy">{p.author_name}</p>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-3">{p.content}</p>
                  </button>
                ))}
              </div>
            )
          ) : null}

                    {activeTab === 'About' ? (
            <div className="space-y-4">
              {canEdit ? (
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase mb-1">School Name</p>
                    <input value={form.name || ''} onChange={(e) => updateField('name', e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-brand-purple" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Location</p>
                    <input value={form.location || ''} onChange={(e) => updateField('location', e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-brand-purple" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase mb-1">School Type</p>
                    <select value={form.school_type || ''} onChange={(e) => updateField('school_type', e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-brand-purple">
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
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{key}</p>
                  {canEdit ? (
                    <textarea value={form[key] || ''} onChange={(e) => updateField(key, e.target.value)} rows={2} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-brand-purple resize-none" />
                  ) : (
                    <p className="text-[14px] text-gray-600 leading-relaxed">{school[key] || '—'}</p>
                  )}
                </div>
              ))}

              {canEdit ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <input value={form.pass_rate || ''} onChange={(e) => updateField('pass_rate', e.target.value)} placeholder="Pass rate %" className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-brand-purple" />
                    <input value={form.established_year || ''} onChange={(e) => updateField('established_year', e.target.value)} placeholder="Established year" className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-brand-purple" />
                    <div className="border border-gray-100 bg-gray-50 rounded-xl px-3 py-2.5 text-sm text-gray-500 flex items-center justify-between">
                      <span>Total students</span>
                      <span className="font-semibold text-gray-700">{studentCount}</span>
                    </div>
                    <input value={form.total_teachers || ''} onChange={(e) => updateField('total_teachers', e.target.value)} placeholder="Teachers" className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-brand-purple" />
                    <input value={form.non_teaching_staff || ''} onChange={(e) => updateField('non_teaching_staff', e.target.value)} placeholder="Non-teaching staff" className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-brand-purple" />
                    <input value={form.total_classes || ''} onChange={(e) => updateField('total_classes', e.target.value)} placeholder="Classes" className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-brand-purple" />
                    <input value={form.phone || ''} onChange={(e) => updateField('phone', e.target.value)} placeholder="Phone" className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-brand-purple" />
                    <input value={form.contact_email || ''} onChange={(e) => updateField('contact_email', e.target.value)} placeholder="Contact email" className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-brand-purple" />
                  </div>
                  {message ? <p className="text-sm text-brand-purple">{message}</p> : null}
                  <button onClick={handleSave} disabled={saving} className="w-full bg-brand-purple text-white font-semibold py-3.5 rounded-2xl disabled:opacity-60">
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                </>
              ) : null}

              {isMember && profile?.role === 'Headteacher' ? (
                <div className="mt-2 pt-5 border-t border-gray-100">
                  <p className="text-xs font-bold uppercase tracking-wide text-red-500 mb-1">Danger zone</p>
                  <p className="text-xs text-gray-500 mb-3">Deleting the school removes its profile, photos, documents, events and followers for good. Members keep their accounts but leave the school.</p>
                  <button onClick={() => { setDeleteText(''); setDeleteError(''); setDeleteOpen(true) }} className="w-full flex items-center justify-center gap-2 border border-red-200 text-red-500 font-semibold py-3 rounded-2xl text-sm">
                    <Trash2 size={16} /> Delete school
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {activeTab === 'Staff' ? (
            staff.length === 0 ? (
              <p className="text-center text-gray-400 mt-6">No staff members yet.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {staff.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 py-3">
                    {s.avatar_url ? <img src={s.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover" /> : <span className="w-11 h-11 rounded-full bg-brand-light text-brand-purple font-semibold flex items-center justify-center">{(s.full_name || '?').slice(0, 1).toUpperCase()}</span>}
                    <div>
                      <p className="font-semibold text-sm text-brand-navy">{s.full_name || 'Staff member'}</p>
                      <p className="text-xs text-gray-400">{s.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : null}

          {activeTab === 'Media' ? (
            <>
              {canManageMedia ? (
                <button onClick={() => galleryInputRef.current?.click()} disabled={uploadingPhoto} className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-2xl py-3 text-sm text-gray-500 mb-3 disabled:opacity-60">
                  <Plus size={16} /> {uploadingPhoto ? 'Uploading…' : 'Add Photo or Video'}
                </button>
              ) : (
                <p className="text-xs text-gray-400 text-center mb-3">Only school staff can add photos and videos.</p>
              )}
              <input ref={galleryInputRef} type="file" accept="image/*,video/*" onChange={handleGalleryUpload} className="hidden" />
              {gallery.length === 0 ? (
                <p className="text-center text-gray-400 mt-6">No photos or videos yet.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {gallery.map((g) => (
                    <button key={g.id} onClick={() => setLightboxItem({ ...g, kind: 'gallery' })} className="relative w-full h-36 rounded-2xl overflow-hidden bg-gray-100">
                      {g.media_type === 'video' ? (
                        <>
                          <video src={g.image_url} className="w-full h-full object-cover" muted preload="metadata" />
                          <span className="absolute inset-0 flex items-center justify-center bg-black/20"><Video size={20} className="text-white" /></span>
                        </>
                      ) : (
                        <img src={g.image_url} alt="" className="w-full h-full object-cover" />
                      )}
                      {galleryLikes[g.id]?.count > 0 ? (
                        <span className="absolute bottom-1.5 right-1.5 bg-black/50 text-white text-[10px] rounded-full px-1.5 py-0.5 flex items-center gap-0.5">
                          <Heart size={10} className="fill-white" /> {galleryLikes[g.id].count}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : null}

          {activeTab === 'Events' ? (
            <>
              {canManageMedia ? (
                <button onClick={() => navigate('/calendar/create')} className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-2xl py-3 text-sm text-gray-500 mb-3">
                  <Plus size={16} /> Add Event
                </button>
              ) : (
                <p className="text-xs text-gray-400 text-center mb-3">Only school staff can add events.</p>
              )}
              {events.length === 0 ? (
                <p className="text-center text-gray-400 mt-6">No events scheduled.</p>
              ) : (
                <div className="space-y-2">
                  {events.map((e) => {
                    const d = new Date(e.event_date)
                    return (
                      <div key={e.id} className="flex items-center gap-3 rounded-2xl border border-gray-100 p-3">
                        <div className="w-12 shrink-0 text-center rounded-xl bg-brand-light py-1.5">
                          <p className="text-[10px] font-bold uppercase text-brand-purple">{d.toLocaleDateString(undefined, { month: 'short' })}</p>
                          <p className="text-lg font-extrabold leading-none text-brand-navy">{d.getDate()}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-brand-navy truncate">{e.title}</p>
                          <p className="text-xs text-gray-400">{d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
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
              {canManageMedia ? (
                <button onClick={() => docInputRef.current?.click()} disabled={uploadingDoc} className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-2xl py-3 text-sm text-gray-500 mb-3 disabled:opacity-60">
                  <Plus size={16} /> {uploadingDoc ? 'Uploading…' : 'Add Document'}
                </button>
              ) : (
                <p className="text-xs text-gray-400 text-center mb-3">Only school staff can add documents.</p>
              )}
              <input ref={docInputRef} type="file" onChange={handleDocUpload} className="hidden" />
              {documents.length === 0 ? (
                <p className="text-center text-gray-400 mt-6">No documents yet.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {documents.map((d) => (
                    <button key={d.id} onClick={() => setLightboxItem({ ...d, kind: 'document' })} className="w-full flex items-center gap-3 py-3 text-left">
                      <span className="w-10 h-10 rounded-xl bg-brand-light flex items-center justify-center shrink-0"><FileText size={17} className="text-brand-purple" /></span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{d.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {docLikes[d.id]?.count > 0 ? <span className="text-[11px] text-gray-400 flex items-center gap-0.5"><Heart size={10} /> {docLikes[d.id].count}</span> : null}
                          {docRatings[d.id]?.count > 0 ? <span className="text-[11px] text-gray-400">★ {(docRatings[d.id].sum / docRatings[d.id].count).toFixed(1)}</span> : null}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>

      {toast && !lightboxItem ? (
        <div className="fixed left-1/2 -translate-x-1/2 z-40 bg-gray-900 text-white text-sm rounded-full px-4 py-2 shadow-lg" style={{ bottom: 90 }}>{toast}</div>
      ) : null}

      {sheet ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => !sheetBusy && setSheet(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[480px] bg-white rounded-t-3xl px-5 pt-3 pb-6 max-h-[88dvh] overflow-y-auto">
            <span className="block w-10 h-1.5 rounded-full bg-gray-200 mx-auto mb-4" />
            {sheet === 'follow' ? (
              <>
                <p className="text-lg font-extrabold tracking-tight text-brand-navy">Follow {school.name}</p>
                <p className="text-sm text-gray-500 mt-1">See their posts, events and news.</p>
                <button onClick={() => setAsStudent((v) => !v)} className={`mt-4 w-full flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left ${asStudent ? 'border-brand-purple bg-brand-light' : 'border-gray-200'}`}>
                  <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${asStudent ? 'bg-brand-purple border-brand-purple' : 'border-gray-300'}`}>{asStudent ? <span className="text-white text-xs font-bold">✓</span> : null}</span>
                  <span className="flex-1">
                    <span className="block text-sm font-semibold">I'm a student at this school</span>
                    <span className="block text-xs text-gray-500">Tell them which form you are in</span>
                  </span>
                </button>
                {asStudent ? <div className="mt-4"><FormPicker value={formValue} onChange={setFormValue} schoolType={school.school_type} /></div> : null}
                <button onClick={confirmFollow} disabled={sheetBusy || (asStudent && !formValue.trim())} className="mt-5 w-full bg-brand-purple text-white font-semibold py-3.5 rounded-2xl disabled:opacity-50 flex items-center justify-center">
                  {sheetBusy ? <Loader2 size={18} className="animate-spin" /> : 'Follow'}
                </button>
              </>
            ) : (
              <>
                <p className="text-lg font-extrabold tracking-tight text-brand-navy">Which form are you in?</p>
                <div className="mt-4"><FormPicker value={formValue} onChange={setFormValue} schoolType={school.school_type} /></div>
                <button onClick={saveMyForm} disabled={sheetBusy || !formValue.trim()} className="mt-5 w-full bg-brand-purple text-white font-semibold py-3.5 rounded-2xl disabled:opacity-50 flex items-center justify-center">
                  {sheetBusy ? <Loader2 size={18} className="animate-spin" /> : 'Save'}
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}

      {lightboxItem ? (
        <div className="fixed inset-0 bg-black/80 z-50 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-white text-sm font-medium truncate pr-2">
              {lightboxItem.kind === 'document' ? lightboxItem.title : 'Media'}
            </p>
            <button onClick={() => setLightboxItem(null)} className="text-white shrink-0">
              <X size={22} />
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center px-4 overflow-hidden">
            {lightboxItem.kind === 'gallery' ? (
              lightboxItem.media_type === 'video' ? (
                <video src={lightboxItem.image_url} className="max-w-full max-h-full rounded-lg" controls autoPlay />
              ) : (
                <img src={lightboxItem.image_url} alt="" className="max-w-full max-h-full rounded-lg object-contain" />
              )
            ) : (
              <div className="bg-white rounded-xl p-8 flex flex-col items-center gap-3">
                <FileText size={48} className="text-brand-purple" />
                <p className="text-sm text-gray-600 text-center">{lightboxItem.title}</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-t-2xl px-4 pt-4 pb-6 space-y-3">
            {toast ? <p className="text-center text-xs text-brand-purple">{toast}</p> : null}

            <div className="flex items-center justify-between">
              <button
                onClick={() => (lightboxItem.kind === 'gallery' ? toggleGalleryLike(lightboxItem.id) : toggleDocLike(lightboxItem.id))}
                className="flex items-center gap-1.5 text-sm font-medium"
              >
                <Heart
                  size={18}
                  className={(lightboxItem.kind === 'gallery' ? galleryLikes[lightboxItem.id]?.likedByMe : docLikes[lightboxItem.id]?.likedByMe) ? 'text-red-500 fill-red-500' : 'text-gray-400'}
                />
                {(lightboxItem.kind === 'gallery' ? galleryLikes[lightboxItem.id]?.count : docLikes[lightboxItem.id]?.count) || 0}
              </button>

              <StarRow
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
                  className="flex-1 flex items-center justify-center gap-1.5 bg-brand-purple text-white rounded-xl py-2.5 text-sm font-medium"
                >
                  <ExternalLink size={15} /> Open
                </button>
              ) : null}
              <button
                onClick={() => downloadItem(lightboxItem.kind === 'gallery' ? lightboxItem.image_url : lightboxItem.file_url, lightboxItem.title)}
                className="flex-1 flex items-center justify-center gap-1.5 border border-gray-200 rounded-xl py-2.5 text-sm font-medium"
              >
                <Download size={15} /> Download
              </button>
              <button
                onClick={() => shareItem(lightboxItem.kind === 'gallery' ? lightboxItem.image_url : lightboxItem.file_url, lightboxItem.title)}
                className="flex-1 flex items-center justify-center gap-1.5 border border-gray-200 rounded-xl py-2.5 text-sm font-medium"
              >
              <Share2 size={15} /> Share
              </button>
              {canManageMedia ? (
                <button
                  onClick={() => (lightboxItem.kind === 'gallery' ? deleteGalleryItem(lightboxItem) : deleteDocument(lightboxItem))}
                  className="flex items-center justify-center gap-1.5 border border-red-200 text-red-500 rounded-xl py-2.5 px-3 text-sm font-medium"
                >
                  <Trash2 size={15} />
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {deleteOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => !deleting && setDeleteOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[480px] bg-white rounded-t-3xl px-5 pt-3 pb-6">
            <span className="block w-10 h-1.5 rounded-full bg-gray-200 mx-auto mb-4" />
            <p className="text-lg font-extrabold tracking-tight text-red-600">Delete {school.name}?</p>
            <p className="text-sm text-gray-500 mt-1">This cannot be undone. Type the school's name to confirm.</p>
            <input value={deleteText} onChange={(e) => setDeleteText(e.target.value)} placeholder={school.name} className="mt-4 w-full border border-gray-200 rounded-xl px-4 py-3 text-[15px] outline-none focus:border-red-400" />
            {deleteError ? <p className="text-sm text-red-500 mt-2">{deleteError}</p> : null}
            <div className="flex gap-2 mt-4">
              <button onClick={() => setDeleteOpen(false)} disabled={deleting} className="flex-1 border border-gray-200 rounded-2xl py-3.5 font-semibold">Cancel</button>
              <button onClick={deleteSchool} disabled={deleting || deleteText.trim().toLowerCase() !== (school.name || '').trim().toLowerCase()} className="flex-1 bg-red-600 text-white rounded-2xl py-3.5 font-semibold disabled:opacity-40 flex items-center justify-center">
                {deleting ? <Loader2 size={18} className="animate-spin" /> : 'Delete forever'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {viewingLogo ? <AvatarViewer imageUrl={viewingLogo} onClose={() => setViewingLogo(null)} /> : null}
    </div>
  )
        }
              
                
