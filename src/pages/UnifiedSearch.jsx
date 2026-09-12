import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, FileText, User, BookOpen, Users } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'

export default function UnifiedSearch() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState({ posts: [], people: [], library: [], communities: [] })
  const [loading, setLoading] = useState(false)

  async function handleSearch(value) {
    setQuery(value)
    if (!value.trim()) {
      setResults({ posts: [], people: [], library: [], communities: [] })
      return
    }
    setLoading(true)
    const [{ data: posts }, { data: people }, { data: library }, { data: communities }] = await Promise.all([
      supabase.from('posts').select('*').ilike('content', `%${value}%`).limit(5),
      supabase.from('profiles').select('*').or(`full_name.ilike.%${value}%,username.ilike.%${value}%`).limit(5),
      supabase.from('library_resources').select('*').ilike('title', `%${value}%`).limit(5),
      supabase.from('communities').select('*').ilike('name', `%${value}%`).limit(5),
    ])
    setResults({ posts: posts ?? [], people: people ?? [], library: library ?? [], communities: communities ?? [] })
    setLoading(false)
  }

  const hasResults = results.posts.length || results.people.length || results.library.length || results.communities.length

  return (
    <div className="app-shell">
      <BackHeader title="Search Schoolink" />
      <div className="px-4 pt-2 pb-2">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search people, posts, library, communities…"
            className="w-full border border-gray-200 rounded-full pl-9 pr-4 py-2.5 text-sm outline-brand-purple"
          />
        </div>
      </div>

      <div className="screen-scroll px-4">
        {loading ? (
          <p className="text-center text-gray-400 mt-8">Searching…</p>
        ) : !query.trim() ? (
          <p className="text-center text-gray-400 mt-8">Start typing to search across Schoolink.</p>
        ) : !hasResults ? (
          <p className="text-center text-gray-400 mt-8">No matches found.</p>
        ) : (
          <div className="space-y-5">
            {results.people.length > 0 ? (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-2 flex items-center gap-1"><User size={12} /> People</p>
                {results.people.map((p) => (
                  <button key={p.id} onClick={() => navigate(`/users/${p.id}`)} className="w-full text-left py-2 text-sm">
                    {p.full_name || 'Schoolink member'} {p.username ? <span className="text-gray-400">@{p.username}</span> : null}
                  </button>
                ))}
              </div>
            ) : null}
            {results.posts.length > 0 ? (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-2 flex items-center gap-1"><FileText size={12} /> Posts</p>
                {results.posts.map((p) => (
                  <button key={p.id} onClick={() => navigate(`/post/${p.id}`)} className="w-full text-left py-2 text-sm truncate">
                    {p.content}
                  </button>
                ))}
              </div>
            ) : null}
            {results.library.length > 0 ? (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-2 flex items-center gap-1"><BookOpen size={12} /> Library</p>
                {results.library.map((l) => (
                  <button key={l.id} onClick={() => navigate('/library')} className="w-full text-left py-2 text-sm">{l.title}</button>
                ))}
              </div>
            ) : null}
            {results.communities.length > 0 ? (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-2 flex items-center gap-1"><Users size={12} /> Communities</p>
                {results.communities.map((c) => (
                  <button key={c.id} onClick={() => navigate(`/communities/${c.id}`)} className="w-full text-left py-2 text-sm">{c.name}</button>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
