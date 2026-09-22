import { useEffect, useRef, useState } from 'react'
import { Search, Plus, X, BookOpen, Upload, Eye, Trash2 } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import DocumentViewer from '../components/DocumentViewer.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { canManageLibrary } from '../lib/permissions.js'

const categories = ['All', 'Novel', 'Textbook', 'Past Paper', 'Shona', 'Ndebele', 'English', 'Zimsec', 'Cambridge']

export default function Library() {
  const { user, profile } = useAuth()
  const fileInputRef = useRef(null)
  const lastQueryRef = useRef('')
  const [resources, setResources] = useState([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [externalResults, setExternalResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [viewer, setViewer] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [form, setForm] = useState({ title: '', author: '', category: 'Novel', language: '', country: '', exam_board: '', year: '', file_url: '' })
  const [uploadedFile, setUploadedFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadResources()
  }, [])

  async function loadResources() {
    const { data } = await supabase.from('library_resources').select('*').order('created_at', { ascending: false })
    setResources(data?? [])
  }

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setExternalResults([])
      setSearching(false)
      return
    }
    lastQueryRef.current = q
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const proxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://unopasa.com/search?q=${encodeURIComponent(q)}`)}`
        const html = await fetch(proxy).then(r => r.text())
        if (lastQueryRef.current!== q) return
        const results = []
        const seen = new Set()
        const re = /href="\/legacy\/([a-z0-9]+)"[^>]*>([\s\S]*?)<\/a>/gi
        let m
        while ((m = re.exec(html))!== null && results.length < 50) {
          const id = m[1]
          if (seen.has(id)) continue
          seen.add(id)
          const title = m[2].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()
          if (title.length < 8) continue
          const snippet = html.substring(m.index, m.index + 500)
          const year = snippet.match(/20\d{2}/)?.[0] || ""
          results.push({
            id,
            title,
            meta: `ZIMSEC • ${year}`,
            year,
            file_url: `https://unopasa.com/legacy/${id}`
          })
        }
        setExternalResults(results)
      } catch {
        setExternalResults([])
      } finally {
        setSearching(false)
      }
    }, 500)
    return () => clearTimeout(t)
  }, [query])

  function updateForm(k, v) { setForm(f => ({...f, [k]: v })) }

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file ||!user) return
    setUploading(true)
    setError('')
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${user.id}/${Date.now()}-${safeName}`
    const { error: upErr } = await supabase.storage.from('library-files').upload(path, file)
    if (upErr) { setError(upErr.message); setUploading(false); return }
    const { data } = supabase.storage.from('library-files').getPublicUrl(path)
    setUploadedFile(file.name)
    updateForm('file_url', data.publicUrl)
    setUploading(false)
  }

  async function handleAdd() {
    if (!form.title.trim() ||!form.file_url.trim()) { setError('Title and file required'); return }
    setSaving(true)
    setError('')
    const { error: insErr } = await supabase.from('library_resources').insert({...form, added_by: user.id })
    setSaving(false)
    if (insErr) { setError(insErr.message); return }
    setForm({ title: '', author: '', category: 'Novel', language: '', country: '', exam_board: '', year: '', file_url: '' })
    setUploadedFile(null)
    setShowAddForm(false)
    loadResources()
  }

  async function handleDelete(id, added_by) {
    if (added_by!== user.id &&!canManageLibrary(profile)) return
    if (!confirm('Delete this resource?')) return
    await supabase.from('library_resources').delete().eq('id', id)
    loadResources()
  }

  const filtered = resources.filter(r => {
    const matchCat = category === 'All' || r.category === category
    if (!query.trim()) return matchCat
    return matchCat && r.title?.toLowerCase().includes(query.toLowerCase())
  })

  return (
    <div className="flex-1 flex flex-col bg-background min-h-screen">
      <BackHeader title="Library" />

      {viewer && <DocumentViewer url={viewer.url} title={viewer.title} onClose={() => setViewer(null)} />}

      <div className="px-4 pt-2 pb-2">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search Geography, Maths, Shona..." className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-brand-purple" />
        </div>
        <div className="flex gap-2 overflow-x-auto mt-3 pb-1 flex-wrap scrollbar-hide">
          {categories.map(c => (
            <button key={c} onClick={() => setCategory(c)} className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium border transition ${category === c? 'bg-muted text-foreground border-border' : 'bg-card border-transparent text-muted-foreground'}`}>{c} {category === c && '✓'}</button>
          ))}
        </div>
      </div>

      {canManageLibrary(profile) && (
        <div className="px-4 pb-2 mt-1">
          {showAddForm? (
            <div className="border border-border rounded-xl p-4 space-y-2 bg-card">
              <div className="flex items-center justify-between"><p className="font-semibold text-sm">Add Resource</p><button onClick={() => setShowAddForm(false)}><X size={16} /></button></div>
              <input value={form.title} onChange={e => updateForm('title', e.target.value)} placeholder="Title *" className="w-full bg-background border rounded-lg px-3 py-2 text-sm" />
              <input value={form.author} onChange={e => updateForm('author', e.target.value)} placeholder="Author" className="w-full bg-background border rounded-lg px-3 py-2 text-sm" />
              <select value={form.category} onChange={e => updateForm('category', e.target.value)} className="w-full bg-background border rounded-lg px-3 py-2 text-sm"><option>Novel</option><option>Textbook</option><option>Past Paper</option></select>
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="w-full flex items-center justify-center gap-2 border border-dashed rounded-lg py-2.5 text-sm"><Upload size={15} />{uploading? 'Uploading…' : uploadedFile? uploadedFile : 'Upload file *'}</button>
              <input ref={fileInputRef} type="file" onChange={handleFileChange} className="hidden" />
              <input value={form.file_url} onChange={e => updateForm('file_url', e.target.value)} placeholder="File link" className="w-full bg-background border rounded-lg px-3 py-2 text-sm" />
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <button onClick={handleAdd} disabled={saving || uploading} className="w-full bg-brand-purple text-white py-2.5 rounded-lg text-sm">{saving? 'Adding…' : 'Add Resource'}</button>
            </div>
          ) : (
            <button onClick={() => setShowAddForm(true)} className="w-full flex items-center justify-center gap-2 border border-dashed rounded-xl py-3 text-sm"><Plus size={16} /> Add a Resource</button>
          )}
        </div>
      )}

      <div className="px-4 pb-20 space-y-3 mt-2">
        {query.trim().length < 2 && filtered.map(r => (
          <div key={r.id} className="bg-card border rounded-xl p-3 flex gap-3">
            <span className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center shrink-0"><BookOpen size={18} /></span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm leading-tight">{r.title}</p>
              <p className="text-xs text-muted-foreground">{[r.author, r.year].filter(Boolean).join(' • ')}</p>
              <div className="flex gap-2 mt-2.5">
                <button onClick={() => setViewer({ url: r.file_url, title: r.title })} className="px-3 py-1.5 rounded-full bg-brand-purple text-white text-xs flex items-center gap-1"><Eye size={12} />View</button>
                {canManageLibrary(profile) && <button onClick={() => handleDelete(r.id, r.added_by)} className="px-2 py-1.5 rounded-full bg-muted text-xs"><Trash2 size={12} /></button>}
              </div>
            </div>
          </div>
        ))}

        {query.trim().length >= 2 && (
          <div className="pt-2">
            <p className="text-sm font-semibold">Online Results {searching && <span className="text-xs font-normal text-muted-foreground">Searching...</span>}</p>
            <div className="space-y-3 mt-3">
              {externalResults.map((book, i) => (
                <div key={book.id + i} className="bg-card border rounded-xl p-3 flex gap-3">
                  <span className="w-11 h-11 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 text-[8px] font-bold">ZIMSEC</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm leading-tight line-clamp-2">{book.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{book.meta}</p>
                    <button onClick={() => setViewer({ url: book.file_url, title: book.title })} className="mt-2.5 px-4 py-1.5 rounded-full bg-brand-purple text-white text-xs font-medium">View Book</button>
                  </div>
                </div>
              ))}
              {!searching && externalResults.length === 0 && <p className="text-center text-xs text-muted-foreground py-8">No results for {query}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
      }
