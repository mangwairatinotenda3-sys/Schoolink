import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, Plus, X, BookOpen, Upload, Eye, Trash2, Download, Share2, Heart, Star, SlidersHorizontal, RefreshCw } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import DocumentViewer from '../components/DocumentViewer.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { canManageLibrary } from '../lib/permissions.js'

const TYPES = ['Past Paper', 'Marking Scheme', 'Notes', 'Textbook', 'Novel']
const SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'liked', label: 'Most liked' },
  { value: 'rated', label: 'Top rated' },
]
const EMPTY_FORM = { title: '', author: '', category: 'Past Paper', subject: '', exam_board: '', country: '', year: '', language: '', file_url: '' }
const NO_FILTERS = { country: '', exam_board: '', subject: '', year: '' }

function cleanText(str) {
  if (!str) return ''
  return String(str).replace(/<br\s*\/?>/gi, ' ').replace(/&lt;br\s*\/?&gt;/gi, ' ').replace(/\s+/g, ' ').trim()
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean).map(v => String(v).trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
}

function nullIfEmpty(v) {
  const t = String(v ?? '').trim()
  return t ? t : null
}

// Papers and marking schemes match when subject, board and year are the same.
function pairKey(r) {
  if (!r.subject || !r.year) return null
  return [r.subject, r.exam_board, r.year].map(v => String(v ?? '').trim().toLowerCase()).join('|')
}

function averageOf(entry) {
  return entry && entry.count ? entry.sum / entry.count : 0
}

function MiniStars({ average, myRating, count, onRate }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" aria-label={`Rate ${n} star${n > 1 ? 's' : ''}`} onClick={(e) => { e.stopPropagation(); onRate(n) }}>
          <Star size={13} className={n <= Math.round(myRating || average) ? 'text-amber-400 fill-amber-400' : 'text-gray-300'} />
        </button>
      ))}
      {count > 0 ? <span className="text-[10px] text-muted-foreground ml-1">{average.toFixed(1)} ({count})</span> : null}
    </div>
  )
}

function FilterSelect({ label, value, options, onChange }) {
  return (
    <label className="shrink-0 flex items-center gap-1.5 bg-card border border-border rounded-full pl-3 pr-2 py-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)} className="bg-transparent outline-none max-w-[8.5rem] truncate text-foreground">
        <option value="" className="bg-card">All</option>
        {options.map(o => <option key={o} value={o} className="bg-card">{o}</option>)}
      </select>
    </label>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-card border rounded-xl p-3 animate-pulse">
      <div className="flex gap-3">
        <span className="w-11 h-11 rounded-xl bg-muted shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-3 bg-muted rounded w-3/4" />
          <div className="h-2.5 bg-muted rounded w-1/2" />
        </div>
      </div>
    </div>
  )
}

