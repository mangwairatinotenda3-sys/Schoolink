import { useEffect, useRef, useState } from 'react'
import { Search, Plus, X, BookOpen, Upload, Download, Eye } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { canManageLibrary } from '../lib/permissions.js'

const categories = ['All', 'Novel', 'Textbook', 'Past Paper', 'Shona', 'Ndebele', 'English', 'Zimsec', 'Cambridge']

export default function Library() {
  const { user, profile } = useAuth()
  const fileInputRef = useRef(null)
  const searchTimeoutRef = useRef(null)
  const lastQueryRef = useRef('')

  const [resources, setResources] = useState([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [externalResults, setExternalResults] = useState([])
  const [searchingExternal, setSearchingExternal] = useState(false)
  const [viewerUrl, setViewerUrl] = useState(null)
  const [viewerTitle, setViewerTitle] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [form, setForm] = useState({ title: '', author: '', category: 'Novel', file_url: '' })
  const [uploadedFile, setUploadedFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { loadResources() }, [])

  // FIXED SEARCH - no disappearing
  useEffect(() => {
    const q = query.trim()
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)

    if (q.length < 2) {
      setExternalResults([])
      setSearchingExternal(false)
      return
    }

    lastQueryRef.current = q
    setSearchingExternal(true)

    searchTimeoutRef.current = setTimeout(async () => {
      const currentQ = lastQueryRef.current
      try {
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://unopasa.com/search?q=${encodeURIComponent(currentQ)}`)}`
        const html = await fetch(proxyUrl).then(r => r.text())

        // Only update if query hasn't changed
        if (lastQueryRef.current!== currentQ) return

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
          const snippet = html.substring(m.index, m.index + 600)
          const year = snippet.match(/20\d{2}/)?.[0] || ""
          results.push({
            id, title,
            meta: `ZIMSEC • ${year}`,
            year,
            file_url: `https://unopasa.com/legacy/${id}`,
          })
        }

        if (lastQueryRef.current === currentQ) {
          setExternalResults(results)
        }
      } catch (e) {
        console.log(e)
      } finally {
        if (lastQueryRef.current === currentQ) {
          setSearchingExternal(false)
        }
      }
    }, 600)

    return () => clearTimeout(searchTimeoutRef.current)
  }, [query])

  async function loadResources() {
    const { data } = await supabase.from('library_resources').select('*').order('created_at', { ascending: false })
    setResources(data?? [])
  }

  function openViewer(book) {
    setViewerTitle(book.title)
    setViewerUrl(book.file_url)
  }

  const filtered = resources.filter(r => {
    if (category!== 'All' && r.category!== category) return false
    if (!query.trim()) return true
    return r.title?.toLowerCase().includes(query.toLowerCase())
  })

  return (
    <div className="flex-1 flex flex-col bg-background min-h-screen">
      <BackHeader title="Library" />

      {viewerUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex flex-col">
          <div className="flex items-center justify-between p-3 bg-card">
            <p className="text-sm font-semibold truncate pr-2">{viewerTitle}</p>
            <button onClick={() => setViewerUrl(null)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><X size={16} /></button>
          </div>
          <iframe src={viewerUrl} className="flex-1 w-full bg-white" title="Viewer" />
          <div className="p-2 bg-card flex justify-center">
            <a href={viewerUrl} target="_blank" rel="noreferrer" className="px-4 py-2 rounded-full bg-brand-purple text-white text-xs flex items-center gap-1"><Download size={12} />Open in new tab / Download</a>
          </div>
        </div>
      )}

      <div className="px-4 pt-2">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search Geography, Maths..." className="w-full bg-card border rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none" />
        </div>
        <div className="flex gap-2 overflow-x-auto mt-3 pb-1 flex-wrap">
          {categories.map(c => (
            <button key={c} onClick={() => setCategory(c)} className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs border ${category === c? 'bg-muted border-border' : 'bg-card border-transparent text-muted-foreground'}`}>{c}</button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-20 space-y-3 mt-3">
        {query.trim().length < 2 && filtered.map(r => (
          <div key={r.id} className="bg-card border rounded-xl p-3 flex gap-3">
            <span className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center"><BookOpen size={18} /></span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{r.title}</p>
              <button onClick={() => openViewer({ title: r.title, file_url: r.file_url })} className="mt-2 px-3 py-1.5 rounded-full bg-brand-purple text-white text-xs flex items-center gap-1"><Eye size={12} />View</button>
            </div>
          </div>
        ))}

        {query.trim().length >= 2 && (
          <div>
            <p className="text-sm font-semibold mb-2">Online Results for {query} {searchingExternal && <span className="text-xs font-normal text-muted-foreground">Searching...</span>}</p>
            <div className="space-y-3">
              {externalResults.map((book, i) => (
                <div key={book.id + i} className="bg-card border rounded-xl p-3 flex gap-3">
                  <span className="w-11 h-11 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center text-[8px] font-bold shrink-0">ZIMSEC</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm line-clamp-2">{book.title}</p>
                    <p className="text-[11px] text-muted-foreground">{book.meta}</p>
                    <button onClick={() => openViewer(book)} className="mt-2 px-4 py-1.5 rounded-full bg-brand-purple text-white text-xs">View Book</button>
                  </div>
                </div>
              ))}
              {!searchingExternal && externalResults.length === 0 && (
                <p className="text-center text-xs text-muted-foreground py-8">No results. Try Geography, Mathematics, Combined Science</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
        }
