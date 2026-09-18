import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function NewChatPicker() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  async function handleSearch(value) {
    setQuery(value)
    if (!value.trim()) { setResults([]); return }
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, username, role, avatar_url')
      .or(`full_name.ilike.%${value}%,username.ilike.%${value}%`)
      .neq('id', user.id)
      .limit(20)
    setResults(data ?? [])
    setLoading(false)
  }

  return (
    <div className="app-shell">
      <BackHeader title="New Chat" />
      <div className="px-4 pt-2 pb-2">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by name or @username…"
            className="w-full border border-gray-200 rounded-full pl-9 pr-4 py-2.5 text-sm outline-brand-purple"
          />
        </div>
      </div>

      <div className="screen-scroll px-4">
        {loading ? (
          <p className="text-center text-gray-400 mt-8">Searching…</p>
        ) : !query.trim() ? (
          <p className="text-center text-gray-400 mt-8">Search for someone to start a conversation.</p>
        ) : results.length === 0 ? (
          <p className="text-center text-gray-400 mt-8">No matches found.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {results.map((p) => (
              <button key={p.id} onClick={() => navigate(`/chats/${p.id}`)} className="w-full flex items-center gap-3 py-3 text-left">
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover" />
                ) : (
                  <span className="w-11 h-11 rounded-full bg-brand-light flex items-center justify-center text-lg">🙂</span>
                )}
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{p.full_name || 'Schoolink member'}</p>
                  <p className="text-xs text-gray-400 truncate">{p.username ? `@${p.username}` : p.role}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