export default function Library() {
  const { user, profile } = useAuth()
  const fileInputRef = useRef(null)
  const lastQueryRef = useRef('')

  const [resources, setResources] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [query, setQuery] = useState('')
  const [type, setType] = useState('All')
  const [filters, setFilters] = useState(NO_FILTERS)
  const [sort, setSort] = useState('newest')
  const [showFilters, setShowFilters] = useState(false)
  const [externalResults, setExternalResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [viewer, setViewer] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [uploadedFile, setUploadedFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [likes, setLikes] = useState({})
  const [ratings, setRatings] = useState({})
  const [deletingId, setDeletingId] = useState(null)
  const [toast, setToast] = useState('')

  const canManage = canManageLibrary(profile)
  const me = user?.id

  useEffect(() => {
    loadResources()
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2200)
    return () => clearTimeout(t)
  }, [toast])

  function showToast(message) {
    setToast(message)
  }

  async function loadResources() {
    setLoading(true)
    setLoadError('')
    const { data, error } = await supabase.from('library_resources').select('*').order('created_at', { ascending: false })
    if (error) {
      setLoadError("Couldn't load the library. Check your connection and try again.")
      setLoading(false)
      return
    }
    const rows = data ?? []
    setResources(rows)
    await loadEngagement(rows.map(r => r.id))
    setLoading(false)
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
      if (l.user_id === me) likeMap[l.resource_id].likedByMe = true
    })
    const ratingMap = {}
    ;(ratingRows ?? []).forEach((r) => {
      if (!ratingMap[r.resource_id]) ratingMap[r.resource_id] = { sum: 0, count: 0, myRating: 0 }
      ratingMap[r.resource_id].sum += r.rating
      ratingMap[r.resource_id].count += 1
      if (r.user_id === me) ratingMap[r.resource_id].myRating = r.rating
    })
    setLikes(likeMap)
    setRatings(ratingMap)
  }

  async function toggleLike(resourceId) {
    if (!me) return
    const current = likes[resourceId]
    const wasLiked = !!current?.likedByMe
    setLikes(prev => ({
      ...prev,
      [resourceId]: { count: Math.max(0, (prev[resourceId]?.count || 0) + (wasLiked ? -1 : 1)), likedByMe: !wasLiked },
    }))
    const request = wasLiked
      ? supabase.from('library_resource_likes').delete().eq('resource_id', resourceId).eq('user_id', me)
      : supabase.from('library_resource_likes').insert({ resource_id: resourceId, user_id: me })
    const { error } = await request
    if (error) {
      setLikes(prev => ({ ...prev, [resourceId]: current || { count: 0, likedByMe: false } }))
      showToast("Couldn't update your like")
    }
  }

  async function rateResource(resourceId, rating) {
    if (!me) return
    const previous = ratings[resourceId]
    setRatings(prev => {
      const existing = prev[resourceId] || { sum: 0, count: 0, myRating: 0 }
      const hadMine = existing.myRating > 0
      return {
        ...prev,
        [resourceId]: {
          sum: existing.sum - existing.myRating + rating,
          count: hadMine ? existing.count : existing.count + 1,
          myRating: rating,
        },
      }
    })
    const { error } = await supabase
      .from('library_resource_ratings')
      .upsert({ resource_id: resourceId, user_id: me, rating }, { onConflict: 'resource_id,user_id' })
    if (error) {
      setRatings(prev => ({ ...prev, [resourceId]: previous || { sum: 0, count: 0, myRating: 0 } }))
      showToast("Couldn't save your rating")
    }
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
      showToast('Link copied')
    }
  }

  // Online results come from the unopasa-search function. Debounced, and only the latest search is shown.
  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) {
      lastQueryRef.current = ''
      setExternalResults([])
      setSearching(false)
      return
    }
    lastQueryRef.current = term
    setSearching(true)
    const t = setTimeout(async () => {
      let results = []
      try {
        const res = await fetch(`${supabase.supabaseUrl}/functions/v1/unopasa-search?q=${encodeURIComponent(term)}`)
        const json = await res.json()
        results = Array.isArray(json) ? json : []
      } catch {
        results = []
      }
      if (lastQueryRef.current !== term) return
      setExternalResults(results)
      setSearching(false)
    }, 500)
    return () => clearTimeout(t)
  }, [query])

  function updateForm(k, v) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !me) return
    setUploading(true)
    setFormError('')
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${me}/${Date.now()}-${safeName}`
    const { error: upErr } = await supabase.storage.from('library-files').upload(path, file)
    if (upErr) {
      setFormError(upErr.message)
      setUploading(false)
      return
    }
    const { data } = supabase.storage.from('library-files').getPublicUrl(path)
    setUploadedFile(file.name)
    updateForm('file_url', data.publicUrl)
    setUploading(false)
  }

  async function handleAdd() {
    const title = form.title.trim()
    const link = form.file_url.trim()
    if (!title || !link) {
      setFormError('Add a title and a file or link')
      return
    }
    setSaving(true)
    setFormError('')
    const row = {
      title,
      author: nullIfEmpty(form.author),
      category: form.category,
      subject: nullIfEmpty(form.subject),
      exam_board: nullIfEmpty(form.exam_board),
      country: nullIfEmpty(form.country),
      year: nullIfEmpty(form.year),
      language: nullIfEmpty(form.language),
      file_url: link,
      added_by: me,
    }
    const { error } = await supabase.from('library_resources').insert(row)
    setSaving(false)
    if (error) {
      setFormError(error.message)
      return
    }
    setForm(EMPTY_FORM)
    setUploadedFile(null)
    setShowAddForm(false)
    showToast('Resource added')
    loadResources()
  }

  async function handleDelete(r) {
    if (r.added_by !== me && !canManage) return
    if (!confirm(`Delete "${cleanText(r.title)}"?`)) return
    setDeletingId(r.id)
    const { error } = await supabase.from('library_resources').delete().eq('id', r.id)
    setDeletingId(null)
    if (error) {
      showToast("Couldn't delete. Try again")
      return
    }
    setResources(prev => prev.filter(x => x.id !== r.id))
    showToast('Resource deleted')
  }

  // Derived lists for the filter controls
  const typeChips = useMemo(() => {
    const extras = uniqueSorted(resources.map(r => r.category)).filter(c => !TYPES.includes(c))
    return ['All', ...TYPES, ...extras]
  }, [resources])
  const countries = useMemo(() => uniqueSorted(resources.map(r => r.country)), [resources])
  const boards = useMemo(() => uniqueSorted(resources.map(r => r.exam_board)), [resources])
  const subjects = useMemo(() => uniqueSorted(resources.map(r => r.subject)), [resources])
  const years = useMemo(() => uniqueSorted(resources.map(r => r.year)).reverse(), [resources])

  const paperKeys = useMemo(
    () => new Set(resources.filter(r => r.category === 'Past Paper').map(pairKey).filter(Boolean)),
    [resources]
  )
  const schemeKeys = useMemo(
    () => new Set(resources.filter(r => r.category === 'Marking Scheme').map(pairKey).filter(Boolean)),
    [resources]
  )

  function pairBadge(r) {
    const key = pairKey(r)
    if (!key) return null
    if (r.category === 'Past Paper' && schemeKeys.has(key)) return 'Marking scheme available'
    if (r.category === 'Marking Scheme' && paperKeys.has(key)) return 'Paper available'
    return null
  }

  const term = query.trim().toLowerCase()
  const hasFilters = type !== 'All' || term !== '' || Object.values(filters).some(Boolean)

  const filtered = useMemo(() => {
    const matches = resources.filter(r => {
      if (type !== 'All' && r.category !== type) return false
      if (filters.country && r.country !== filters.country) return false
      if (filters.exam_board && r.exam_board !== filters.exam_board) return false
      if (filters.subject && r.subject !== filters.subject) return false
      if (filters.year && String(r.year ?? '') !== filters.year) return false
      if (!term) return true
      const haystack = [r.title, r.author, r.subject, r.exam_board, r.country, r.year, r.language, r.category]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return term.split(/\s+/).every(part => haystack.includes(part))
    })
    if (sort === 'liked') {
      return [...matches].sort((a, b) => (likes[b.id]?.count || 0) - (likes[a.id]?.count || 0))
    }
    if (sort === 'rated') {
      return [...matches].sort((a, b) => averageOf(ratings[b.id]) - averageOf(ratings[a.id]))
    }
    return matches
  }, [resources, type, filters, term, sort, likes, ratings])

  function clearAll() {
    setQuery('')
    setType('All')
    setFilters(NO_FILTERS)
    setSort('newest')
  }

  const activeFilterCount = Object.values(filters).filter(Boolean).length
    return (
    <div className="flex-1 flex flex-col bg-background min-h-screen">
      <BackHeader title="Library" />

      {viewer && <DocumentViewer url={viewer.url} title={cleanText(viewer.title)} onClose={() => setViewer(null)} />}

      <div className="px-4 pt-2 pb-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search title, subject, board, year..."
              className="w-full bg-card border border-border rounded-xl pl-9 pr-9 py-2.5 text-sm outline-none focus:border-brand-purple"
            />
            {query ? (
              <button onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                <X size={16} />
              </button>
            ) : null}
          </div>
          <button
            onClick={() => setShowFilters(s => !s)}
            aria-label="Show filters"
            className={`shrink-0 relative w-11 rounded-xl border flex items-center justify-center ${showFilters || activeFilterCount ? 'bg-muted border-border' : 'bg-card border-border'}`}
          >
            <SlidersHorizontal size={16} />
            {activeFilterCount > 0 ? (
              <span className="absolute -top-1 -right-1 bg-brand-purple text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{activeFilterCount}</span>
            ) : null}
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto mt-3 pb-1 scrollbar-hide">
          {typeChips.map(c => (
            <button
              key={c}
              onClick={() => setType(c)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium border transition ${type === c ? 'bg-muted text-foreground border-border' : 'bg-card border-transparent text-muted-foreground'}`}
            >
              {c}{type === c && ' ✓'}
            </button>
          ))}
        </div>

        {showFilters && (
          <div className="flex gap-2 overflow-x-auto mt-3 pb-1 scrollbar-hide">
            <FilterSelect label="Country" value={filters.country} options={countries} onChange={v => setFilters(f => ({ ...f, country: v }))} />
            <FilterSelect label="Board" value={filters.exam_board} options={boards} onChange={v => setFilters(f => ({ ...f, exam_board: v }))} />
            <FilterSelect label="Subject" value={filters.subject} options={subjects} onChange={v => setFilters(f => ({ ...f, subject: v }))} />
            <FilterSelect label="Year" value={filters.year} options={years} onChange={v => setFilters(f => ({ ...f, year: v }))} />
            <label className="shrink-0 flex items-center gap-1.5 bg-card border border-border rounded-full pl-3 pr-2 py-1.5 text-xs">
              <span className="text-muted-foreground">Sort</span>
              <select value={sort} onChange={e => setSort(e.target.value)} className="bg-transparent outline-none text-foreground">
                {SORTS.map(s => <option key={s.value} value={s.value} className="bg-card">{s.label}</option>)}
              </select>
            </label>
          </div>
        )}

        {hasFilters && (
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-muted-foreground">{filtered.length} {filtered.length === 1 ? 'resource' : 'resources'}</p>
            <button onClick={clearAll} className="text-xs text-brand-purple">Clear all</button>
          </div>
        )}
      </div>

      {toast ? <p className="text-center text-xs text-brand-purple">{toast}</p> : null}

      {canManage && (
        <div className="px-4 pb-2 mt-1">
          {showAddForm ? (
            <div className="border border-border rounded-xl p-4 space-y-2 bg-card">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">Add resource</p>
                <button onClick={() => setShowAddForm(false)} aria-label="Close"><X size={16} /></button>
              </div>
              <input value={form.title} onChange={e => updateForm('title', e.target.value)} placeholder="Title *" className="w-full bg-background border rounded-lg px-3 py-2 text-sm" />
              <input value={form.author} onChange={e => updateForm('author', e.target.value)} placeholder="Author" className="w-full bg-background border rounded-lg px-3 py-2 text-sm" />
              <select value={form.category} onChange={e => updateForm('category', e.target.value)} className="w-full bg-background border rounded-lg px-3 py-2 text-sm">
                {TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input value={form.subject} onChange={e => updateForm('subject', e.target.value)} placeholder="Subject" className="w-full bg-background border rounded-lg px-3 py-2 text-sm" />
                <input value={form.exam_board} onChange={e => updateForm('exam_board', e.target.value)} placeholder="Exam board (e.g. ZIMSEC)" className="w-full bg-background border rounded-lg px-3 py-2 text-sm" />
                <input value={form.country} onChange={e => updateForm('country', e.target.value)} placeholder="Country" className="w-full bg-background border rounded-lg px-3 py-2 text-sm" />
                <input value={form.year} onChange={e => updateForm('year', e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" placeholder="Year" className="w-full bg-background border rounded-lg px-3 py-2 text-sm" />
                <input value={form.language} onChange={e => updateForm('language', e.target.value)} placeholder="Language" className="col-span-2 w-full bg-background border rounded-lg px-3 py-2 text-sm" />
              </div>
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="w-full flex items-center justify-center gap-2 border border-dashed rounded-lg py-2.5 text-sm">
                <Upload size={15} />{uploading ? 'Uploading…' : uploadedFile ? uploadedFile : 'Upload file *'}
              </button>
              <input ref={fileInputRef} type="file" onChange={handleFileChange} className="hidden" />
              <input value={form.file_url} onChange={e => updateForm('file_url', e.target.value)} placeholder="Or paste a file link *" className="w-full bg-background border rounded-lg px-3 py-2 text-sm" />
              {formError && <p className="text-red-500 text-xs">{formError}</p>}
              <button onClick={handleAdd} disabled={saving || uploading} className="w-full bg-brand-purple text-white py-2.5 rounded-lg text-sm disabled:opacity-60">
                {saving ? 'Adding…' : 'Add resource'}
              </button>
            </div>
          ) : (
            <button onClick={() => setShowAddForm(true)} className="w-full flex items-center justify-center gap-2 border border-dashed rounded-xl py-3 text-sm">
              <Plus size={16} /> Add a resource
            </button>
          )}
        </div>
      )}

      <div className="px-4 pb-20 space-y-3 mt-2">
        {loadError && (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">{loadError}</p>
            <button onClick={loadResources} className="mt-3 inline-flex items-center gap-1.5 text-sm text-brand-purple"><RefreshCw size={14} /> Try again</button>
          </div>
        )}

        {!loadError && loading && [0, 1, 2].map(i => <SkeletonCard key={i} />)}

        {!loadError && !loading && filtered.length === 0 && (
          <div className="text-center py-10">
            {resources.length === 0 ? (
              <>
                <p className="text-sm font-medium">The library is empty</p>
                <p className="text-xs text-muted-foreground mt-1">{canManage ? 'Add the first resource above.' : 'Resources added by your school will appear here.'}</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium">No resources match</p>
                <p className="text-xs text-muted-foreground mt-1">Try a different search or filter.</p>
                <button onClick={clearAll} className="mt-3 text-sm text-brand-purple">Clear filters</button>
              </>
            )}
          </div>
        )}

        {!loadError && !loading && filtered.map(r => {
          const canDelete = r.added_by === me || canManage
          const rating = ratings[r.id] || { sum: 0, count: 0, myRating: 0 }
          const average = averageOf(rating)
          const badge = pairBadge(r)
          const details = [r.exam_board, r.subject, r.year, r.country].filter(Boolean).join(' • ')
          const byline = [r.author, r.language].filter(Boolean).join(' • ')
          return (
            <div key={r.id} className="bg-card border rounded-xl p-3">
              <div className="flex gap-3">
                <span className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center shrink-0"><BookOpen size={18} /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm leading-tight break-words">{cleanText(r.title)}</p>
                  {details ? <p className="text-xs text-muted-foreground mt-0.5">{details}</p> : null}
                  {byline ? <p className="text-xs text-muted-foreground">{byline}</p> : null}
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {r.category ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{r.category}</span> : null}
                    {badge ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">{badge}</span> : null}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-2.5">
                <button onClick={() => setViewer({ url: r.file_url, title: r.title })} className="px-3 py-1.5 rounded-full bg-brand-purple text-white text-xs flex items-center gap-1"><Eye size={12} />View</button>
                <button onClick={() => downloadItem(r.file_url, r.title)} className="px-3 py-1.5 rounded-full bg-muted text-xs flex items-center gap-1"><Download size={12} />Download</button>
                <button onClick={() => shareItem(r.file_url, r.title)} aria-label="Share" className="px-2 py-1.5 rounded-full bg-muted text-xs"><Share2 size={12} /></button>
                {canDelete && (
                  <button
                    onClick={() => handleDelete(r)}
                    disabled={deletingId === r.id}
                    aria-label="Delete"
                    className="px-2 py-1.5 rounded-full bg-muted text-xs ml-auto disabled:opacity-50"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between mt-2">
                <button onClick={() => toggleLike(r.id)} aria-label={likes[r.id]?.likedByMe ? 'Unlike' : 'Like'} className="flex items-center gap-1 text-xs">
                  <Heart size={14} className={likes[r.id]?.likedByMe ? 'text-red-500 fill-red-500' : 'text-gray-400'} />
                  {likes[r.id]?.count || 0}
                </button>
                <MiniStars average={average} myRating={rating.myRating} count={rating.count} onRate={(n) => rateResource(r.id, n)} />
              </div>
            </div>
          )
        })}

        {term.length >= 2 && (
          <div className="pt-3">
            <p className="text-sm font-semibold">
              Online results <span className="text-xs font-normal text-muted-foreground">from Unopasa</span>
              {searching && <span className="text-xs font-normal text-muted-foreground"> · Searching…</span>}
            </p>
            <div className="space-y-3 mt-3">
              {externalResults.map((book, i) => (
                <div key={`${book.id || book.title}-${i}`} className="bg-card border rounded-xl p-3 flex gap-3">
                  <span className="w-11 h-11 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 text-[8px] font-bold text-center leading-tight overflow-hidden px-0.5">
                    {cleanText(book.board || 'Online')}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm leading-tight break-words">{cleanText(book.title)}</p>
                    {book.meta ? <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{cleanText(book.meta)}</p> : null}
                    <div className="flex items-center gap-2 mt-2.5">
                      <button onClick={() => setViewer({ url: book.file_url, title: book.title })} className="px-4 py-1.5 rounded-full bg-brand-purple text-white text-xs font-medium">View</button>
                      <button onClick={() => shareItem(book.file_url, book.title)} aria-label="Share" className="px-2 py-1.5 rounded-full bg-muted text-xs"><Share2 size={12} /></button>
                    </div>
                  </div>
                </div>
              ))}
              {!searching && externalResults.length === 0 && (
                <p className="text-center text-xs text-muted-foreground py-8">No online results for "{query.trim()}"</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
            }
