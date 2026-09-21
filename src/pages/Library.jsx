import { useEffect, useRef, useState } from 'react'
import { Search, Plus, X, BookOpen, Upload, Download, Share2, Trash2, Globe, BookmarkPlus } from 'lucide-react'
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

  // NEW: external search
  const [externalResults, setExternalResults] = useState([])
  const [searchingExternal, setSearchingExternal] = useState(false)

  useEffect(() => {
    loadResources()
  }, [])

  // NEW: live external search with debounce (like UNOPASA)
  useEffect(() => {
    const q = query.trim()
    if (q.length < 3) {
      setExternalResults([])
      return
    }
    const timer = setTimeout(() => searchExternal(q), 500)
    return () => clearTimeout(timer)
  }, [query])

  async function searchExternal(q) {
    setSearchingExternal(true)
    try {
      // Google Books + Open Library parallel
      const [googleRes, openRes] = await Promise.all([
        fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=8`).then(r => r.json()),
        fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=8`).then(r => r.json())
      ])

      let books = []

      if (googleRes.items) {
        books = books.concat(googleRes.items.map(item => ({
          source: 'google',
          id: item.id,
          title: item.volumeInfo.title,
          author: item.volumeInfo.authors?.join(', ') || 'Unknown',
          cover: item.volumeInfo.imageLinks?.thumbnail,
          file_url: item.volumeInfo.previewLink || item.volumeInfo.infoLink,
          language: item.volumeInfo.language || '',
          year: item.volumeInfo.publishedDate?.slice(0,4) || '',
        })))
      }

      if (openRes.docs) {
        books = books.concat(openRes.docs.slice(0,5).map(doc => ({
          source: 'openlibrary',
          id: doc.key,
          title: doc.title,
          author: doc.author_name?.[0] || 'Unknown',
          cover: doc.cover_i? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
          file_url: `https://openlibrary.org${doc.key}`,
          language: doc.language?.[0] || '',
          year: doc.first_publish_year || '',
        })))
      }

      setExternalResults(books)
    } catch (e) {
      console.log(e)
    }
    setSearchingExternal(false)
  }

  async function loadResources() {
    setLoading(true)
    const { data } = await supabase
     .from('library_resources')
     .select('*')
     .order('created_at', { ascending: false })
    setResources(data?? [])
    setLoading(false)
  }

  function updateForm(key, value) {
    setForm((f) => ({...f, [key]: value }))
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file ||!user) return
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

  // NEW: add external book to your DB (only for librarians)
  async function handleImportExternal(book) {
    if (!canManageLibrary(profile)) return
    setSaving(true)
    const { error } = await supabase.from('library_resources').insert({
      title: book.title,
      author: book.author,
      category: 'Textbook',
      language: book.language || '',
      year: book.year?.toString() || '',
      file_url: book.file_url,
      added_by: user.id,
    })
    setSaving(false)
    if (!error) loadResources()
  }

  // NEW: actions
  async function handleDelete(id, added_by) {
    if (added_by!== user.id &&!canManageLibrary(profile)) return
    if (!confirm('Delete this resource?')) return
    await supabase.from('library_resources').delete().eq('id', id)
    loadResources()
  }

  function handleShare(resource) {
    if (navigator.share) {
      navigator.share({ title: resource.title, url: resource.file_url })
    } else {
      navigator.clipboard.writeText(resource.file_url)
      alert('Link copied!')
    }
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
                category === c? 'bg-brand-purple text-white border-brand-purple' : 'border-gray-200 text-gray-600'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {canManageLibrary(profile)? (
        <div className="px-4 pb-2">
          {showAddForm? (
            <div className="border border-gray-100 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">Add Resource</p>
                <button onClick={() => setShowAddForm(false)}>
                  <X size={16} className="text-gray-400" />
                </button>
              </div>
              <input value={form.title} onChange={(e) => updateForm('title', e.target.value)} placeholder="Title" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple" />
              <input value={form.author} onChange={(e) => updateForm('author', e.target.value)} placeholder="Author (optional)" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple" />
              <select value={form.category} onChange={(e) => updateForm('category', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple">
                <option>Novel</option><option>Textbook</option><option>Past Paper</option>
              </select>
              <input value={form.language} onChange={(e) => updateForm('language', e.target.value)} placeholder="Language (e.g. Shona, English)" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple" />
              <input value={form.country} onChange={(e) => updateForm('country', e.target.value)} placeholder="Country (e.g. Zimbabwe, UK)" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple" />
              <input value={form.exam_board} onChange={(e) => updateForm('exam_board', e.target.value)} placeholder="Exam Board (e.g. Zimsec, Cambridge)" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple" />
              <input value={form.year} onChange={(e) => updateForm('year', e.target.value)} placeholder="Year (optional)" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple" />
              <div className="pt-1">
                <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-lg py-2.5 text-sm text-gray-500 disabled:opacity-60">
                  <Upload size={15} />{uploading? 'Uploading…' : uploadedFile? uploadedFile : 'Upload file from this device'}
                </button>
                <input ref={fileInputRef} type="file" onChange={handleFileChange} className="hidden" />
                <p className="text-[11px] text-gray-400 mt-1">or paste a link below instead</p>
              </div>
              <input value={form.file_url} onChange={(e) => updateForm('file_url', e.target.value)} placeholder="Link to file (optional if you uploaded one above)" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple" />
              {error? <p className="text-red-500 text-xs">{error}</p> : null}
              <button onClick={handleAdd} disabled={saving || uploading} className="w-full bg-brand-purple text-white font-medium py-2.5 rounded-lg text-sm disabled:opacity-60">
                {saving? 'Adding…' : 'Add Resource'}
              </button>
            </div>
          ) : (
            <button onClick={() => setShowAddForm(true)} className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500">
              <Plus size={16} /> Add a Resource
            </button>
          )}
        </div>
      ) : null}

      <div className="screen-scroll px-4">
        {loading? (
          <p className="text-center text-gray-400 mt-8">Loading…</p>
        ) : (
          <>
            {/* YOUR EXISTING RESOURCES */}
            {filtered.length > 0 && (
              <div className="divide-y divide-gray-100">
                {filtered.map((r) => (
                  <div key={r.id} className="py-3.5 flex items-start gap-3">
                    <span className="w-9 h-9 rounded-full bg-brand-light flex items-center justify-center shrink-0">
                      <BookOpen size={16} className="text-brand-purple" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm">{r.title}</p>
                      <p className="text-xs text-gray-400">{[r.author, r.language, r.country, r.exam_board, r.year].filter(Boolean).join(' · ')}</p>
                      <div className="flex gap-2 mt-1.5">
                        {r.file_url && <a href={r.file_url} target="_blank" rel="noreferrer" className="text-xs text-brand-purple flex items-center gap-1"><Download size={12}/>Open</a>}
                        {r.file_url && <button onClick={()=>handleShare(r)} className="text-xs text-gray-500 flex items-center gap-1"><Share2 size={12}/>Share</button>}
                        {(r.added_by === user?.id || canManageLibrary(profile)) && <button onClick={()=>handleDelete(r.id, r.added_by)} className="text-xs text-red-400 flex items-center gap-1"><Trash2 size={12}/>Delete</button>}
                      </div>
                    </div>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-50 text-gray-500 shrink-0">{r.category}</span>
                  </div>
                ))}
              </div>
            )}

            {/* NEW: EXTERNAL RESULTS LIKE UNOPASA */}
            {query.trim().length >= 3 && (
              <div className="mt-6">
                <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1"><Globe size={12}/> {searchingExternal? 'Searching online...' : `Online Results for "${query}" - not yet in your library`}</p>
                <div className="divide-y divide-gray-100">
                  {externalResults.map((book) => (
                    <div key={book.source + book.id} className="py-3.5 flex items-start gap-3 opacity-90">
                      <img src={book.cover || 'https://via.placeholder.com/40x60?text=No+Cover'} alt="" className="w-9 h-12 object-cover rounded shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm">{book.title}</p>
                        <p className="text-xs text-gray-400">{book.author} {book.year? `· ${book.year}` : ''} · via {book.source}</p>
                        <div className="flex gap-2 mt-1.5">
                          <a href={book.file_url} target="_blank" rel="noreferrer" className="text-xs text-brand-purple flex items-center gap-1"><Download size={12}/>Preview / Download</a>
                          <button onClick={()=>handleShare(book)} className="text-xs text-gray-500 flex items-center gap-1"><Share2 size={12}/>Share</button>
                          {canManageLibrary(profile) && (
                            <button onClick={()=>handleImportExternal(book)} disabled={saving} className="text-xs text-green-600 flex items-center gap-1 font-medium">
                              <BookmarkPlus size={12}/>{saving? 'Saving...' : 'Save to Library'}
                            </button>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 shrink-0">ONLINE</span>
                    </div>
                  ))}
                </div>
                {filtered.length === 0 && externalResults.length === 0 &&!searchingExternal && (
                  <p className="text-center text-gray-400 mt-4 text-sm">No matches online either. Try another keyword.</p>
                )}
              </div>
            )}

            {filtered.length === 0 && query.trim().length < 3 &&!loading && (
              <p className="text-center text-gray-400 mt-8">{resources.length === 0? 'No resources added yet.' : 'No matches for your search. Type 3+ letters to search online.'}</p>
            )}
          </>
        )}
      </div>
    </div>
  )
          }
