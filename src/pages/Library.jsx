import { useEffect, useRef, useState } from 'react'
import { Search, Plus, X, BookOpen, Upload, Download, Share2, Trash2 } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { canManageLibrary } from '../lib/permissions.js'

const categories = ['All', 'Novel', 'Textbook', 'Past Paper', 'Shona', 'Ndebele', 'English', 'Zimsec', 'Cambridge']

export default function Library() {
  const { user, profile } = useAuth()
  const fileInputRef = useRef(null)
  const [resources, setResources] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [showAddForm, setShowAddForm] = useState(false)
  const [form, setForm] = useState({ title: '', author: '', category: 'Novel', language: '', country: '', exam_board: '', year: '', file_url: '' })
  const [uploadedFile, setUploadedFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [externalResults, setExternalResults] = useState([])
  const [searchingExternal, setSearchingExternal] = useState(false)

  useEffect(() => { loadResources() }, [])
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setExternalResults([]); return }
    const t = setTimeout(() => searchExternal(q), 600)
    return () => clearTimeout(t)
  }, [query])

  // Uses Unopasa scraper - never 404
  async function searchExternal(q) {
    setSearchingExternal(true)
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      let results = []

      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/unopasa-search?q=${encodeURIComponent(q)}`, {
          headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` }
        }).then(r => r.json())
        if (Array.isArray(res) && res.length > 0) {
          results = res
        }
      } catch (e) {
        console.log('scraper not deployed yet', e)
      }

      if (results.length === 0) {
        results = [{
          title: `${q} - View on Unopasa (3515 ZIMSEC papers)`,
          meta: 'Zimbabwe / ZIMSEC / O-Level / A-Level',
          year: '',
          file_url: `https://unopasa.com/search?q=${encodeURIComponent(q)}`,
          source: 'Unopasa'
        }]
      }

      setExternalResults(results.map(r => ({
        title: r.title,
        author: r.meta || r.author || 'ZIMSEC',
        year: r.year || '',
        cover: null,
        file_url: r.file_url,
        source: r.source || 'Unopasa'
      })))
    } catch {}
    setSearchingExternal(false)
  }

  async function loadResources() {
    setLoading(true)
    const { data } = await supabase.from('library_resources').select('*').order('created_at', { ascending: false })
    setResources(data?? [])
    setLoading(false)
  }
  function updateForm(k, v) { setForm(f => ({...f, [k]: v })) }
  async function handleFileChange(e) {
    const file = e.target.files?.[0]; if (!file ||!user) return
    setUploading(true); setError('')
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${user.id}/${Date.now()}-${safeName}`
    const { error: upErr } = await supabase.storage.from('library-files').upload(path, file)
    if (upErr) { setError(upErr.message); setUploading(false); return }
    const { data } = supabase.storage.from('library-files').getPublicUrl(path)
    setUploadedFile(file.name); updateForm('file_url', data.publicUrl); setUploading(false)
  }
  async function handleAdd() {
    if (!form.title.trim() ||!form.file_url.trim()) { setError('Title and file required'); return }
    setSaving(true); setError('')
    const { error: insErr } = await supabase.from('library_resources').insert({...form, added_by: user.id })
    setSaving(false); if (insErr) { setError(insErr.message); return }
    setForm({ title: '', author: '', category: 'Novel', language: '', country: '', exam_board: '', year: '', file_url: '' })
    setUploadedFile(null); setShowAddForm(false); loadResources()
  }
  async function handleDelete(id, added_by) {
    if (added_by!== user.id &&!canManageLibrary(profile)) return
    if (!confirm('Delete this resource?')) return
    await supabase.from('library_resources').delete().eq('id', id); loadResources()
  }
  function handleShare(r) { if (navigator.share) navigator.share({ title: r.title, url: r.file_url }); else { navigator.clipboard.writeText(r.file_url); alert('Link copied!') } }

  const filtered = resources.filter(r => {
    const matchCat = category === 'All' || r.category === category
    const q = query.toLowerCase().trim()
    const matchQ =!q || r.title?.toLowerCase().includes(q) || r.author?.toLowerCase().includes(q)
    return matchCat && matchQ
  })

  const placeholder = "https://via.placeholder.com/48x64/6b7280/ffffff?text=B"

  return (
    <div className="flex-1 flex flex-col bg-background">
      <BackHeader title="Library" />
      <div className="px-4 pt-2 pb-2">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search Shona, Ndebele, Zimsec, Cambridge..." className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground outline-none focus:border-brand-purple" />
        </div>
        <div className="flex gap-2 overflow-x-auto mt-3 pb-1 scrollbar-hide flex-wrap">
          {categories.map(c => (
            <button key={c} onClick={() => setCategory(c)} className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium border transition ${category === c? 'bg-muted text-foreground border-border' : 'bg-card border-transparent text-muted-foreground'}`}>{c} {category === c && '✓'}</button>
          ))}
        </div>
      </div>

      {canManageLibrary(profile) && (
        <div className="px-4 pb-2 mt-1">
          {showAddForm? (
            <div className="border border-border rounded-xl p-4 space-y-2 bg-card">
              <div className="flex items-center justify-between"><p className="font-semibold text-sm">Add Resource</p><button onClick={() => setShowAddForm(false)}><X size={16}/></button></div>
              <input value={form.title} onChange={e => updateForm('title', e.target.value)} placeholder="Title *" className="w-full bg-background border rounded-lg px-3 py-2 text-sm" />
              <input value={form.author} onChange={e => updateForm('author', e.target.value)} placeholder="Author" className="w-full bg-background border rounded-lg px-3 py-2 text-sm" />
              <select value={form.category} onChange={e => updateForm('category', e.target.value)} className="w-full bg-background border rounded-lg px-3 py-2 text-sm"><option>Novel</option><option>Textbook</option><option>Past Paper</option></select>
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="w-full flex items-center justify-center gap-2 border border-dashed rounded-lg py-2.5 text-sm"><Upload size={15}/>{uploading?'Uploading…':uploadedFile?uploadedFile:'Upload file *'}</button>
              <input ref={fileInputRef} type="file" onChange={handleFileChange} className="hidden" />
              <input value={form.file_url} onChange={e => updateForm('file_url', e.target.value)} placeholder="File link" className="w-full bg-background border rounded-lg px-3 py-2 text-sm" />
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <button onClick={handleAdd} disabled={saving||uploading} className="w-full bg-brand-purple text-white py-2.5 rounded-lg text-sm">{saving?'Adding…':'Add Resource'}</button>
            </div>
          ) : (
            <button onClick={() => setShowAddForm(true)} className="w-full flex items-center justify-center gap-2 border border-dashed rounded-xl py-3 text-sm"><Plus size={16}/> Add a Resource</button>
          )}
        </div>
      )}

      <div className="px-4 pb-10 space-y-3">
        {loading? <p className="text-center text-xs mt-6">Loading...</p> : filtered.map(r => (
          <div key={r.id} className="bg-card border rounded-xl p-3 flex gap-3">
            <span className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center shrink-0"><BookOpen size={18}/></span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm leading-tight">{r.title}</p>
              <p className="text-xs text-muted-foreground">{[r.author, r.year].filter(Boolean).join(' • ')}</p>
              <div className="flex gap-2 mt-2.5">
                <a href={r.file_url} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-full bg-muted text-xs flex items-center gap-1"><Download size={12}/>Open</a>
                <button onClick={() => handleShare(r)} className="px-3 py-1.5 rounded-full bg-muted text-xs flex items-center gap-1"><Share2 size={12}/>Share</button>
              </div>
            </div>
          </div>
        ))}

        {query.trim().length >= 2 && (
          <div className="pt-2">
            <p className="text-sm font-semibold">Online Results for {query}</p>
            <p className="text-xs text-muted-foreground mb-3">Unopasa links - no 404</p>
            <div className="space-y-3">
              {externalResults.map((book, i) => (
                <div key={i} className="bg-card border rounded-xl p-3 flex gap-3">
                  <img src={book.cover || placeholder} alt="" className="w-12 h-16 object-cover rounded-lg bg-muted shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm line-clamp-2">{book.title}</p>
                    <p className="text-[11px] text-muted-foreground">{book.author} • {book.source}</p>
                    <div className="flex gap-2 mt-2.5">
                      <a href={book.file_url} target="_blank" rel="noreferrer" className="px-3 py-1 rounded-full bg-brand-purple text-white text-[11px]">Open Book</a>
                    </div>
                  </div>
                </div>
              ))}
              {searchingExternal && <p className="text-center text-xs py-2">Searching Unopasa...</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
    }
