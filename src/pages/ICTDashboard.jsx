import { useEffect, useRef, useState } from 'react'
import { Plus, X, Laptop, Paperclip, FileText, Video, Image as ImageIcon, Download } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { canManageDevices } from '../lib/permissions.js'

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

export default function ICTDashboard() {
  const { user, profile } = useAuth()
  const fileInputRef = useRef(null)
  const [devices, setDevices] = useState([])
  const [attachmentsByDevice, setAttachmentsByDevice] = useState({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', device_type: '', assigned_to: '', status: 'active', notes: '' })
  const [pendingFiles, setPendingFiles] = useState([])
  const [saving, setSaving] = useState(false)
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (profile?.school_id) loadDevices()
  }, [profile?.school_id])

  async function loadDevices() {
    setLoading(true)
    const { data } = await supabase
      .from('devices')
      .select('*')
      .eq('school_id', profile.school_id)
      .order('created_at', { ascending: false })
    setDevices(data ?? [])

    const ids = (data ?? []).map((d) => d.id)
    if (ids.length) {
      const { data: attachments } = await supabase.from('device_attachments').select('*').in('device_id', ids)
      const grouped = {}
      ;(attachments ?? []).forEach((att) => {
        if (!grouped[att.device_id]) grouped[att.device_id] = []
        grouped[att.device_id].push(att)
      })
      setAttachmentsByDevice(grouped)
    } else {
      setAttachmentsByDevice({})
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
    if (!form.name.trim()) return
    setSaving(true)
    setError('')
    const { data: row, error: insertError } = await supabase
      .from('devices')
      .insert({
        ...form,
        school_id: profile.school_id,
        recorded_by: user.id,
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
        const path = `devices/${profile.school_id}/${row.id}/${Date.now()}-${safeName}`
        const { error: uploadError } = await supabase.storage.from('school-media').upload(path, file)
        if (!uploadError) {
          const { data: pub } = supabase.storage.from('school-media').getPublicUrl(path)
          await supabase.from('device_attachments').insert({
            device_id: row.id,
            file_url: pub.publicUrl,
            file_name: file.name,
            media_type: mediaTypeFor(file),
          })
        }
      }
      setUploadingFiles(false)
    }

    setSaving(false)
    setForm({ name: '', device_type: '', assigned_to: '', status: 'active', notes: '' })
    setPendingFiles([])
    setShowForm(false)
    loadDevices()
  }

  if (!canManageDevices(profile)) {
    return (
      <div className="flex-1 flex flex-col">
        <BackHeader title="ICT Dashboard" />
        <div className="screen-scroll px-6 flex items-center justify-center text-center text-gray-400">
          Only the ICT Administrator and school leadership can view this.
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader title="ICT Dashboard" />
      <div className="screen-scroll px-4">
        <div className="mt-2">
          {showForm ? (
            <div className="border border-gray-100 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">Add Device</p>
                <button onClick={() => setShowForm(false)}>
                  <X size={16} className="text-gray-400" />
                </button>
              </div>
              <input
                value={form.name}
                onChange={(e) => updateForm('name', e.target.value)}
                placeholder="Device name / ID"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
              />
              <input
                value={form.device_type}
                onChange={(e) => updateForm('device_type', e.target.value)}
                placeholder="Type (e.g. Laptop, Projector)"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
              />
              <input
                value={form.assigned_to}
                onChange={(e) => updateForm('assigned_to', e.target.value)}
                placeholder="Assigned to (optional)"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
              />
              <select
                value={form.status}
                onChange={(e) => updateForm('status', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
              >
                <option value="active">Active</option>
                <option value="under repair">Under Repair</option>
                <option value="retired">Retired</option>
              </select>
              <input
                value={form.notes}
                onChange={(e) => updateForm('notes', e.target.value)}
                placeholder="Notes (optional)"
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
                {uploadingFiles ? 'Uploading files…' : saving ? 'Saving…' : 'Add Device'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500"
            >
              <Plus size={16} /> Add Device
            </button>
          )}
        </div>

        <div className="mt-4">
          {loading ? (
            <p className="text-center text-gray-400 mt-8">Loading…</p>
          ) : devices.length === 0 ? (
            <p className="text-center text-gray-400 mt-8">No devices logged yet.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {devices.map((d) => (
                <div key={d.id} className="py-3">
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-full bg-brand-light flex items-center justify-center shrink-0">
                      <Laptop size={16} className="text-brand-purple" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{d.name}</p>
                      <p className="text-xs text-gray-400">
                        {[d.device_type, d.assigned_to].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
                        d.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-500'
                      }`}
                    >
                      {d.status}
                    </span>
                  </div>

                  {(attachmentsByDevice[d.id] || []).length > 0 ? (
                    <div className="mt-2 pl-12 space-y-1.5">
                      {attachmentsByDevice[d.id].map((att) => {
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
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
        }
