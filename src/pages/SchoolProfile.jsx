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
        school_type: form.school_type,
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

const aboutText = school.mission || school.description || ''
  return (
    <div className="app-shell">
      <div className="bg-brand-navy text-white px-4 pt-4 pb-6">
        <BackHeader title="Profile" />

        <div className="flex flex-col items-center mt-2">
          <div className="relative">
            <span className="w-24 h-24 rounded-full bg-white p-1 flex items-center justify-center">
              {school.logo_url ? <img src={school.logo_url} alt="" className="w-full h-full rounded-full object-cover" /> : <span className="text-4xl">🏫</span>}
            </span>
            {isOnline ? (
              <span className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-green-500 border-2 border-brand-navy flex items-center justify-center">
                <span className="w-2 h-2 rounded-full bg-white" />
              </span>
            ) : null}
            {canEdit ? (
              <button onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo} className="absolute top-0 right-0 w-7 h-7 rounded-full bg-brand-purple flex items-center justify-center border-2 border-brand-navy">
                <Camera size={13} className="text-white" />
              </button>
            ) : null}
            <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
          </div>

          <p className="font-bold text-lg mt-3 flex items-center gap-1.5 flex-wrap justify-center">
            {school.name}
            {school.verified ? <ShieldCheck size={17} className="text-brand-purple bg-white rounded-full" /> : null}
          </p>
          <p className="text-xs text-white/50">{handle}</p>

          {school.school_type ? <span className="text-[11px] bg-brand-purple/30 px-2 py-0.5 rounded-full mt-1">{school.school_type}</span> : null}

          <p className="text-sm text-white/70 flex items-center gap-1 mt-2">
            <MapPin size={13} /> {school.location || 'Location not set'}
            {isOnline ? <span className="text-green-400 ml-1">· Online</span> : null}
          </p>
        </div>

        <div className="grid grid-cols-4 gap-2 mt-5 text-center">
          <div>
            <span className="w-9 h-9 rounded-full bg-purple-500/30 mx-auto flex items-center justify-center mb-1"><Users size={16} /></span>
            <p className="font-bold text-sm">{memberCount}</p>
            <p className="text-[10px] text-white/50">Members</p>
          </div>
          <div>
            <span className="w-9 h-9 rounded-full bg-green-500/30 mx-auto flex items-center justify-center mb-1"><Award size={16} /></span>
            <p className="font-bold text-sm">{school.pass_rate ? `${school.pass_rate}%` : '—'}</p>
            <p className="text-[10px] text-white/50">Pass Rate</p>
          </div>
          <div>
            <span className="w-9 h-9 rounded-full bg-blue-500/30 mx-auto flex items-center justify-center mb-1"><CalendarDays size={16} /></span>
            <p className="font-bold text-sm">{school.established_year || '—'}</p>
            <p className="text-[10px] text-white/50">Est.</p>
          </div>
          <div>
            <span className="w-9 h-9 rounded-full bg-orange-500/30 mx-auto flex items-center justify-center mb-1"><UserCog size={16} /></span>
            <p className="font-bold text-sm">{staffCount}</p>
            <p className="text-[10px] text-white/50">Staff</p>
          </div>
        </div>
      </div>

      <div className="screen-scroll px-4">
        <div className="border border-gray-100 rounded-xl p-4 mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">School Type</span>
            <span className="text-sm font-medium">{school.school_type || '—'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Location</span>
            <a href={mapsUrl()} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand-purple flex items-center gap-1">
              View on Map <ExternalLink size={12} />
            </a>
          </div>
          {school.phone ? <div className="flex items-center gap-2 text-sm text-gray-600"><Phone size={14} /> {school.phone}</div> : null}
          {school.contact_email ? <div className="flex items-center gap-2 text-sm text-gray-600"><Mail size={14} /> {school.contact_email}</div> : null}
        </div>

        <div className="flex gap-2 mt-3">
          <button onClick={handleMessageSchool} className="flex-1 flex items-center justify-center gap-1.5 border border-gray-200 rounded-xl py-2.5 text-sm font-medium">
            <MessageSquare size={15} /> Message School
          </button>
          {!isMember ? (
            <button
              onClick={toggleFollow}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-medium ${
                isFollowing ? 'bg-brand-navy text-white' : 'border border-brand-purple text-brand-purple'
              }`}
            >
              {isFollowing ? <BellRing size={15} /> : <Bell size={15} />} {isFollowing ? 'Following' : 'Follow'}
            </button>
          ) : null}
        </div>

        {profile?.account_type === 'investor' ? (
          <button
            onClick={() => navigate(`/schools/${school.id}/propose`)}
            className="w-full bg-brand-purple text-white font-medium py-2.5 rounded-xl text-sm mt-2"
          >
            Send Investment Proposal
          </button>
        ) : null}

        {aboutText ? (
          <div className="border border-gray-100 rounded-xl p-4 mt-3">
            <p className="font-semibold text-sm mb-1">About School</p>
            <p className={`text-sm text-gray-600 ${aboutExpanded ? '' : 'line-clamp-2'}`}>{aboutText}</p>
            <button onClick={() => setAboutExpanded((e) => !e)} className="text-xs text-brand-purple font-medium mt-1">
              {aboutExpanded ? 'Show less' : 'Read more'}
            </button>
          </div>
        ) : null}

        <div className="border border-gray-100 rounded-xl p-4 mt-3">
          <div className="flex items-center justify-between mb-2">
            <p className="font-semibold text-sm">School Media</p>
            <button
              onClick={() => { setActiveTab('Media'); setTimeout(() => tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0) }}
              className="text-xs text-brand-purple font-medium"
            >
              View all
            </button>
          </div>
          {gallery.length === 0 && activeTab !== 'Media' ? (
            <p className="text-xs text-gray-400">No photos or videos yet.</p>
          ) : (
            <div className="grid grid-cols-4 gap-1.5">
              {gallery.slice(0, 4).map((g) => (
                <button key={g.id} onClick={() => setLightboxItem({ ...g, kind: 'gallery' })} className="relative w-full h-16 rounded-md overflow-hidden">
                  {g.media_type === 'video' ? (
                    <>
                      <video src={g.image_url} className="w-full h-full object-cover" muted preload="metadata" />
                      <span className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <Video size={14} className="text-white" />
                      </span>
                    </>
                  ) : (
                    <img src={g.image_url} alt="" className="w-full h-full object-cover" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div ref={tabsRef} className="flex gap-5 overflow-x-auto mt-4 border-b border-gray-100 scroll-mt-4">
          {tabs.map((t) => (
            <button key={t} onClick={() => setActiveTab(t)} className={`pb-2 text-sm font-medium border-b-2 shrink-0 ${activeTab === t ? 'border-brand-purple text-brand-purple' : 'border-transparent text-gray-400'}`}>
              {t}
            </button>
          ))}
        </div>

        <div className="py-4 pb-6">
          {activeTab === 'Posts' ? (
            posts.length === 0 ? (
              <p className="text-center text-gray-400 mt-6">No posts from this school yet.</p>
            ) : (
              <div className="space-y-3">
                {posts.map((p) => (
                  <button key={p.id} onClick={() => navigate(`/post/${p.id}`)} className="w-full text-left border border-gray-100 rounded-xl p-3">
                    <p className="font-medium text-sm">{p.author_name}</p>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{p.content}</p>
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
                    <input value={form.name || ''} onChange={(e) => updateField('name', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Location</p>
                    <input value={form.location || ''} onChange={(e) => updateField('location', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase mb-1">School Type</p>
                    <select value={form.school_type || ''} onChange={(e) => updateField('school_type', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple">
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
                  <p className="text-xs font-semibold text-gray-400 uppercase mb-1 capitalize">{key}</p>
                  {canEdit ? (
                    <textarea value={form[key] || ''} onChange={(e) => updateField(key, e.target.value)} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple resize-none" />
                  ) : (
                    <p className="text-sm text-gray-600">{school[key] || '—'}</p>
                  )}
                </div>
              ))}

              {canEdit ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <input value={form.pass_rate || ''} onChange={(e) => updateField('pass_rate', e.target.value)} placeholder="Pass rate %" className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple" />
                    <input value={form.established_year || ''} onChange={(e) => updateField('established_year', e.target.value)} placeholder="Established year" className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple" />
                    <input value={form.total_students || ''} onChange={(e) => updateField('total_students', e.target.value)} placeholder="Total students" className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple" />
                    <input value={form.total_teachers || ''} onChange={(e) => updateField('total_teachers', e.target.value)} placeholder="Teachers" className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple" />
                    <input value={form.non_teaching_staff || ''} onChange={(e) => updateField('non_teaching_staff', e.target.value)} placeholder="Non-teaching staff" className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple" />
                    <input value={form.total_classes || ''} onChange={(e) => updateField('total_classes', e.target.value)} placeholder="Classes" className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple" />
                    <input value={form.phone || ''} onChange={(e) => updateField('phone', e.target.value)} placeholder="Phone" className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple" />
                    <input value={form.contact_email || ''} onChange={(e) => updateField('contact_email', e.target.value)} placeholder="Contact email" className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple" />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input type="checkbox" checked={!!form.verified} onChange={(e) => updateField('verified', e.target.checked)} />
                    Mark this school as verified
                  </label>
                  {message ? <p className="text-sm text-brand-purple">{message}</p> : null}
                  <button onClick={handleSave} disabled={saving} className="w-full bg-brand-purple text-white font-medium py-3 rounded-xl disabled:opacity-60">
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                </>
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
                    {s.avatar_url ? <img src={s.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" /> : <span className="w-10 h-10 rounded-full bg-brand-light flex items-center justify-center">🙂</span>}
                    <div>
                      <p className="font-medium text-sm">{s.full_name || 'Staff member'}</p>
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
                <button onClick={() => galleryInputRef.current?.click()} disabled={uploadingPhoto} className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500 mb-3 disabled:opacity-60">
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
                    <button key={g.id} onClick={() => setLightboxItem({ ...g, kind: 'gallery' })} className="relative w-full h-32 rounded-lg overflow-hidden">
                      {g.media_type === 'video' ? (
                        <>
                          <video src={g.image_url} className="w-full h-full object-cover" muted preload="metadata" />
                          <span className="absolute inset-0 flex items-center justify-center bg-black/20">
                            <Video size={20} className="text-white" />
                          </span>
                        </>
                      ) : (
                        <img src={g.image_url} alt="" className="w-full h-full object-cover" />
                      )}
                      {galleryLikes[g.id]?.count > 0 ? (
                        <span className="absolute bottom-1 right-1 bg-black/50 text-white text-[10px] rounded-full px-1.5 py-0.5 flex items-center gap-0.5">
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
                <button onClick={() => navigate('/calendar/create')} className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500 mb-3">
                  <Plus size={16} /> Add Event
                </button>
              ) : (
                <p className="text-xs text-gray-400 text-center mb-3">Only school staff can add events.</p>
              )}
              {events.length === 0 ? (
                <p className="text-center text-gray-400 mt-6">No events scheduled.</p>
              ) : (
                <div className="space-y-2">
                  {events.map((e) => (
                    <div key={e.id} className="border border-gray-100 rounded-xl p-3">
                      <p className="font-medium text-sm">{e.title}</p>
                      <p className="text-xs text-gray-400">{new Date(e.event_date).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : null}

          {activeTab === 'Documents' ? (
            <>
              {canManageMedia ? (
                <button onClick={() => docInputRef.current?.click()} disabled={uploadingDoc} className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500 mb-3 disabled:opacity-60">
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
                      <span className="w-9 h-9 rounded-full bg-brand-light flex items-center justify-center shrink-0"><FileText size={16} className="text-brand-purple" /></span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{d.title}</p>
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
    </div>
  )
                          }
