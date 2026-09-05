import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, MapPin, Phone, Mail, MessageSquare, ShieldCheck, Plus, X } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { canManageStaff } from '../lib/permissions.js'

const tabs = ['Posts', 'About', 'Staff', 'Photos', 'Events']

export default function SchoolProfile() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const logoInputRef = useRef(null)
  const galleryInputRef = useRef(null)

  const [school, setSchool] = useState(null)
  const [form, setForm] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  const [activeTab, setActiveTab] = useState('Posts')
  const [posts, setPosts] = useState([])
  const [staff, setStaff] = useState([])
  const [gallery, setGallery] = useState([])
  const [events, setEvents] = useState([])

  const canEdit = canManageStaff(profile)

  useEffect(() => {
    if (!profile?.school_id) {
      setLoading(false)
      return
    }
    loadSchool()
  }, [profile?.school_id])

  useEffect(() => {
    if (school) loadTabData(activeTab)
  }, [activeTab, school])

  async function loadSchool() {
    setLoading(true)
    const { data } = await supabase.from('schools').select('*').eq('id', profile.school_id).maybeSingle()
    setSchool(data)
    setForm(data ?? {})
    setLoading(false)
  }

  async function loadTabData(tab) {
    if (tab === 'Posts') {
      const { data: members } = await supabase.from('profiles').select('id').eq('school_id', school.id)
      const ids = (members ?? []).map((m) => m.id)
      const { data } = await supabase.from('posts').select('*').in('author_id', ids.length ? ids : ['0']).order('created_at', { ascending: false }).limit(20)
      setPosts(data ?? [])
    } else if (tab === 'Staff') {
      const { data } = await supabase.from('profiles').select('*').eq('school_id', school.id).neq('role', 'Student')
      setStaff(data ?? [])
    } else if (tab === 'Photos') {
      const { data } = await supabase.from('school_gallery').select('*').eq('school_id', school.id).order('created_at', { ascending: false })
      setGallery(data ?? [])
    } else if (tab === 'Events') {
      const { data } = await supabase.from('events').select('*').eq('school_id', school.id).order('event_date', { ascending: true })
      setEvents(data ?? [])
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
      const { data: row } = await supabase
        .from('school_gallery')
        .insert({ school_id: school.id, image_url: data.publicUrl })
        .select()
        .maybeSingle()
      if (row) setGallery((prev) => [row, ...prev])
    }
    setUploadingPhoto(false)
  }

  async function handleMessageSchool() {
    const { data: headteacher } = await supabase
      .from('profiles')
      .select('id')
      .eq('school_id', school.id)
      .eq('role', 'Headteacher')
      .maybeSingle()
    if (headteacher) navigate(`/chats/${headteacher.id}`)
  }

  if (loading) {
    return (
      <div className="app-shell">
        <BackHeader title="School Profile" />
        <div className="screen-scroll flex items-center justify-center text-gray-400">Loading…</div>
      </div>
    )
  }

  if (!school) {
    return (
      <div className="app-shell">
        <BackHeader title="School Profile" />
        <div className="screen-scroll px-4 flex items-center justify-center text-gray-400 text-center">
          You're not linked to a school yet.
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <BackHeader title="Profile" />

      <div className="screen-scroll px-4 pt-2">
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            {school.logo_url ? (
              <img src={school.logo_url} alt="" className="w-20 h-20 rounded-full object-cover border border-gray-100" />
            ) : (
              <span className="w-20 h-20 rounded-full bg-brand-light flex items-center justify-center text-3xl">🏫</span>
            )}
            {canEdit ? (
              <button
                onClick={() => logoInputRef.current?.click()}
                disabled={uploadingLogo}
                className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-brand-purple flex items-center justify-center border-2 border-white"
              >
                <Camera size={13} className="text-white" />
              </button>
            ) : null}
            <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
          </div>

          <div className="min-w-0 flex-1 pt-1">
            <p className="font-bold text-lg flex items-center gap-1.5 flex-wrap">
              {school.name}
              {school.verified ? <ShieldCheck size={16} className="text-brand-purple shrink-0" /> : null}
            </p>
            <p className="text-xs text-gray-400">{school.school_type}</p>
            <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
              <MapPin size={13} className="shrink-0" /> {school.location || 'No location set'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 mt-4 text-center">
          <div>
            <p className="font-bold text-sm">{school.total_students ?? '—'}</p>
            <p className="text-[10px] text-gray-400">Students</p>
          </div>
          <div>
            <p className="font-bold text-sm">{school.pass_rate ? `${school.pass_rate}%` : '—'}</p>
            <p className="text-[10px] text-gray-400">Pass Rate</p>
          </div>
          <div>
            <p className="font-bold text-sm">{school.established_year || '—'}</p>
            <p className="text-[10px] text-gray-400">Est.</p>
          </div>
          <div>
            <p className="font-bold text-sm">{school.total_teachers ?? '—'}</p>
            <p className="text-[10px] text-gray-400">Teachers</p>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={handleMessageSchool}
            className="flex-1 flex items-center justify-center gap-1.5 border border-gray-200 rounded-xl py-2.5 text-sm font-medium"
          >
            <MessageSquare size={15} /> Message School
          </button>
        </div>

        {(school.phone || school.contact_email) ? (
          <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500">
            {school.phone ? <span className="flex items-center gap-1"><Phone size={12} /> {school.phone}</span> : null}
            {school.contact_email ? <span className="flex items-center gap-1"><Mail size={12} /> {school.contact_email}</span> : null}
          </div>
        ) : null}

        <div className="flex gap-5 overflow-x-auto mt-5 border-b border-gray-100">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`pb-2 text-sm font-medium border-b-2 shrink-0 ${
                activeTab === t ? 'border-brand-purple text-brand-purple' : 'border-transparent text-gray-400'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="py-4">
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
              {['motto', 'vision', 'mission'].map((key) => (
                <div key={key}>
                  <p className="text-xs font-semibold text-gray-400 uppercase mb-1">{key}</p>
                  {canEdit ? (
                    <textarea
                      value={form[key] || ''}
                      onChange={(e) => updateField(key, e.target.value)}
                      rows={2}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple resize-none"
                    />
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
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full bg-brand-purple text-white font-medium py-3 rounded-xl disabled:opacity-60"
                  >
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
                    {s.avatar_url ? (
                      <img src={s.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <span className="w-10 h-10 rounded-full bg-brand-light flex items-center justify-center">🙂</span>
                    )}
                    <div>
                      <p className="font-medium text-sm">{s.full_name || 'Staff member'}</p>
                      <p className="text-xs text-gray-400">{s.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : null}

          {activeTab === 'Photos' ? (
            <>
              {canEdit ? (
                <button
                  onClick={() => galleryInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500 mb-3 disabled:opacity-60"
                >
                  <Plus size={16} /> {uploadingPhoto ? 'Uploading…' : 'Add Photo'}
                </button>
              ) : null}
              <input ref={galleryInputRef} type="file" accept="image/*" onChange={handleGalleryUpload} className="hidden" />
              {gallery.length === 0 ? (
                <p className="text-center text-gray-400 mt-6">No photos yet.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {gallery.map((g) => (
                    <img key={g.id} src={g.image_url} alt="" className="w-full h-32 object-cover rounded-lg" />
                  ))}
                </div>
              )}
            </>
          ) : null}

          {activeTab === 'Events' ? (
            events.length === 0 ? (
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
            )
          ) : null}
        </div>
      </div>
    </div>
  )
        }
