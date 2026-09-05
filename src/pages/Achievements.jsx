import { useEffect, useRef, useState } from 'react'
import { Plus, X, Trophy } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

const categories = ['Academic', 'Sports', 'Cultural', 'Other']

export default function Achievements() {
  const { user, profile } = useAuth()
  const fileInputRef = useRef(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', category: 'Academic', achievement_date: '', image_url: '' })
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const canPost = profile?.role && profile.role !== 'Student'

  useEffect(() => {
    if (profile?.school_id) loadItems()
  }, [profile?.school_id])

  async function loadItems() {
    setLoading(true)
    const { data } = await supabase
      .from('school_achievements')
      .select('*')
      .eq('school_id', profile.school_id)
      .order('achievement_date', { ascending: false })
    setItems(data ?? [])
    setLoading(false)
  }

  function updateForm(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleImageChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `achievements/${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage.from('community-media').upload(path, file)
    if (!uploadError) {
      const { data } = supabase.storage.from('community-media').getPublicUrl(path)
      updateForm('image_url', data.publicUrl)
    }
    setUploading(false)
  }

  async function handleAdd() {
    if (!form.title.trim()) return
    setSaving(true)
    setError('')
    const { error: insertError } = await supabase.from('school_achievements').insert({
      ...form,
      achievement_date: form.achievement_date || null,
      school_id: profile.school_id,
      added_by: user.id,
    })
    setSaving(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    setForm({ title: '', description: '', category: 'Academic', achievement_date: '', image_url: '' })
    setShowForm(false)
    loadItems()
  }

  return (
    <div className="app-shell">
      <BackHeader title="School Achievements" />

      {canPost ? (
        <div className="px-4 pt-2">
          {showForm ? (
            <div className="border border-gray-100 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">Add Achievement</p>
                <button onClick={() => setShowForm(false)}>
                  <X size={16} className="text-gray-400" />
                </button>
              </div>
              <input
                value={form.title}
                onChange={(e) => updateForm('title', e.target.value)}
                placeholder="Title (e.g. National Debate Champions)"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
              />
              <textarea
                value={form.description}
                onChange={(e) => updateForm('description', e.target.value)}
                placeholder="Description"
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple resize-none"
              />
              <select
                value={form.category}
                onChange={(e) => updateForm('category', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
              >
                {categories.map((c) => <option key={c}>{c}</option>)}
              </select>
              <input
                type="date"
                value={form.achievement_date}
                onChange={(e) => updateForm('achievement_date', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-lg py-2.5 text-sm text-gray-500 disabled:opacity-60"
              >
                {uploading ? 'Uploading…' : form.image_url ? 'Photo added ✓' : 'Add a photo (optional)'}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
              {error ? <p className="text-red-500 text-xs">{error}</p> : null}
              <button
                onClick={handleAdd}
                disabled={saving || uploading}
                className="w-full bg-brand-purple text-white font-medium py-2.5 rounded-lg text-sm disabled:opacity-60"
              >
                {saving ? 'Adding…' : 'Add Achievement'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500"
            >
              <Plus size={16} /> Add Achievement
            </button>
          )}
        </div>
      ) : null}

      <div className="screen-scroll px-4 pt-3 space-y-3">
        {loading ? (
          <p className="text-center text-gray-400 mt-8">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-center text-gray-400 mt-8">No achievements added yet.</p>
        ) : (
          items.map((a) => (
            <div key={a.id} className="border border-gray-100 rounded-xl p-4">
              {a.image_url ? <img src={a.image_url} alt="" className="w-full rounded-lg mb-2 max-h-48 object-cover" /> : null}
              <div className="flex items-start gap-3">
                <span className="w-9 h-9 rounded-full bg-brand-light flex items-center justify-center shrink-0">
                  <Trophy size={16} className="text-brand-purple" />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-sm">{a.title}</p>
                  <p className="text-xs text-gray-400">
                    {a.category}{a.achievement_date ? ` · ${new Date(a.achievement_date).toLocaleDateString()}` : ''}
                  </p>
                  {a.description ? <p className="text-sm mt-1">{a.description}</p> : null}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
