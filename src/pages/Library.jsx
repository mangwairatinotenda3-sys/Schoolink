import { useEffect, useRef, useState } from 'react'
import { Search, Plus, X, BookOpen, Upload, Download, Share2, Eye } from 'lucide-react'
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
  const [viewerUrl, setViewerUrl] = useState(null)
  const [viewerTitle, setViewerTitle] = useState('')

  useEffect(() => { loadResources() }, [])
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setExternalResults([]); return }
    const t = setTimeout(() => searchExternal(q), 400)
    return () => clearTimeout(t)
  }, [query])

  async function searchExternal(q) {
    setSearchingExternal(true)
    let results = []

    // 1. Try your edge function first (if deployed)
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      if (supabaseUrl) {
        const res = await fetch(`${supabaseUrl}/functions/v1/unopasa-search?q=${encodeURIComponent(q)}`, {
          headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` }
        }).then(r => r.json())
        if (Array.isArray(res) && res.length > 0) results = res
      }
    } catch {}

    // 2. If edge failed, scrape Unopasa directly with CORS proxy - THIS WILL WORK NOW
    if (results.length === 0) {
      try {
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://unopasa.com/search?q=${encodeURIComponent(q)}`)}`
        const html = await fetch(proxyUrl).then(r => r.text())
        const seen = new Set()
        const re = /href="\/legacy\/([a-z0-9]+)"[^>]*>([\s\S]*?)<\/a>/gi
        let m
        while ((m = re.exec(html))!== null && results.length < 50) {
          const id = m[1]
          if (seen.has(id)) continue
          seen.add(id)
          const title = m[2].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()
          if (title.length < 8) continue
          const snippet = html.substring(m.index, m.index + 600)
          const year = snippet.match(/20\d{2}/)?.[0] || ""
          results.push({
            id,
            title,
            meta: `ZIMSEC • ${year}`,
            year,
            file_url: `https://unopasa.com/legacy/${id}`,
            source: "Unopasa"
          })
        }
      } catch (e) {
        console.log("proxy failed", e)
      }
    }

    setExternalResults(results)
    setSearchingExternal(false)
  }

  function openViewer(book) {
    setViewerTitle(book.title)
    setViewerUrl(book.file_url)
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
    setUploading(true)
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${user.id}/${Date.now()}-${safeName}`
    const { error: upErr } = await supabase.storage.from('library-files').upload(path, file)
    if (upErr) { setError(upErr.message); setUploading(false); return }
    const { data } = supabase.storage.from('library-files').getPublicUrl(path)
    setUploadedFile(file.name); updateForm('file_url', data.publicUrl); setUploading(false)
  }
  async function handleAdd() {
    if (!form.title.trim() ||!form.file_url.trim()) { setError('Title and file required'); return }
    setSaving(true)
    const { error: insErr } = await supabase.from('library_resources').insert({...form, added_by: user.id })
    setSaving(false); if (insErr) { setError(insErr.message); return }
    setForm({ title: '', author: '', category: 'Novel', language: '', country: '', exam_board: '', year: '', file_url: '' })
    setUploadedFile(null); setShowAddForm(false); loadResources()
  }

  const filtered = resources.filter(r => {
    const matchCat = category === 'All' || r.category === category
    const q = query.toLowerCase().trim()
    return matchCat && (!q || r.title?.toLowerCase().includes(q))
  })

  return (
    <div className="flex-1 flex flex-col bg-background min-h-screen">
      <BackHeader title="Library" />

      {viewerUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex flex-col">
          <div className="flex items-center justify-between p-3 bg-card">
            <p className="text-sm font-semibold truncate pr-2">{viewerTitle}</p>
            <div className="flex gap-2">
              <a href={viewerUrl} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-full bg-muted text-xs flex items-center gap-1"><Download size={12} />Download</a>
              <button onClick={() => setViewerUrl(null)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><X size={16} /></button>
            </div>
          </div>
          <iframe src={viewerUrl} className="flex-1 w-full bg-white" title="PDF Viewer" />
        </div>
      )}

      <div className="px-4 pt-2 pb-2">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search Geography, Maths..." className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none" />
        </div>
        <div className="flex gap-2 overflow-x-auto mt-3 pb-1 flex-wrap">
          {categories.map(c => (
            <button key={c} onClick={() => setCategory(c)} className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs border ${category === c? 'bg-muted border-border' : 'bg-card border-transparent text-muted-foreground'}`}>{c} {category === c && '✓'}</button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-20 space-y-3">
        {filtered.map(r => (
          <div key={r.id} className="bg-card border rounded-xl p-3 flex gap-3">
            <span className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center shrink-0"><BookOpen size={18} /></span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm">{r.title}</p>
              <p className="text-xs text-muted-foreground">{[r.author, r.year].filter(Boolean).join(' • ')}</p>
              <button onClick={() => openViewer({ title: r.title, file_url: r.file_url })} className="mt-2 px-3 py-1.5 rounded-full bg-brand-purple text-white text-xs flex items-center gap-1"><Eye size={12} />View</button>
            </div>
          </div>
        ))}

        {query.trim().length >= 2 && (
          <div className="pt-4">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">Online Results for {query}</p>
              {searchingExternal && <span className="text-xs text-muted-foreground">Searching...</span>}
            </div>
            <div className="space-y-3 mt-3">
              {externalResults.map((book, i) => (
                <div key={i} className="bg-card border rounded-xl p-3 flex gap-3">
                  <span className="w-11 h-11 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 text-[9px] font-bold">ZIMSEC</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm line-clamp-2">{book.title}</p>
                    <p className="text-[11px] text-muted-foreground">{book.meta}</p>
                    <div className="flex gap-2 mt-2.5">
                      <button onClick={() => openViewer(book)} className="px-4 py-1.5 rounded-full bg-brand-purple text-white text-xs flex items-center gap-1"><Eye size={12} />View</button>
                      <a href={book.file_url} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-full bg-muted text-xs">Open</a>
                    </div>
                  </div>
                </div>
              ))}
              {!searchingExternal && externalResults.length === 0 && <p className="text-center text-xs text-muted-foreground py-6">No results for {query} - try Maths, Science, Geography</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
    }
