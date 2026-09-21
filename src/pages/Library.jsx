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
  }, [query, category])

  async function searchExternal(q) {
    setSearchingExternal(true)
    try {
      let searchQ = q
      if (category === 'Shona') searchQ = `${q} shona`
      if (category === 'Ndebele') searchQ = `${q} ndebele`
      if (category === 'Zimsec') searchQ = `${q} zimsec past paper`
      if (category === 'Cambridge') searchQ = `${q} cambridge igcse`
      if (category === 'Past Paper') searchQ = `${q} past paper pdf`

      const results = []

      // 1. Internet Archive - fetch real pdf filename to prevent 404
      try {
        const iaSearch = await fetch(
          `https://archive.org/advancedsearch.php?q=${encodeURIComponent(searchQ)}+AND+mediatype:texts&fl[]=identifier,title,creator,year&sort[]=downloads+desc&rows=10&page=1&output=json`
        ).then(r => r.json())
        const docs = iaSearch.response?.docs || []
        for (const doc of docs.slice(0, 6)) {
          try {
            const meta = await fetch(`https://archive.org/metadata/${doc.identifier}`).then(r => r.json())
            const pdfFile = meta.files?.find(f => f.name.toLowerCase().endsWith('.pdf') && f.size > 10000)
            if (pdfFile) {
              results.push({
                title: doc.title,
                author: doc.creator || 'Unknown',
                year: doc.year || '',
                cover: `https://archive.org/services/img/${doc.identifier}`,
                file_url: `https://archive.org/download/${doc.identifier}/${encodeURIComponent(pdfFile.name)}`,
                source: 'Archive.org'
              })
            }
          } catch {}
        }
      } catch {}

      // 2. Gutenberg - always works, no login
      try {
        const gutRes = await fetch(`https://gutendex.com/books/?search=${encodeURIComponent(searchQ)}`).then(r => r.json()).catch(()=>null)
        if (gutRes?.results) {
          gutRes.results.slice(0, 4).forEach(b => {
            const pdf = b.formats['application/pdf'] || b.formats['text/html; charset=utf-8'] || b.formats['text/html']
            if (pdf) results.push({
              title: b.title,
              author: b.authors?.[0]?.name || 'Unknown',
              cover: b.formats['image/jpeg'],
              file_url: pdf,
              year: '',
              source: 'Gutenberg'
            })
          })
        }
      } catch {}

      // 3. Open Library with fulltext - also via archive direct pdf
      try {
        const olRes = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(searchQ)}&has_fulltext=true&limit=6`).then(r=>r.json())
        for (const d of (olRes.docs || [])) {
          if (d.ia && d.ia[0]) {
            try {
              const meta = await fetch(`https://archive.org/metadata/${d.ia[0]}`).then(r=>r.json())
              const pdfFile = meta.files?.find(f=>f.name.toLowerCase().endsWith('.pdf'))
              if (pdfFile) {
                results.push({
                  title: d.title,
                  author: d.author_name?.[0] || 'Unknown',
                  year: d.first_publish_year || '',
                  cover: d.cover_i? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : null,
                  file_url: `https://archive.org/download/${d.ia[0]}/${encodeURIComponent(pdfFile.name)}`,
                  source: 'Open Library'
                })
              }
            } catch {}
          }
        }
      } catch {}

      // dedupe
      const seen = new Set()
      const unique = []
      for (const b of results) {
        const key = b.title.toLowerCase()
        if (!seen.has(key)) { seen.add(key); unique.push(b) }
      }
      setExternalResults(unique.slice(0, 15))
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
    if (!form.title.trim()) return
    setSaving(true); setError('')
    const { error: insErr } = await supabase.from('library_resources').insert({...form, added_by: user.id })
    setSaving(false); if (insErr) { setError(insErr.message); return }
    setForm({ title: '', author: '', category: 'Novel', language: '', country: '', exam_board: '', year: '', file_url: '' })
    setUploadedFile(null); setShowAddForm(false); loadResources()
  }
  async function handleImportExternal(b) {
    if (!canManageLibrary(profile)) return
    setSaving(true)
    await supabase.from('library_resources').insert({ title: b.title, author: b.author, category: category === 'All'? 'Textbook' : category, file_url: b.file_url, added_by: user.id, year: b.year?.toString() || '' })
    setSaving(false); loadResources()
  }
  async function handleDelete(id, added_by) {
    if (added_by!== user.id &&!canManageLibrary(profile)) return
    if (!confirm('Delete this resource?')) return
    await supabase.from('library_resources').delete().eq('id', id); loadResources()
  }
  function handleShare(r) { if (navigator.share) navigator.share({ title: r.title, url: r.file_url }); else { navigator.clipboard.writeText(r.file_url); alert('Link copied!') } }

  const filtered = resources.filter(r => {
    const matchCat = category === 'All' || r.category === category || r.language?.toLowerCase().includes(category.toLowerCase()) || r.exam_board?.toLowerCase().includes(category.toLowerCase())
    const q = query.toLowerCase().trim()
    const matchQ =!q || r.title?.toLowerCase().includes(q) || r.author?.toLowerCase().includes(q) || r.language?.toLowerCase().includes(q) || r.exam_board?.toLowerCase().includes(q)
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
              <div className="flex items-center justify-between"><p className="font-semibold text-sm text-foreground">Add Resource</p><button onClick={() => setShowAddForm(false)}><X size={16} className="text-muted-foreground" /></button></div>
              <input value={form.title} onChange={e => updateForm('title', e.target.value)} placeholder="Title" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-brand-purple" />
              <input value={form.author} onChange={e => updateForm('author', e.target.value)} placeholder="Author" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-brand-purple" />
              <select value={form.category} onChange={e => updateForm('category', e.target.value)} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"><option>Novel</option><option>Textbook</option><option>Past Paper</option></select>
              <div className="grid grid-cols-2 gap-2">
                <input value={form.language} onChange={e => updateForm('language', e.target.value)} placeholder="Language" className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground" />
                <input value={form.exam_board} onChange={e => updateForm('exam_board', e.target.value)} placeholder="Zimsec/Cambridge" className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground" />
              </div>
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="w-full flex items-center justify-center gap-2 border border-dashed border-border rounded-lg py-2.5 text-sm text-muted-foreground"><Upload size={15} />{uploading? 'Uploading…' : uploadedFile? uploadedFile : 'Upload file'}</button>
              <input ref={fileInputRef} type="file" onChange={handleFileChange} className="hidden" />
              <input value={form.file_url} onChange={e => updateForm('file_url', e.target.value)} placeholder="Or paste link" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground" />
              {error && <p className="text-destructive text-xs">{error}</p>}
              <button onClick={handleAdd} disabled={saving || uploading} className="w-full bg-brand-purple text-white font-medium py-2.5 rounded-lg text-sm">{saving? 'Adding…' : 'Add Resource'}</button>
            </div>
          ) : (
            <button onClick={() => setShowAddForm(true)} className="w-full flex items-center justify-center gap-2 border border-dashed border-border rounded-xl py-3 text-sm text-muted-foreground"><Plus size={16} /> Add a Resource</button>
          )}
        </div>
      )}

      <div className="screen-scroll px-4 pb-10 space-y-3">
        {loading? <p className="text-center text-muted-foreground text-xs mt-6">Loading...</p> : filtered.map(r => (
          <div key={r.id} className="bg-card border border-border/50 rounded-xl p-3 flex gap-3">
            <span className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center shrink-0"><BookOpen size={18} className="text-muted-foreground" /></span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm text-foreground leading-tight">{r.title}</p>
              <p className="text-xs text-muted-foreground">{[r.author, r.year].filter(Boolean).join(' • ')}</p>
              <div className="flex gap-2 mt-2.5">
                <a href={r.file_url} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-full bg-muted text-xs text-muted-foreground flex items-center gap-1"><Download size={12} />Open</a>
                <button onClick={() => handleShare(r)} className="px-3 py-1.5 rounded-full bg-muted text-xs text-muted-foreground flex items-center gap-1"><Share2 size={12} />Share</button>
                {(r.added_by === user?.id || canManageLibrary(profile)) && <button onClick={() => handleDelete(r.id, r.added_by)} className="px-3 py-1.5 rounded-full bg-muted text-xs text-destructive flex items-center gap-1"><Trash2 size={12} />Delete</button>}
              </div>
            </div>
          </div>
        ))}

        {query.trim().length >= 2 && (
          <div className="pt-2">
            <p className="text-sm font-semibold text-foreground">Online Results for {query}</p>
            <p className="text-xs text-muted-foreground mb-3">Direct open - no sign in</p>
            <div className="space-y-3">
              {externalResults.map((book, i) => (
                <div key={i} className="bg-card border border-border/50 rounded-xl p-3 flex gap-3">
                  <div className="relative shrink-0">
                    <img
                      src={book.cover || placeholder}
                      onError={(e) => { e.currentTarget.src = placeholder }}
                      alt=""
                      className="w-12 h-16 object-cover rounded-lg bg-muted"
                    />
                    <span className="absolute -top-1.5 -right-1.5 text-[7px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">PDF</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-foreground leading-tight line-clamp-2">{book.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{book.author} {book.year? `• ${book.year}` : ''} • {book.source}</p>
                    <div className="flex gap-2 mt-2.5 flex-wrap">
                      <a href={book.file_url} target="_blank" rel="noreferrer" className="px-3 py-1 rounded-full bg-brand-purple text-white text-[11px] font-medium">Open Book</a>
                      <button onClick={() => handleShare(book)} className="text-[11px] text-muted-foreground flex items-center gap-1"><Share2 size={10} />Share</button>
                      {canManageLibrary(profile) && <button onClick={() => handleImportExternal(book)} className="text-[11px] text-brand-purple font-medium">Save to Library</button>}
                    </div>
                  </div>
                </div>
              ))}
              {searchingExternal && <p className="text-center text-xs text-muted-foreground py-2">Searching Shona, Ndebele, Zimsec, Cambridge…</p>}
              {!searchingExternal && externalResults.length === 0 && <p className="text-center text-xs text-muted-foreground py-3">No free PDF found - teachers can upload it via Add a Resource</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
  }
