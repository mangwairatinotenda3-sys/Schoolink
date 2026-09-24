import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Camera, MapPin, Phone, Mail, MessageSquare, ShieldCheck, Plus, Users, Award, CalendarDays,
  UserCog, FileText, ExternalLink, Bell, BellRing, Video, Download, Share2, Heart, Star, Trash2, X,
} from 'lucide-react'
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
  const { user, profile } = useAuth()
  const onlineIds = useOnlineIds()
  const logoInputRef = useRef(null)
  const galleryInputRef = useRef(null)
  const docInputRef = useRef(null)

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
  const [memberIds, setMemberIds] = useState([])
  const [isFollowing, setIsFollowing] = useState(false)
  const [aboutExpanded, setAboutExpanded] = useState(false)

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

  // Keep the header's Members / Staff numbers live: whenever a profile row
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

  async function refreshMembers(schoolId) {
    const { data: members } = await supabase.from('profiles').select('id').eq('school_id', schoolId).eq('status', 'active')
    setMemberCount(members?.length ?? 0)
    setMemberIds((members ?? []).map((m) => m.id))

    const { data: staffRows } = await supabase.from('profiles').select('*').eq('school_id', schoolId).eq('status', 'active').neq('role', 'Student')
    setStaff(staffRows ?? [])
    setStaffCount(staffRows?.length ?? 0)
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
        motto: form.motto,
        vision: form.vision,
        mission: form.mission,
        pass_rate: form.pass_rate || null,
        established_year: form.established_year,
        phone: form.phone,
        contact_email: form.contact_email,
        total_students: form.total_students || null,
        total_teachers: form.total_teachers || null,
        non_teaching_staff: form.non_teaching_staff || null,
        total_classes: form.total_classes || null,
        verified: form.verified ?? false,
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

  async function toggleFollow() {
    if (isFollowing) {
      await supabase.from('school_follows').delete().eq('school_id', school.id).eq('user_id', user.id)
      setIsFollowing(false)
    } else {
      await supabase.from('school_follows').insert({ school_id: school.id, user_id: user.id })
      setIsFollowing(true)
    }
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
        <BackHeader title="Profile" />
        <div className="screen-scroll flex items-center justify-center text-gray-400">Loading…</div>
      </div>
    )
  }

  if (!school) {
    return (
      <div className="app-shell">
        <BackHeader title="Profile" />
        <div className="screen-scroll px-4 flex items-center justify-center text-gray-400 text-center">
          {paramSchoolId ? 'School not found.' : "You're not linked to a school yet."}
        </div>
      </div>
      import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Camera, MapPin, Phone, Mail, MessageSquare, ShieldCheck, Plus, Users, Award, CalendarDays,
  UserCog, FileText, ExternalLink, Bell, BellRing, Video, Download, Share2, Heart, Star, Trash2, X,
} from 'lucide-react'
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
  const { user, profile } = useAuth()
  const onlineIds = useOnlineIds()
  const logoInputRef = useRef(null)
  const galleryInputRef = useRef(null)
  const docInputRef = useRef(null)

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
  const [memberIds, setMemberIds] = useState([])
  const [isFollowing, setIsFollowing] = useState(false)
  const [aboutExpanded, setAboutExpanded] = useState(false)

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

  // Keep the header's Members / Staff numbers live: whenever a profile row
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

  async function refreshMembers(schoolId) {
    const { data: members } = await supabase.from('profiles').select('id').eq('school_id', schoolId).eq('status', 'active')
    setMemberCount(members?.length ?? 0)
    setMemberIds((members ?? []).map((m) => m.id))

    const { data: staffRows } = await supabase.from('profiles').select('*').eq('school_id', schoolId).eq('status', 'active').neq('role', 'Student')
    setStaff(staffRows ?? [])
    setStaffCount(staffRows?.length ?? 0)
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
        motto: form.motto,
        vision: form.vision,
        mission: form.mission,
        pass_rate: form.pass_rate || null,
        established_year: form.established_year,
        phone: form.phone,
        contact_email: form.contact_email,
        total_students: form.total_students || null,
        total_teachers: form.total_teachers || null,
        non_teaching_staff: form.non_teaching_staff || null,
        total_classes: form.total_classes || null,
        verified: form.verified ?? false,
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

  async function toggleFollow() {
    if (isFollowing) {
      await supabase.from('school_follows').delete().eq('school_id', school.id).eq('user_id', user.id)
      setIsFollowing(false)
    } else {
      await supabase.from('school_follows').insert({ school_id: school.id, user_id: user.id })
      setIsFollowing(true)
    }
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
        <BackHeader title="Profile" />
        <div className="screen-scroll flex items-center justify-center text-gray-400">Loading…</div>
      </div>
    )
  }

  if (!school) {
    return (
      <div className="app-shell">
        <BackHeader title="Profile" />
        <div className="screen-scroll px-4 flex items-center justify-center text-gray-400 text-center">
          {paramSchoolId ? 'School not found.' : "You're not linked to a school yet."}
        </div>
      </div>
    )
      }
    )
    }
