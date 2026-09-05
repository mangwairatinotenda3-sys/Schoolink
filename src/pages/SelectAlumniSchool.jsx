import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function SelectAlumniSchool() {
  const navigate = useNavigate()
  const { saveProfileDetails } = useAuth()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [saving, setSaving] = useState(false)

  async function handleSearch(value) {
    setQuery(value)
    if (!value.trim()) {
      setResults([])
      return
    }
    const { data } = await supabase.from('schools').select('id, name, location').ilike('name', `%${value}%`).limit(10)
    setResults(data ?? [])
  }

  async function handleSelect(school) {
    setSaving(true)
    await saveProfileDetails({ school_id: school.id, account_type: 'alumni' })
    setSaving(false)
    navigate('/edit-profile-details')
  }

  return (
    <div className="app-shell">
      <BackHeader title="Which school did you attend?" />
      <div className="screen-scroll px-6 pt-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search for your school…"
            className="w-full border border-gray-200 rounded-full pl-9 pr-4 py-2.5 text-sm outline-brand-purple"
          />
        </div>

        <div className="mt-4 divide-y divide-gray-100">
          {results.map((s) => (
            <button
              key={s.id}
              onClick={() => handleSelect(s)}
              disabled={saving}
              className="w-full text-left py-3"
            >
              <p className="font-medium text-sm">{s.name}</p>
              <p className="text-xs text-gray-400">{s.location}</p>
            </button>
          ))}
          {query.trim() && results.length === 0 ? (
            <p className="text-center text-gray-400 text-sm mt-6">No schools found — try a different search.</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
