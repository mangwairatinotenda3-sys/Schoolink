import { useEffect, useRef, useState } from 'react'
import { Search, Plus, X, BookOpen, Upload, Eye, Trash2, Download, Share2, Heart, Star } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import DocumentViewer from '../components/DocumentViewer.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { canManageLibrary } from '../lib/permissions.js'

const categories = ['All', 'Novel', 'Textbook', 'Past Paper', 'Shona', 'Ndebele', 'English', 'Zimsec', 'Cambridge']

function MiniStars({ average, myRating, count, onRate }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={(e) => { e.stopPropagation(); onRate(n) }}>
          <Star size={13} className={n <= Math.round(myRating || average) ? 'text-amber-400 fill-amber-400' : 'text-gray-300'} />
        </button>
      ))}
      {count > 0 ? <span className="text-[10px] text-muted-foreground ml-1">{average.toFixed(1)} ({count})</span> : null}
    </div>
  )
}

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
  const [likes, setLikes] = useState({})
  const [ratings, setRatings] = useState({})
  const [toast, setToast] = useState('')

  useEffect(() => {
    loadResources()
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2000)
    return () => clearTimeout(t)
  }, [toast])

  async function loadResources() {
    const { data } = await supabase.from('library_resources').select('*').order('created_at', { ascending: false })
    setResources(data ?? [])
    await loadEngagement((data ?? []).map((r) => r.id))
  }

  async function loadEngagement(ids) {
    if (!ids.length) { setLikes({}); setRatings({}); return }
    const [{ data: likeRows }, { data: ratingRows }] = await Promise.all([
      supabase.from('library_resource_likes').select('resource_id, user_id').in('resource_id', ids),
      supabase.from('library_resource_ratings').select('resource_id, user_id, rating').in('resource_id', ids),
    ])
    const likeMap = {}
    ;(likeRows ?? []).forEach((l) => {
      if (!likeMap[l.resource_id]) likeMap[l.resource_id] = { count: 0, likedByMe: false }
      likeMap[l.resource_id].count += 1
      if (l.user_id === user.id) likeMap[l.resource_id].likedByMe = true
    })
    const ratingMap = {}
    ;(ratingRows ?? []).forEach((r) => {
      if (!ratingMap[r.resource_id]) ratingMap[r.resource_id] = { sum: 0, count: 0, myRating: 0 }
      ratingMap[r.resource_id].sum += r.rating
      ratingMap[r.resource_id].count += 1
      if (r.user_id === user.id) ratingMap[r.resource_id].myRating = r.rating
    })
    setLikes(likeMap)
    setRatings(ratingMap)
  }

  async function toggleLike(resourceId) {
    const current = likes[resourceId]
    if (current?.likedByMe) {
      await supabase.from('library_resource_likes').delete().eq('resource_id', resourceId).eq('user_id', user.id)
      setLikes((prev) => ({ ...prev, [resourceId]: { count: Math.max(0, (prev[resourceId]?.count || 1) - 1), likedByMe: false } }))
    } else {
      await supabase.from('library_resource_likes').insert({ resource_id: resourceId, user_id: user.id })
      setLikes((prev) => ({ ...prev, [resourceId]: { count: (prev[resourceId]?.count || 0) + 1, likedByMe: true } }))
    }
  }

  async function rateResource(resourceId, rating) {
    await supabase.from('library_resource_ratings').upsert({ resource_id: resourceId, user_id: user.id, rating }, { onConflict: 'resource_id,user_id' })
    setRatings((prev) => {
      const existing = prev[resourceId] || { sum: 0, count: 0, myRating: 0 }
      const hadMine = existing.myRating > 0
      return { ...prev, [resourceId]: { sum: existing.sum - existing.myRating + rating, count: hadMine ? existing.count : existing.count + 1, myRating: rating } }
    })
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

  function shareItem(url, title) {
    if (navigator.share) {
      navigator.share({ title: title || 'Schoolink Library', url }).catch(() => {})
    } else {
      navigator.clipboard?.writeText(url)
      setToast('Link copied!')
    }
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
        const proxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://www.unopasa.com/search?q=${encodeURIComponent(q)}`)}`
        const html = await fetch(proxy).then(r => r.text())
        if (lastQueryRef.current !== q) return
        const results = []
        const seen = new Set()
        // Unopasa's real resource links look like:
        // /zimbabwe/o-level/mathematics/question-papers/zimsec-paper-2-november-2025-hodtemn
        // i.e. /<country>/<level>/<subject>/<type>/<slug> — five path segments.
        const re = /href="(\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+)"[^>]*>([\s\S]*?)<\/a>/gi
        let m
        while ((m = re.exec(html)) !== null && results.length < 50) {
          const path = m[1]
          if (seen.has(path)) continue
          seen.add(path)
          const title = m[2].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()
          if (title.length < 8) continue
          // Their own ?q= search doesn't reliably filter server-side, so filter
          // by title on our end against what the person actually typed.
          const qWords = q.toLowerCase().split(/\s+/).filter(Boolean)
          if (!qWords.every(w => title.toLowerCase().includes(w))) continue
          const year = title.match(/20\d{2}/)?.[0] || ""
          const parts = path.split('/').filter(Boolean)
          results.push({
            id: path,
            title,
            meta: `${parts[1] || ''} • ${year}`.trim(),
            year,
            file_url: `https://www.unopasa.com${path}`
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

  function updateForm(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file || !user) return
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
    if (!form.title.trim() || !form.file_url.trim()) { setError('Title and file required'); return }
    setSaving(true)
    setError('')
    const { error: insErr } = await supabase.from('library_resources').insert({ ...form, added_by: user.id })
    setSaving(false)
    if (insErr) { setError(insErr.message); return }
    setForm({ title: '', author: '', category: 'Novel', language: '', country: '', exam_board: '', year: '', file_url: '' })
    setUploadedFile(null)
    setShowAddForm(false)
    loadResources()
  }

  async function handleDelete(id, added_by) {
    if (added_by !== user.id && !canManageLibrary(profile)) return
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
            <button key={c} onClick={() => setCategory(c)} className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium border transition ${category === c ? 'bg-muted text-foreground border-border' : 'bg-card border-transparent text-muted-foreground'}`}>{c} {category === c && '✓'}</button>
          ))}
        </div>
      </div>

      {toast ? <p className="text-center text-xs text-brand-purple">{toast}</p> : null}

      {canManageLibrary(profile) && (
        <div className="px-4 pb-2 mt-1">
          {showAddForm ? (
            <div className="border border-border rounded-xl p-4 space-y-2 bg-card">
              <div className="flex items-center justify-between"><p className="font-semibold text-sm">Add Resource</p><button onClick={() => setShowAddForm(false)}><X size={16} /></button></div>
              <input value={form.title} onChange={e => updateForm('title', e.target.value)} placeholder="Title *" className="w-full bg-background border rounded-lg px-3 py-2 text-sm" />
              <input value={form.author} onChange={e => updateForm('author', e.target.value)} placeholder="Author" className="w-full bg-background border rounded-lg px-3 py-2 text-sm" />
              <select value={form.category} onChange={e => updateForm('category', e.target.value)} className="w-full bg-background border rounded-lg px-3 py-2 text-sm"><option>Novel</option><option>Textbook</option><option>Past Paper</option></select>
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="w-full flex items-center justify-center gap-2 border border-dashed rounded-lg py-2.5 text-sm"><Upload size={15} />{uploading ? 'Uploading…' : uploadedFile ? uploadedFile : 'Upload file *'}</button>
              <input ref={fileInputRef} type="file" onChange={handleFileChange} className="hidden" />
              <input value={form.file_url} onChange={e => updateForm('file_url', e.target.value)} placeholder="File link" className="w-full bg-background border rounded-lg px-3 py-2 text-sm" />
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <button onClick={handleAdd} disabled={saving || uploading} className="w-full bg-brand-purple text-white py-2.5 rounded-lg text-sm">{saving ? 'Adding…' : 'Add Resource'}</button>
            </div>
          ) : (
            <button onClick={() => setShowAddForm(true)} className="w-full flex items-center justify-center gap-2 border border-dashed rounded-xl py-3 text-sm"><Plus size={16} /> Add a Resource</button>
          )}
        </div>
      )}

      <div className="px-4 pb-20 space-y-3 mt-2">
        {query.trim().length < 2 && filtered.map(r => {
          const canDelete = r.added_by === user.id || canManageLibrary(profile)
          const rating = ratings[r.id] || { sum: 0, count: 0, myRating: 0 }
          const average = rating.count ? rating.sum / rating.count : 0
          return (
            <div key={r.id} className="bg-card border rounded-xl p-3">
              <div className="flex gap-3">
                <span className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center shrink-0"><BookOpen size={18} /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm leading-tight">{r.title}</p>
                  <p className="text-xs text-muted-foreground">{[r.author, r.year].filter(Boolean).join(' • ')}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-2.5">
                <button onClick={() => setViewer({ url: r.file_url, title: r.title })} className="px-3 py-1.5 rounded-full bg-brand-purple text-white text-xs flex items-center gap-1"><Eye size={12} />View</button>
                <button onClick={() => downloadItem(r.file_url, r.title)} className="px-3 py-1.5 rounded-full bg-muted text-xs flex items-center gap-1"><Download size={12} />Download</button>
                <button onClick={() => shareItem(r.file_url, r.title)} className="px-2 py-1.5 rounded-full bg-muted text-xs"><Share2 size={12} /></button>
                {canDelete && <button onClick={() => handleDelete(r.id, r.added_by)} className="px-2 py-1.5 rounded-full bg-muted text-xs ml-auto"><Trash2 size={12} /></button>}
              </div>

              <div className="flex items-center justify-between mt-2">
                <button onClick={() => toggleLike(r.id)} className="flex items-center gap-1 text-xs">
                  <Heart size={14} className={likes[r.id]?.likedByMe ? 'text-red-500 fill-red-500' : 'text-gray-400'} />
                  {likes[r.id]?.count || 0}
                </button>
                <MiniStars average={average} myRating={rating.myRating} count={rating.count} onRate={(n) => rateResource(r.id, n)} />
              </div>
            </div>
          )
        })}

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
                    <div className="flex items-center gap-2 mt-2.5">
                      <button onClick={() => setViewer({ url: book.file_url, title: book.title })} className="px-4 py-1.5 rounded-full bg-brand-purple text-white text-xs font-medium">View Book</button>
                      <button onClick={() => shareItem(book.file_url, book.title)} className="px-2 py-1.5 rounded-full bg-muted text-xs"><Share2 size={12} /></button>
                    </div>
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
