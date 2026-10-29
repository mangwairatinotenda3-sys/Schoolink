import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, MapPin, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { AuthPage, Notice } from '../components/AuthKit.jsx'

export default function SelectAlumniSchool() {
  const navigate = useNavigate()
  const { saveProfileDetails } = useAuth()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSearch(value) {
    setQuery(value)
    setError('')
    const term = value.trim()
    if (!term) { setResults([]); return }
    setSearching(true)
    const { data, error: e } = await supabase
      .from('schools')
      .select('id, name, location')
      .ilike('name', `%${term}%`)
      .order('name')
      .limit(12)
    setSearching(false)
    if (e) { setError('Search is not working right now. Please try again.'); setResults([]); return }
    setResults(data ?? [])
  }

  async function handleSelect(school) {
    setSaving(true)
    setError('')
    try {
      await saveProfileDetails({ school_id: school.id, account_type: 'alumni' })
      navigate('/edit-profile-details')
    } catch {
      setError('Could not save your school. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const term = query.trim()

  return (
    <AuthPage title="Which school did you attend?" subtitle="Search by name and pick your school from the list.">
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search for your school"
          aria-label="Search for your school"
          className="w-full h-14 rounded-2xl border border-gray-200 bg-white pl-11 pr-4 text-[15px] text-brand-navy placeholder:text-gray-400 outline-none focus:border-brand-purple focus:ring-4 focus:ring-brand-purple/10"
        />
      </div>

      {error ? <div className="mt-4"><Notice tone="error">{error}</Notice></div> : null}

      <div className="mt-4">
        {!term ? (
          <p className="py-10 text-center text-sm text-gray-400">Start typing your school's name.</p>
        ) : searching ? (
          <div aria-busy="true" className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 rounded-2xl bg-gray-100" />
            ))}
          </div>
        ) : results.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">No schools match "{term}". Try a shorter name.</p>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
            {results.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSelect(s)}
                disabled={saving}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left disabled:opacity-50"
                style={{ borderTop: i ? '1px solid #F1F5F9' : 'none' }}
              >
                <span className="flex-1 min-w-0">
                  <span className="block truncate text-[15px] font-semibold text-brand-navy">{s.name}</span>
                  <span className="flex items-center gap-1 mt-0.5 text-xs text-gray-500">
                    <MapPin size={12} className="shrink-0" />
                    <span className="truncate">{s.location || 'No location added'}</span>
                  </span>
                </span>
                <ChevronRight size={18} className="text-gray-300 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </AuthPage>
  )
  }
