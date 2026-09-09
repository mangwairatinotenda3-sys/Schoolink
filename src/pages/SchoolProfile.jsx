Iimport { useEffect, useRef, useState } from 'react'
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
                <div className="grid grid-cols-4 gap-2 mt-5 text-center">
          <div><span className="w-9 h-9 rounded-full bg-purple-500/30 mx-auto flex items-center justify-center mb-1"><Users size={16} /></span><p className="font-bold text-sm">{memberCount}</p><p className="text-[10px] text-white/50">Members</p></div>
          <div><span className="w-9 h-9 rounded-full bg-green-500/30 mx-auto flex items-center justify-center mb-1"><Award size={16} /></span><p className="font-bold text-sm">{school.pass_rate? `${school.pass_rate}%` : '—'}</p><p className="text-[10px] text-white/50">Pass Rate</p></div>
          <div><span className="w-9 h-9 rounded-full bg-blue-500/30 mx-auto flex items-center justify-center mb-1"><CalendarDays size={16} /></span><p className="font-bold text-sm">{school.established_year || '—'}</p><p className="text-[10px] text-white/50">Est.</p></div>
          <div><span className="w-9 h-9 rounded-full bg-orange-500/30 mx-auto flex items-center justify-center mb-1"><UserCog size={16} /></span><p className="font-bold text-sm">{staff.length || (school.total_teachers?? '—')}</p><p className="text-[10px] text-white/50">Staff</p></div>
        </div>
      </div>

      <div className="screen-scroll px-4">
        <div className="border border-gray-100 rounded-xl p-4 mt-4 space-y-3">
          <div className="flex items-center justify-between"><span className="text-sm text-gray-500">School Type</span><span className="text-sm font-medium">{school.school_type || '—'}</span></div>
          <div className="flex items-center justify-between"><span className="text-sm text-gray-500">Location</span><a href={mapsUrl()} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand-purple flex items-center gap-1">View on Map <ExternalLink size={12} /></a></div>
          {school.phone? <div className="flex items-center gap-2 text-sm text-gray-600"><Phone size={14} /> {school.phone}</div> : null}
          {school.contact_email? <div className="flex items-center gap-2 text-sm text-gray-600"><Mail size={14} /> {school.contact_email}</div> : null}
        </div>

        <div className="flex gap-2 mt-3">
          <button onClick={handleMessageSchool} className="flex-1 flex items-center justify-center gap-1.5 border border-gray-200 rounded-xl py-2.5 text-sm font-medium"><MessageSquare size={15} /> Message School</button>
          {!isMember? (<button onClick={toggleFollow} className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-medium ${isFollowing? 'bg-brand-navy text-white' : 'border border-brand-purple text-brand-purple'}`}>{isFollowing? <BellRing size={15} /> : <Bell size={15} />} {isFollowing? 'Following' : 'Follow'}</button>) : null}
        </div>

        {aboutText? (<div className="border border-gray-100 rounded-xl p-4 mt-3"><p className="font-semibold text-sm mb-1">About School</p><p className={`text-sm text-gray-600 ${aboutExpanded? '' : 'line-clamp-2'}`}>{aboutText}</p><button onClick={() => setAboutExpanded((e) =>!e)} className="text-xs text-brand-purple font-medium mt-1">{aboutExpanded? 'Show less' : 'Read more'}</button></div>) : null}

        <div className="border border-gray-100 rounded-xl p-4 mt-3">
          <div className="flex items-center justify-between mb-2"><p className="font-semibold text-sm">School Gallery</p><button onClick={() => setActiveTab('Photos')} className="text-xs text-brand-purple font-medium">View all</button></div>
          {gallery.length === 0 && activeTab!== 'Photos'? (<p className="text-xs text-gray-400">No photos yet.</p>) : (<div className="grid grid-cols-4 gap-1.5">{gallery.slice(0, 4).map((g) => (<img key={g.id} src={g.image_url} alt="" className="w-full h-16 object-cover rounded-md" />))}</div>)}
        </div>

        <div className="grid grid-cols-4 gap-2 mt-3 text-center">
          <div className="border border-gray-100 rounded-xl py-3"><p className="font-bold text-sm">{school.total_students?? '—'}</p><p className="text-[10px] text-gray-400">Total Students</p></div>
          <div className="border border-gray-100 rounded-xl py-3"><p className="font-bold text-sm">{school.total_teachers?? '—'}</p><p className="text-[10px] text-gray-400">Teachers</p></div>
          <div className="border border-gray-100 rounded-xl py-3"><p className="font-bold text-sm">{school.non_teaching_staff?? '—'}</p><p className="text-[10px] text-gray-400">Non-Teaching</p></div>
          <div className="border border-gray-100 rounded-xl py-3"><p className="font-bold text-sm">{school.total_classes?? '—'}</p><p className="text-[10px] text-gray-400">Classes</p></div>
        </div>

        <div className="flex gap-5 overflow-x-auto mt-4 border-b border-gray-100">
          {tabs.map((t) => (<button key={t} onClick={() => setActiveTab(t)} className={`pb-2 text-sm font-medium border-b-2 shrink-0 ${activeTab === t? 'border-brand-purple text-brand-purple' : 'border-transparent text-gray-400'}`}>{t}</button>))}
        </div>

        <div className="py-4 pb-6">
          {activeTab === 'Posts'? (posts.length === 0? (<p className="text-center text-gray-400 mt-6">No posts from this school yet.</p>) : (<div className="space-y-3">{posts.map((p) => (<button key={p.id} onClick={() => navigate(`/post/${p.id}`)} className="w-full text-left border border-gray-100 rounded-xl p-3"><p className="font-medium text-sm">{p.author_name}</p><p className="text-sm text-gray-600 mt-1 line-clamp-2">{p.content}</p></button>))}</div>)) : null}

          {activeTab === 'About'? (<div className="space-y-4">{['motto', 'vision', 'mission'].map((key) => (<div key={key}><p className="text-xs font-semibold text-gray-400 uppercase mb-1 capitalize">{key}</p>{canEdit? (<textarea value={form[key] || ''} onChange={(e) => updateField(key, e.target.value)} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple resize-none" />) : (<p className="text-sm text-gray-600">{school[key] || '—'}</p>)}</div>))}{canEdit? (<><div className="grid grid-cols-2 gap-3"><input value={form.pass_rate || ''} onChange={(e) => updateField('pass_rate', e.target.value)} placeholder="Pass rate %" className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple" /><input value={form.established_year || ''} onChange={(e) => updateField('established_year', e.target.value)} placeholder="Established year" className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple" /><input value={form.total_students || ''} onChange={(e) => updateField('total_students', e.target.value)} placeholder="Total students" className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple" /><input value={form.total_teachers || ''} onChange={(e) => updateField('total_teachers', e.target.value)} placeholder="Teachers" className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple" /><input value={form.non_teaching_staff || ''} onChange={(e) => updateField('non_teaching_staff', e.target.value)} placeholder="Non-teaching staff" className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple" /><input value={form.total_classes || ''} onChange={(e) => updateField('total_classes', e.target.value)} placeholder="Classes" className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple" /><input value={form.phone || ''} onChange={(e) => updateField('phone', e.target.value)} placeholder="Phone" className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple" /><input value={form.contact_email || ''} onChange={(e) => updateField('contact_email', e.target.value)} placeholder="Contact email" className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple" /></div><label className="flex items-center gap-2 text-sm text-gray-600"><input type="checkbox" checked={!!form.verified} onChange={(e) => updateField('verified', e.target.checked)} />Mark this school as verified</label>{message? <p className="text-sm text-brand-purple">{message}</p> : null}<button onClick={handleSave} disabled={saving} className="w-full bg-brand-purple text-white font-medium py-3 rounded-xl disabled:opacity-60">{saving? 'Saving…' : 'Save Changes'}</button></>) : null}</div>) : null}

          {activeTab === 'Staff'? (staff.length === 0? (<p className="text-center text-gray-400 mt-6">No staff members yet.</p>) : (<div className="divide-y divide-gray-100">{staff.map((s) => (<div key={s.id} className="flex items-center gap-3 py-3">{s.avatar_url? <img src={s.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" /> : <span className="w-10 h-10 rounded-full bg-brand-light flex items-center justify-center">🙂</span>}<div><p className="font-medium text-sm">{s.full_name || 'Staff member'}</p><p className="text-xs text-gray-400">{s.role}</p></div></div>))}</div>)) : null}

          {activeTab === 'Photos'? (<>{canEdit? (<button onClick={() => galleryInputRef.current?.click()} disabled={uploadingPhoto} className="w-full flex items-center justify-center gap-2 border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500 mb-3 disabled:opacity-60"><Plus size={16} /> {uploadingPhoto? 'Uploading…' : 'Add Photo'}</button>) : null}<input ref={galleryInputRef} type="file" accept="image/*" onChange={handleGalleryUpload} className="hidden" />{gallery.length === 0? (<p className="text-center text-gray-400 mt-6">No photos yet.</p>) : (<div className="grid grid-cols-2 gap-2">{gallery.map((g) => (<img key={g.id} src={g.image_url} alt="" className="w-full h-32 object-cover rounded-lg" />))}</div>)}</>) : null}

          {activeTab === 'Events'? (events.length === 0? (<p className="text-center text-gray-400 mt-6">No events scheduled.</p>) : (<div className="space-y-2">{events.map((e) => (<div key={e.id} className="border border-gray-100 rounded-xl p-3"><p className="font-medium text-sm">{e.title}</p><p className="text-xs text-gray-400">{new Date(e.event_date).toLocaleString()}</p></div>))}</div>)) : null}

          {activeTab === 'Documents'? (<>{canEdit? (<button onClick={() => docInputRef.current?.click()} disabled={uploadingDoc} className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500 mb-3 disabled:opacity-60"><Plus size={16} /> {uploadingDoc? 'Uploading…' : 'Add Document'}</button>) : null}<input ref={docInputRef} type="file" onChange={handleDocUpload} className="hidden" />{documents.length === 0? (<p className="text-center text-gray-400 mt-6">No documents yet.</p>) : (<div className="space-y-2">{documents.map((d) => (<div key={d.id} className="border border-gray-100 rounded-xl p-3"><div className="flex items-center gap-3 mb-2"><span className="w-9 h-9 rounded-full bg-brand-light flex items-center justify-center shrink-0"><FileText size={16} className="text-brand-purple" /></span><p className="text-sm font-medium truncate flex-1">{d.title}</p></div><div className="flex gap-2"><a href={d.file_url} target="_blank" rel="noreferrer" download className="flex-1 text-center bg-brand-purple text-white text-xs font-medium py-2 rounded-lg">Download</a><button onClick={() => {if (navigator.share) {navigator.share({ title: d.title, url: d.file_url })} else {navigator.clipboard?.writeText(d.file_url); alert('Link copied!')}}} className="flex-1 text-center border border-brand-purple text-brand-purple text-xs font-medium py-2 rounded-lg">Share</button>{canEdit? (<button onClick={async () => {if (!confirm('Delete this document?')) return; await supabase.from('school_documents').delete().eq('id', d.id); setDocuments(prev => prev.filter(x => x.id!== d.id))}} className="px-3 text-center border border-red-300 text-red-500 text-xs font-medium py-2 rounded-lg">Delete</button>) : null}</div></div>))}</div>)}</>) : null}
        </div>
      </div>
    </div>
  )
                                                                                                                                                   }
