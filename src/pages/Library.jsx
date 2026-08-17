import { useEffect, useRef, useState } from 'react'
import { Search, Plus, X, BookOpen, Upload } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { canManageLibrary } from '../lib/permissions.js'

const categories = ['All', 'Novel', 'Textbook', 'Past Paper']

export default function Library() {
  const { user, profile } = useAuth()
  const fileInputRef = useRef(null)
  const [resources, setResources] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [showAddForm, setShowAddForm] = useState(false)

  const [form, setForm] = useState({
    title: '', author: '', category: 'Novel', language: '', country: '', exam_board: '', year: '', file_url: '',
  })
  const [uploadedFile, setUploadedFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadResources()
  }, [])

  async function loadResources() {
    setLoading(true)
    const { data } = await supabase
      .from('library_resources')
      .select('*')
      .order('created_at', { ascending: false })
    setResources(data ?? [])
    setLoading(false)
  }

  function updateForm(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setUploading(true)
    setError('')

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${user.id}/${Date.now()}-${safeName}`

    const { error: uploadError } = await supabase.storage.from('library-files').upload(path, file)
    if (uploadError) {
      setError(uploadError.message)
      setUploading(false)
      return
    }

    const { data } = supabase.storage.from('library-files').getPublicUrl(path)
    setUploadedFile(file.name)
    updateForm('file_url', data.publicUrl)
    setUploading(false)
  }

  async function handleAdd() {
    if (!form.title.trim()) return
    setSaving(true)
    setError('')
    const { error: insertError } = await supabase.from('library_resources').insert({
      ...form,
      added_by: user.id,
    })
    setSaving(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    setForm({ title: '', author: '', category: 'Novel', language: '', country: '', exam_board: '', year: '', file_url: '' })
    setUploadedFile(null)
    setShowAddForm(false)
    loadResources()
  }

  const filtered = resources.filter((r) => {
    const matchesCategory = category === 'All' || r.category === category
    const q = query.toLowerCase().trim()
    const matchesQuery =
      !q ||
      r.title?.toLowerCase().includes(q) ||
      r.author?.toLowerCase().includes(q) ||
      r.language?.toLowerCase().includes(q) ||
      r.country?.toLowerCase().includes(q) ||
      r.exam_board?.toLowerCase().includes(q)
    return matchesCategory && matchesQuery
  })

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader title="Library" />

      <div className="px-4 pt-2 pb-2">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title, author, language, country, board…"
            className="w-full border border-gray-200 rounded-full pl-9 pr-4 py-2.5 text-sm outline-brand-purple"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto mt-3 pb-1">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border ${
                category === c ? 'bg-brand-purple text-white border-brand-purple' : 'border-gray-200 text-gray-600'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {canManageLibrary(profile) ? (
        <div className="px-4 pb-2">
          {showAddForm ? (
            <div className="border border-gray-100 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">Add Resource</p>
                <button onClick={() => setShowAddForm(false)}>
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
                value={form.author}
                onChange={(e) => updateForm('author', e.target.value)}
                placeholder="Author (optional)"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
              />
              <select
                value={form.category}
                onChange={(e) => updateForm('category', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
              >
                <option>Novel</option>
                <option>Textbook</option>
                <option>Past Paper</option>
              </select>
              <input
                value={form.language}
                onChange={(e) => updateForm('language', e.target.value)}
                placeholder="Language (e.g. Shona, English)"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
              />
              <input
                value={form.country}
                onChange={(e) => updateForm('country', e.target.value)}
                placeholder="Country (e.g. Zimbabwe, UK)"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
              />
              <input
                value={form.exam_board}
                onChange={(e) => updateForm('exam_board', e.target.value)}
                placeholder="Exam Board (e.g. Zimsec, Cambridge)"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
              />
              <input
                value={form.year}
                onChange={(e) => updateForm('year', e.target.value)}
                placeholder="Year (optional)"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
              />

              <div className="pt-1">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-lg py-2.5 text-sm text-gray-500 disabled:opacity-60"
                >
                  <Upload size={15} />
                  {uploading ? 'Uploading…' : uploadedFile ? uploadedFile : 'Upload file from this device'}
                </button>
                <input ref={fileInputRef} type="file" onChange={handleFileChange} className="hidden" />
                <p className="text-[11px] text-gray-400 mt-1">or paste a link below instead</p>
              </div>

              <input
                value={form.file_url}
                onChange={(e) => updateForm('file_url', e.target.value)}
                placeholder="Link to file (optional if you uploaded one above)"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
              />
              {error ? <p className="text-red-500 text-xs">{error}</p> : null}
              <button
                onClick={handleAdd}
                disabled={saving || uploading}
                className="w-full bg-brand-purple text-white font-medium py-2.5 rounded-lg text-sm disabled:opacity-60"
              >
                {saving ? 'Adding…' : 'Add Resource'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500"
            >
              <Plus size={16} /> Add a Resource
            </button>
          )}
        </div>
      ) : null}

      <div className="screen-scroll px-4">
        {loading ? (
          <p className="text-center text-gray-400 mt-8">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-400 mt-8">
            {resources.length === 0 ? 'No resources added yet.' : 'No matches for your search.'}
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map((r) => (
              <div key={r.id} className="py-3.5 flex items-start gap-3">
                <span className="w-9 h-9 rounded-full bg-brand-light flex items-center justify-center shrink-0">
                  <BookOpen size={16} className="text-brand-purple" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm">{r.title}</p>
                  <p className="text-xs text-gray-400">
                    {[r.author, r.language, r.country, r.exam_board, r.year].filter(Boolean).join(' · ')}
                  </p>
                  {r.file_url ? (
                    <a href={r.file_url} target="_blank" rel="noreferrer" className="text-xs text-brand-purple">
                      Open resource
                    </a>
                  ) : null}
                </div>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-50 text-gray-500 shrink-0">
                  {r.category}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
    }
