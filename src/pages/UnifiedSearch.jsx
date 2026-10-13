import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, Clock, FileText, User, BookOpen, Users, Landmark, CalendarDays, ChevronRight } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import VerifiedBadge from '../components/VerifiedBadge.jsx'
import { supabase } from '../lib/supabaseClient.js'

const EMPTY = { posts: [], people: [], library: [], communities: [], schools: [], events: [] }

const CHIPS = [
  { key: 'all', label: 'All' },
  { key: 'people', label: 'People' },
  { key: 'schools', label: 'Schools' },
  { key: 'posts', label: 'Posts' },
  { key: 'events', label: 'Events' },
  { key: 'library', label: 'Library' },
  { key: 'communities', label: 'Communities' },
]

const ROLES = [
  'Headteacher', 'Deputy Head', 'Teacher', 'Student', 'Parent', 'Bursar',
  'School Coach', 'ICT Administrator', 'Librarian', 'Counsellor', 'Receptionist', 'Investor',
]

const DATES = [
  { key: 'any', label: 'Any time' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
]

const RECENT_KEY = 'schoolink_recent_searches'

function readRecent() {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function writeRecent(list) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list))
  } catch {
    // storage can be blocked; searching still works
  }
}

// Commas, brackets and % break the database filter, so they are turned into spaces.
function clean(value) {
  return value.replace(/[,()%*\\]/g, ' ').trim()
}

function sinceFor(key) {
  const now = new Date()
  if (key === 'today') {
    now.setHours(0, 0, 0, 0)
    return now.toISOString()
  }
  if (key === 'week') return new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
  if (key === 'month') return new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
  return null
}

function timeAgo(dateString) {
  if (!dateString) return ''
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
  if (seconds < 60) return 'now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d`
  return new Date(dateString).toLocaleDateString()
}

function Highlight({ text, query }) {
  const value = text || ''
  const q = query.trim()
  if (!q) return value
  const idx = value.toLowerCase().indexOf(q.toLowerCase())
  if (idx === -1) return value
  return (
    <>
      {value.slice(0, idx)}
      <mark className="bg-yellow-200 text-inherit rounded px-0.5">{value.slice(idx, idx + q.length)}</mark>
      {value.slice(idx + q.length)}
    </>
  )
}

function SectionTitle({ icon: Icon, label, count, onSeeAll }) {
  return (
    <div className="flex items-center justify-between mb-1">
      <p className="text-xs font-semibold text-gray-400 uppercase flex items-center gap-1">
        <Icon size={12} /> {label}
      </p>
      {onSeeAll && count > 5 ? (
        <button onClick={onSeeAll} className="text-xs text-brand-purple flex items-center">
          See all {count >= 30 ? '30+' : count} <ChevronRight size={12} />
        </button>
      ) : null}
    </div>
  )
   }

