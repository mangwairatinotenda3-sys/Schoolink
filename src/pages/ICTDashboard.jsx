import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, X, Laptop, Paperclip, FileText, Video, Image as ImageIcon, Download, Trash2, Monitor, User } from 'lucide-react'
import {
  DashHero, SectionTitle, Tabs, SearchBox, Empty, Denied, Field, Sheet, PrimaryButton, Pill, Fab, INPUT,
} from '../components/DashKit.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { canManageDevices } from '../lib/permissions.js'

const BLANK = { name: '', device_type: '', assigned_to: '', status: 'active', notes: '' }
const STATUSES = [
  { key: 'active', label: 'Working', tone: 'green' },
  { key: 'under repair', label: 'Repair', tone: 'amber' },
  { key: 'retired', label: 'Retired', tone: 'gray' },
]

const TYPE_EMOJI = [
  ['laptop', '💻'], ['computer', '🖥️'], ['desktop', '🖥️'], ['pc', '🖥️'], ['phone', '📱'], ['tablet', '📲'],
  ['printer', '🖨️'], ['projector', '📽️'], ['router', '📡'], ['wifi', '📡'], ['camera', '📷'], ['tv', '📺'], ['speaker', '🔊'],
]

function emojiFor(type) {
  const t = (type || '').toLowerCase()
  const hit = TYPE_EMOJI.find(([k]) => t.includes(k))
  return hit ? hit[1] : '🔧'
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

export default function ICTDashboard() {
  const { user, profile } = useAuth()
  const fileInputRef = useRef(null)
  const [devices, setDevices] = useState([])
  const [attachmentsByDevice, setAttachmentsByDevice] = useState({})
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [pendingFiles, setPendingFiles] = useState([])
  const [saving, setSaving] = useState(false)
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)

  useEffect(() => {
    if (profile?.school_id) loadDevices()
  }, [profile?.school_id])

  useEffect(() => {
    if (!notice) return undefined
    const t = setTimeout(() => setNotice(''), 3200)
    return () => clearTimeout(t)
  }, [notice])

  async function loadDevices() {
    setLoading(true)
    const { data } = await supabase.from('devices').select('*').eq('school_id', profile.school_id).order('created_at', { ascending: false })
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
    if (!form.name.trim()) {
      setError('Give the device a name or ID.')
      return
    }
    setSaving(true)
    setError('')
    const { data: row, error: insertError } = await supabase
      .from('devices')
      .insert({ ...form, name: form.name.trim(), school_id: profile.school_id, recorded_by: user.id })
      .select()
      .maybeSingle()

    if (insertError || !row) {
      setSaving(false)
      setError(insertError?.message || 'Could not save the device.')
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
          await supabase.from('device_attachments').insert({ device_id: row.id, file_url: pub.publicUrl, file_name: file.name, media_type: mediaTypeFor(file) })
        }
      }
      setUploadingFiles(false)
    }

    setSaving(false)
    setForm(BLANK)
    setPendingFiles([])
    setOpen(false)
    loadDevices()
  }

  async function setStatus(d, status) {
    const before = devices
    setDevices((prev) => prev.map((x) => (x.id === d.id ? { ...x, status } : x)))
    const { data: upRows, error: upErr } = await supabase.from('devices').update({ status }).eq('id', d.id).select('id')
    if (upErr || !upRows?.length) {
      setDevices(before)
      setNotice("Couldn't change that device. Run the dashboards SQL once, then try again.")
    }
  }

  async function removeDevice() {
    const d = confirmDelete
    if (!d) return
    setConfirmDelete(null)
    const before = devices
    setDevices((prev) => prev.filter((x) => x.id !== d.id))
    const { data: delRows, error: delErr } = await supabase.from('devices').delete().eq('id', d.id).select('id')
    if (delErr || !delRows?.length) {
      setDevices(before)
      setNotice("Couldn't delete that device. Run the dashboards SQL once, then try again.")
    }
  }

  const working = devices.filter((d) => d.status === 'active').length
  const repair = devices.filter((d) => d.status === 'under repair').length
  const retired = devices.filter((d) => d.status === 'retired').length

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return devices.filter((d) => {
      if (tab !== 'all' && d.status !== tab) return false
      if (!q) return true
      return `${d.name} ${d.device_type || ''} ${d.assigned_to || ''} ${d.notes || ''}`.toLowerCase().includes(q)
    })
  }, [devices, tab, query])

  if (!canManageDevices(profile)) {
    return <Denied title="ICT" text="Only the ICT Administrator and school leadership can view this." />
  }

  return (
    <div className="app-shell">
      <div className="screen-scroll">
        <DashHero
          icon={Monitor}
          title="ICT"
          subtitle="Devices and equipment"
          stats={[
            { label: 'Devices', value: devices.length },
            { label: 'Working', value: working },
            { label: 'Repair', value: repair },
          ]}
        />

        <div className="px-4 pb-32">
          <SectionTitle>Inventory</SectionTitle>
          <SearchBox value={query} onChange={setQuery} placeholder="Search a device or person" />
          <div className="mt-3">
            <Tabs
              value={tab}
              onChange={setTab}
              items={[
                { key: 'all', label: 'All', count: devices.length },
                { key: 'active', label: 'Working', count: working },
                { key: 'under repair', label: 'Repair', count: repair },
                { key: 'retired', label: 'Retired', count: retired },
              ]}
            />
          </div>

          {notice ? <p className="mt-3 text-xs bg-gray-900 text-white rounded-full px-4 py-2 text-center">{notice}</p> : null}

          <div className="mt-3 space-y-2.5">
            {loading ? (
              <p className="text-center text-gray-400 py-10">Loading…</p>
            ) : shown.length === 0 ? (
              <Empty
                icon={Laptop}
                title={devices.length === 0 ? 'No devices logged yet' : 'Nothing here'}
                text={devices.length === 0 ? 'Tap Add device to start your inventory.' : 'Try another tab or search.'}
              />
            ) : (
              shown.map((d) => {
                const st = STATUSES.find((s) => s.key === d.status) || STATUSES[0]
                const atts = attachmentsByDevice[d.id] || []
                return (
                  <div key={d.id} className="rounded-2xl border border-gray-100 bg-white p-3.5">
                    <div className="flex items-center gap-3">
                      <span className="w-12 h-12 rounded-2xl bg-brand-light flex items-center justify-center text-2xl shrink-0">{emojiFor(d.device_type)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[15px] text-brand-navy truncate">{d.name}</p>
                        <p className="text-xs text-gray-400 truncate">{d.device_type || 'Device'}</p>
                      </div>
                      <Pill tone={st.tone}>{st.label}</Pill>
                    </div>
                    {d.assigned_to ? <p className="flex items-center gap-1.5 text-xs text-gray-500 mt-2.5"><User size={13} className="text-brand-purple" /> {d.assigned_to}</p> : null}
                    {d.notes ? <p className="text-sm text-gray-600 mt-2 leading-snug">{d.notes}</p> : null}

                    {atts.length > 0 ? (
                      <div className="mt-2.5 space-y-1.5">
                        {atts.map((att) => {
                          const Icon = attachmentIcon(att.media_type)
                          return (
                            <button key={att.id} onClick={() => downloadItem(att.file_url, att.file_name)} className="w-full flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5 text-left">
                              <Icon size={15} className="text-brand-purple shrink-0" />
                              <span className="text-xs truncate flex-1">{att.file_name}</span>
                              <Download size={14} className="text-gray-400 shrink-0" />
                            </button>
                          )
                        })}
                      </div>
                    ) : null}

                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                      <div className="flex-1 grid grid-cols-3 gap-1 p-1 rounded-xl bg-gray-100">
                        {STATUSES.map((s) => (
                          <button
                            key={s.key}
                            onClick={() => d.status !== s.key && setStatus(d, s.key)}
                            className={`h-8 rounded-lg text-[11px] font-semibold ${d.status === s.key ? 'bg-white text-brand-navy shadow-sm' : 'text-gray-500'}`}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                      <button onClick={() => setConfirmDelete(d)} aria-label="Delete device" className="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 shrink-0"><Trash2 size={16} /></button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
      <Fab onClick={() => { setError(''); setOpen(true) }} icon={Plus} label="Add device" />

      <Sheet
        open={open}
        title="New device"
        onClose={() => !saving && setOpen(false)}
        footer={(
          <>
            {error ? <p className="text-red-500 text-sm mb-2">{error}</p> : null}
            <PrimaryButton onClick={handleAdd} busy={saving || uploadingFiles}>{uploadingFiles ? 'Uploading files…' : 'Save device'}</PrimaryButton>
          </>
        )}
      >
        <Field label="Name or ID"><input value={form.name} onChange={(e) => updateForm('name', e.target.value)} placeholder="LAB-PC-07" className={INPUT} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type"><input value={form.device_type} onChange={(e) => updateForm('device_type', e.target.value)} placeholder="Laptop" className={INPUT} /></Field>
          <Field label="Status">
            <select value={form.status} onChange={(e) => updateForm('status', e.target.value)} className={INPUT}>
              <option value="active">Working</option>
              <option value="under repair">Under repair</option>
              <option value="retired">Retired</option>
            </select>
          </Field>
        </div>
        <Field label="Assigned to (optional)"><input value={form.assigned_to} onChange={(e) => updateForm('assigned_to', e.target.value)} placeholder="Computer lab / Mr Moyo" className={INPUT} /></Field>
        <Field label="Notes (optional)"><input value={form.notes} onChange={(e) => updateForm('notes', e.target.value)} placeholder="Serial number, warranty…" className={INPUT} /></Field>

        <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500">
          <Paperclip size={16} /> Attach photos, videos or files
        </button>
        <input ref={fileInputRef} type="file" multiple onChange={handlePickFiles} className="hidden" />
        {pendingFiles.length > 0 ? (
          <div className="space-y-1.5">
            {pendingFiles.map((f, i) => (
              <div key={`${f.name}-${i}`} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
                <span className="text-xs truncate flex-1">{f.name}</span>
                <button onClick={() => removePendingFile(i)} aria-label="Remove file"><X size={14} className="text-gray-400" /></button>
              </div>
            ))}
          </div>
        ) : null}
      </Sheet>

      <Sheet
        open={!!confirmDelete}
        title="Delete this device?"
        onClose={() => setConfirmDelete(null)}
        footer={(
          <div className="flex gap-2">
            <button onClick={() => setConfirmDelete(null)} className="flex-1 h-12 rounded-2xl border border-gray-200 font-semibold">Cancel</button>
            <button onClick={removeDevice} className="flex-1 h-12 rounded-2xl bg-red-600 text-white font-semibold">Delete</button>
          </div>
        )}
      >
        <p className="text-sm text-gray-500">{confirmDelete?.name} will be removed from the inventory. This can't be undone.</p>
      </Sheet>
    </div>
  )
  }
