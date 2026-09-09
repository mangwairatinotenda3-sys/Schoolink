import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Camera, MapPin, Phone, Mail, MessageSquare, ShieldCheck, Plus, Users, Award, CalendarDays, UserCog, FileText, ExternalLink, Bell, BellRing } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { canManageStaff } from '../lib/permissions.js'
import { useOnlineIds } from '../lib/presence.jsx'

const tabs = ['Posts', 'About', 'Staff', 'Photos', 'Events', 'Documents']

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
  const [memberIds, setMemberIds] = useState([])
  const [isFollowing, setIsFollowing] = useState(false)
  const [aboutExpanded, setAboutExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState('Posts')
  const [posts, setPosts] = useState([])
  const [staff, setStaff] = useState([])
  const [gallery, setGallery] = useState([])
  const [events, setEvents] = useState([])
  const [documents, setDocuments] = useState([])

  const isMember =!!school && profile?.school_id === school.id
  const canEdit = isMember && canManageStaff(profile)
  const isOnline = memberIds.some((id) => onlineIds.has(id))
  const handle = school?.name? '@' + school.name.toLowerCase().replace(/[^a-z0-9]/g, '') : ''

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

  async function loadSchool() {
    setLoading(true)
    const { data } = await supabase.from('schools').select('*').eq('id', targetSchoolId).maybeSingle()
    setSchool(data)
    setForm(data?? {})
    if (data) {
      const { data: members } = await supabase.from('profiles').select('id').eq('school_id', data.id).eq('status', 'active')
      setMemberCount(members?.length?? 0)
      setMemberIds((members?? []).map((m) => m.id))
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

  async function loadTabData(tab) {
    if (tab === 'Posts') {
      const ids = memberIds.length? memberIds : ['00000-0000-0000-0000-000']
      const { data } = await supabase.from('posts').select('*').in('author_id', ids).order('created_at', { ascending: false }).limit(20)
      setPosts(data?? [])
    } else if (tab === 'Staff') {
      const { data } = await supabase.from('profiles').select('*').eq('school_id', school.id).neq('role', 'Student')
      setStaff(data?? [])
    } else if (tab === 'Photos') {
      const { data } = await supabase.from('school_gallery').select('*').eq('school_id', school.id).order('created_at', { ascending: false })
      setGallery(data?? [])
    } else if (tab === 'Events') {
      const { data } = await supabase.from('events').select('*').eq('school_id', school.id).order('event_date', { ascending: true })
      setEvents(data?? [])
    } else if (tab === 'Documents') {
      const { data } = await supabase.from('school_documents').select('*').eq('school_id', school.id).order('created_at', { ascending: false })
      setDocuments(data?? [])
    }
  }

  function updateField(key, value) {
    setForm((f) => ({...f, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    setMessage('')
    const { error } = await supabase
     .from('schools')
     .update({
        name: form.name, location: form.location, motto: form.motto, vision: form.vision, mission: form.mission,
        pass_rate: form.pass_rate || null, established_year: form.established_year, phone: form.phone, contact_email: form.contact_email,
        total_students: form.total_students || null, total_teachers: form.total_teachers || null, non_teaching_staff: form.non_teaching_staff || null,
        total_classes: form.total_classes || null, verified: form.verified?? false,
      })
     .eq('id', school.id)
    setSaving(false)
    if (error) { setMessage(error.message); return }
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
      setSchool((s) => ({...s, logo_url: logoUrl }))
      setForm((f) => ({...f, logo_url: logoUrl }))
    }
    setUploadingLogo(false)
  }

  async function handleGalleryUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    const ext = file.name.split('.').pop()
    const path = `${school.id}/gallery/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('school-media').upload(path, file)
    if (!error) {
      const { data } = supabase.storage.from('school-media').getPublicUrl(path)
      const { data: row } = await supabase.from('school_gallery').insert({ school_id: school.id, image_url: data.publicUrl }).select().maybeSingle()
      if (row) setGallery((prev) => [row,...prev])
    }
    setUploadingPhoto(false)
  }

  async function handleDocUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingDoc(true)
    const path = `${school.id}/documents/${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from('school-media').upload(path, file)
    if (!error) {
      const { data } = supabase.storage.from('school-media').getPublicUrl(path)
      const { data: row } = await supabase.from('school_documents').insert({ school_id: school.id, title: file.name, file_url: data.publicUrl, uploaded_by: user.id }).select().maybeSingle()
      if (row) setDocuments((prev) => [row,...prev])
    }
    setUploadingDoc(false)
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
    return (<div className="app-shell"><BackHeader title="Profile" /><div className="screen-scroll flex items-center justify-center text-gray-400">Loading…</div></div>)
  }

  if (!school) {
    return (<div className="app-shell"><BackHeader title="Profile" /><div className="screen-scroll px-4 flex items-center justify-center text-gray-400 text-center">{paramSchoolId? 'School not found.' : "You're not linked to a school yet."}</div></div>)
  }

  const aboutText = school.mission || school.description || ''

  return (
    <div className="app-shell">
      <div className="bg-brand-navy text-white px-4 pt-4 pb-6">
        <BackHeader title="Profile" />
        <div className="flex flex-col items-center mt-2">
          <div className="relative">
            <span className="w-24 h-24 rounded-full bg-white p-1 flex items-center justify-center">
              {school.logo_url? <img src={school.logo_url} alt="" className="w-full h-full rounded-full object-cover" /> : <span className="text-4xl">🏫</span>}
            </span>
            {isOnline? (<span className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-green-500 border-2 border-brand-navy flex items-center justify-center"><span className="w-2 h-2 rounded-full bg-white" /></span>) : null}
            {canEdit? (<button onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo} className="absolute top-0 right-0 w-7 h-7 rounded-full bg-brand-purple flex items-center justify-center border-2 border-brand-navy"><Camera size={13} className="text-white" /></button>) : null}
            <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
          </div>
          <p className="font-bold text-lg mt-3 flex items-center gap-1.5 flex-wrap justify-center">{school.name}{school.verified? <ShieldCheck size={17} className="text-brand-purple bg-white rounded-full" /> : null}</p>
          <p className="text-xs text-white/50">{handle}</p>
          {school.school_type? <span className="text-[11px] bg-brand-purple/30 px-2 py-0.5 rounded-full mt-1">{school.school_type}</span> : null}
          <p className="text-sm text-white/70 flex items-center gap-1 mt-2"><MapPin size={13} /> {school.location || 'Location not set'}{isOnline? <span className="text-green-400 ml-1">· Online</span> : null}</p>
        </div>
