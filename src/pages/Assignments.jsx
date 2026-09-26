import { useEffect, useRef, useState } from 'react'
import { Plus, X, ClipboardList, Paperclip, FileText, Video, Image as ImageIcon, Download } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import BottomNav from '../components/BottomNav.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

function canPost(profile) {
  return ['Teacher / Tutor', 'Headteacher', 'Deputy Head'].includes(profile?.role)
}

function formatDue(dateString) {
  if (!dateString) return null
  return new Date(dateString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function attachmentIcon(mediaType) {
  if (mediaType === 'video') return Video
  if (mediaType === 'image') return ImageIcon
  return FileText
}

function mediaTypeFor(file) {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  return 'file'
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

export default function Assignments() {
  const { user, profile } = useAuth()
  const fileInputRef = useRef(null)
  const [items, setItems] = useState([])
  const [attachmentsByAssignment, setAttachmentsByAssignment] = useState({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', subject: '', description: '', due_date: '' })
  const [pendingFiles, setPendingFiles] = useState([])
  const [saving, setSaving] = useState(false)
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (profile?.school_id) loadItems()
  }, [profile?.school_id])

  async function loadItems() {
    setLoading(true)
    const { data } = await supabase
      .from('assignments')
      .select('*')
      .eq('school_id', profile.school_id)
      .order('created_at', { ascending: false })
    setItems(data ?? [])

    const ids = (data ?? []).map((a) => a.id)
    if (ids.length) {
      const { data: attachments } = await supabase.from('assignment_attachments').select('*').in('assignment_id', ids)
      const grouped = {}
      ;(attachments ?? []).forEach((att) => {
        if (!grouped[att.assignment_id]) grouped[att.assignment_id] = []
        grouped[att.assignment_id].push(att)
      })
      setAttachmentsByAssignment(grouped)
    } else {
      setAttachmentsByAssignment({})
    }
    setLoading(false)
  }

  function updateForm(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function handlePickFiles(e) {
    const files = Array.from(e.target.files || [])
    setPendingFiles((prev) => [...prev, ...files])
    e.target.value = ''
  }

  function removePendingFile(index) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleAdd() {
    if (!form.title.trim()) return
    setSaving(true)
    setError('')
    const { data: row, error: insertError } = await supabase
      .from('assignments')
      .insert({
        ...form,
        due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
        school_id: profile.school_id,
        created_by: user.id,
        author_name: profile?.full_name || user.email,
      })
      .select()
      .maybeSingle()

    if (insertError) {
      setSaving(false)
      setError(insertError.message)
      return
    }

    if (pendingFiles.length) {
      setUploadingFiles(true)
      for (const file of pendingFiles) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const path = `assignments/${profile.school_id}/${row.id}/${Date.now()}-${safeName}`
        const { error: uploadError } = await supabase.storage.from('school-media').upload(path, file)
        if (!uploadError) {
          const { data: pub } = supabase.storage.from('school-media').getPublicUrl(path)
          await supabase.from('assignment_attachments').insert({
            assignment_id: row.id,
            file_url: pub.publicUrl,
            file_name: file.name,
            media_type: mediaTypeFor(file),
          })
        }
      }
      setUploadingFiles(false)
    }

    setSaving(false)
    setForm({ title: '', subject: '', description: '', due_date: '' })
    setPendingFiles([])
    setShowForm(false)
    loadItems()
  }

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader title="Homework & Assignments" />

      {canPost(profile) ? (
        <div className="px-4 pt-2">
          {showForm ? (
            <div className="border border-gray-100 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">Add Assignment</p>
                <button onClick={() => setShowForm(false)}>
                  <X size={16} className="text-gray-400" />
                </button>
              </div>
              <input
                value={form.title}
                onChange={(e) => updateForm('title', e.target.value)}
                placeholder="Title"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
              />
              <input
                value={form.subject}
                onChange={(e) => updateForm('subject', e.target.value)}
                placeholder="Subject"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
              />
              <textarea
                value={form.description}
                onChange={(e) => updateForm('description', e.target.value)}
                placeholder="Instructions"
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple resize-none"
              />
              <label className="text-xs text-gray-500">Due date</label>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => updateForm('due_date', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-lg py-2.5 text-sm text-gray-500"
              >
                <Paperclip size={15} /> Attach Photos, Videos or Files
              </button>
              <input ref={fileInputRef} type="file" multiple onChange={handlePickFiles} className="hidden" />

              {pendingFiles.length > 0 ? (
                <div className="space-y-1">
                  {pendingFiles.map((f, i) => (
                    <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-1.5">
                      <span className="text-xs truncate flex-1">{f.name}</span>
                      <button onClick={() => removePendingFile(i)}><X size={13} className="text-gray-400" /></button>
                    </div>
                  ))}
                </div>
              ) : null}

              {error ? <p className="text-red-500 text-xs">{error}</p> : null}
              <button
                onClick={handleAdd}
                disabled={saving || uploadingFiles}
                className="w-full bg-brand-purple text-white font-medium py-2.5 rounded-lg text-sm disabled:opacity-60"
              >
                {uploadingFiles ? 'Uploading files…' : saving ? 'Posting…' : 'Post Assignment'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500"
            >
              <Plus size={16} /> Add Assignment
            </button>
          )}
        </div>
      ) : null}

      <div className="screen-scroll px-4 pt-3">
        {loading ? (
          <p className="text-center text-gray-400 mt-8">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-center text-gray-400 mt-8">No assignments posted yet.</p>
        ) : (
          <div className="space-y-3">
            {items.map((a) => (
              <div key={a.id} className="border border-gray-100 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <span className="w-9 h-9 rounded-full bg-brand-light flex items-center justify-center shrink-0">
                    <ClipboardList size={16} className="text-brand-purple" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm">{a.title}</p>
                    <p className="text-xs text-gray-400">{a.subject} · {a.author_name}</p>
                    {a.description ? <p className="text-sm mt-2">{a.description}</p> : null}
                    {a.due_date ? (
                      <p className="text-xs text-orange-500 font-medium mt-2">Due {formatDue(a.due_date)}</p>
                    ) : null}

                    {(attachmentsByAssignment[a.id] || []).length > 0 ? (
                      <div className="mt-3 space-y-1.5">
                        {attachmentsByAssignment[a.id].map((att) => {
                          const Icon = attachmentIcon(att.media_type)
                          return (
                            <button
                              key={att.id}
                              onClick={() => downloadItem(att.file_url, att.file_name)}
                              className="w-full flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 text-left"
                            >
                              <Icon size={14} className="text-brand-purple shrink-0" />
                              <span className="text-xs truncate flex-1">{att.file_name}</span>
                              <Download size={13} className="text-gray-400 shrink-0" />
                            </button>
                          )
                        })}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  )
    }