export default function UnifiedSearch() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [chip, setChip] = useState('all')
  const [role, setRole] = useState('any')
  const [date, setDate] = useState('any')
  const [results, setResults] = useState(EMPTY)
  const [loading, setLoading] = useState(false)
  const [recent, setRecent] = useState(readRecent)
  const requestRef = useRef(0)

  // Search a moment after the person stops typing, and again whenever a filter changes.
  useEffect(() => {
    const value = clean(query)
    if (!value) {
      setResults(EMPTY)
      setLoading(false)
      return undefined
    }
    setLoading(true)
    const timer = setTimeout(() => runSearch(value), 300)
    return () => clearTimeout(timer)
  }, [query, chip, role, date])

  async function runSearch(value) {
    const requestId = ++requestRef.current
    const limit = chip === 'all' ? 6 : 30
    const wants = (key) => chip === 'all' || chip === key
    const since = sinceFor(date)

    const jobs = {
      posts: wants('posts')
        ? (() => {
            let q = supabase.from('posts').select('*').ilike('content', `%${value}%`).order('created_at', { ascending: false }).limit(limit)
            if (since) q = q.gte('created_at', since)
            return q
          })()
        : null,
      people: wants('people')
        ? (() => {
            let q = supabase.from('profiles').select('*').or(`full_name.ilike.%${value}%,username.ilike.%${value}%`).limit(limit)
            if (role !== 'any') q = q.eq('role', role)
            return q
          })()
        : null,
      library: wants('library') ? supabase.from('library_resources').select('*').ilike('title', `%${value}%`).limit(limit) : null,
      communities: wants('communities') ? supabase.from('communities').select('*').ilike('name', `%${value}%`).limit(limit) : null,
      schools: wants('schools') ? supabase.from('schools').select('*').ilike('name', `%${value}%`).limit(limit) : null,
      events: wants('events') ? supabase.from('events').select('*').or(`title.ilike.%${value}%,location.ilike.%${value}%`).limit(limit) : null,
    }

    const keys = Object.keys(jobs)
    const settled = await Promise.all(keys.map((k) => (jobs[k] ? jobs[k] : Promise.resolve({ data: [] }))))
    // Ignore answers that arrive after a newer search was started.
    if (requestId !== requestRef.current) return
    const next = { ...EMPTY }
    keys.forEach((k, i) => { next[k] = settled[i].data ?? [] })
    setResults(next)
    setLoading(false)
  }

  function remember(value) {
    const v = value.trim()
    if (!v) return
    const list = [v, ...readRecent().filter((x) => x.toLowerCase() !== v.toLowerCase())].slice(0, 8)
    writeRecent(list)
    setRecent(list)
  }

  function forget(value) {
    const list = readRecent().filter((x) => x !== value)
    writeRecent(list)
    setRecent(list)
  }

  function clearRecent() {
    writeRecent([])
    setRecent([])
  }

  function open(path) {
    remember(query)
    navigate(path)
  }

  const counts = {
    people: results.people.length,
    schools: results.schools.length,
    posts: results.posts.length,
    events: results.events.length,
    library: results.library.length,
    communities: results.communities.length,
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  const searching = !!clean(query)
  const showAll = chip === 'all'
  const cap = (list) => (showAll ? list.slice(0, 5) : list)

  return (
    <div className="app-shell">
      <BackHeader title="Search Schoolink" />

      <div className="px-4 pt-1 pb-2">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && remember(query)}
            placeholder="Search people, schools, posts, events…"
            className="w-full border border-gray-200 rounded-full pl-9 pr-9 py-2.5 text-sm outline-brand-purple"
          />
          {query ? (
            <button onClick={() => setQuery('')} aria-label="Clear" className="absolute right-3 top-1/2 -translate-y-1/2">
              <X size={16} className="text-gray-400" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex gap-2 px-4 pb-2 overflow-x-auto">
        {CHIPS.map((c) => (
          <button
            key={c.key}
            onClick={() => setChip(c.key)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border ${chip === c.key ? 'bg-brand-purple text-white border-brand-purple' : 'border-gray-200 text-gray-600'}`}
          >
            {c.label}
            {searching && !loading && c.key !== 'all' && counts[c.key] > 0 ? ` · ${counts[c.key]}` : ''}
          </button>
        ))}
      </div>

      {chip === 'all' || chip === 'people' || chip === 'posts' ? (
        <div className="flex gap-2 px-4 pb-2">
          {chip === 'all' || chip === 'people' ? (
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="flex-1 min-w-0 border border-gray-200 rounded-full px-3 py-1.5 text-xs text-gray-600 bg-white outline-brand-purple"
            >
              <option value="any">People: any role</option>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          ) : null}
          {chip === 'all' || chip === 'posts' ? (
            <select
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="flex-1 min-w-0 border border-gray-200 rounded-full px-3 py-1.5 text-xs text-gray-600 bg-white outline-brand-purple"
            >
              {DATES.map((d) => <option key={d.key} value={d.key}>Posts: {d.label.toLowerCase()}</option>)}
            </select>
          ) : null}
        </div>
      ) : null}

      <div className="screen-scroll px-4">
        {!searching ? (
          recent.length > 0 ? (
            <div className="mt-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-gray-400 uppercase">Recent searches</p>
                <button onClick={clearRecent} className="text-xs text-brand-purple">Clear all</button>
              </div>
              {recent.map((r) => (
                <div key={r} className="flex items-center gap-2 py-2">
                  <Clock size={14} className="text-gray-300 shrink-0" />
                  <button onClick={() => setQuery(r)} className="flex-1 text-left text-sm truncate">{r}</button>
                  <button onClick={() => forget(r)} aria-label="Remove"><X size={14} className="text-gray-300" /></button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-400 mt-8">Start typing to search across Schoolink.</p>
          )
        ) : loading ? (
          <p className="text-center text-gray-400 mt-8">Searching…</p>
        ) : total === 0 ? (
          <div className="text-center text-gray-400 mt-8">
            <p>No matches found.</p>
            {role !== 'any' || date !== 'any' ? (
              <button onClick={() => { setRole('any'); setDate('any') }} className="text-sm text-brand-purple mt-2">Clear filters</button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-5 pb-6">
            {results.people.length > 0 ? (
              <div>
                <SectionTitle icon={User} label="People" count={counts.people} onSeeAll={showAll ? () => setChip('people') : null} />
                {cap(results.people).map((p) => (
                  <button key={p.id} onClick={() => open(`/users/${p.id}`)} className="w-full flex items-center gap-3 py-2 text-left">
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                    ) : (
                      <span className="w-9 h-9 rounded-full bg-brand-light flex items-center justify-center shrink-0">🙂</span>
                    )}
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-1 text-sm">
                        <span className="truncate"><Highlight text={p.full_name || 'Schoolink member'} query={query} /></span>
                        <VerifiedBadge userId={p.id} size={13} />
                      </span>
                      <span className="block text-xs text-gray-400 truncate">
                        {p.username ? `@${p.username}` : ''}{p.username && p.role ? ' · ' : ''}{p.role || ''}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}

            {results.schools.length > 0 ? (
              <div>
                <SectionTitle icon={Landmark} label="Schools" count={counts.schools} onSeeAll={showAll ? () => setChip('schools') : null} />
                {cap(results.schools).map((s) => (
                  <button key={s.id} onClick={() => open(`/schools/${s.id}`)} className="w-full text-left py-2 text-sm">
                    <Highlight text={s.name} query={query} /> {s.location ? <span className="text-gray-400">· {s.location}</span> : null}
                  </button>
                ))}
              </div>
            ) : null}

            {results.posts.length > 0 ? (
              <div>
                <SectionTitle icon={FileText} label="Posts" count={counts.posts} onSeeAll={showAll ? () => setChip('posts') : null} />
                {cap(results.posts).map((p) => (
                  <button key={p.id} onClick={() => open(`/post/${p.id}`)} className="w-full text-left py-2">
                    <span className="block text-sm line-clamp-2"><Highlight text={p.content} query={query} /></span>
                    <span className="block text-[11px] text-gray-400">{timeAgo(p.created_at)}</span>
                  </button>
                ))}
              </div>
            ) : null}

            {results.events.length > 0 ? (
              <div>
                <SectionTitle icon={CalendarDays} label="Events" count={counts.events} onSeeAll={showAll ? () => setChip('events') : null} />
                {cap(results.events).map((e) => (
                  <button key={e.id} onClick={() => open('/calendar')} className="w-full text-left py-2 text-sm">
                    <Highlight text={e.title} query={query} /> {e.location ? <span className="text-gray-400">· {e.location}</span> : null}
                  </button>
                ))}
              </div>
            ) : null}

            {results.library.length > 0 ? (
              <div>
                <SectionTitle icon={BookOpen} label="Library" count={counts.library} onSeeAll={showAll ? () => setChip('library') : null} />
                {cap(results.library).map((l) => (
                  <button key={l.id} onClick={() => open('/library')} className="w-full text-left py-2 text-sm">
                    <Highlight text={l.title} query={query} />
                  </button>
                ))}
              </div>
            ) : null}

            {results.communities.length > 0 ? (
              <div>
                <SectionTitle icon={Users} label="Communities" count={counts.communities} onSeeAll={showAll ? () => setChip('communities') : null} />
                {cap(results.communities).map((c) => (
                  <button key={c.id} onClick={() => open(`/communities/${c.id}`)} className="w-full text-left py-2 text-sm">
                    <Highlight text={c.name} query={query} />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
    }
