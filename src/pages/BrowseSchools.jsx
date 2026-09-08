import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Landmark, Plus } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import BottomNav from '../components/BottomNav.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { isSchoolMember } from '../lib/permissions.js'

export default function BrowseSchools() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [schools, setSchools] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    loadSchools()
  }, [])

  async function loadSchools() {
    setLoading(true)
    const { data } = await supabase.from('schools').select('*').order('name', { ascending: true })
    setSchools(data ?? [])
    setLoading(false)
  }

  const filtered = schools.filter((s) => {
    const q = query.toLowerCase().trim()
    return !q || s.name?.toLowerCase().includes(q) || s.location?.toLowerCase().includes(q)
  })

  return (
    <div className="app-shell">
      <BackHeader title="Browse Schools" />
      <div className="px-4 pt-2 pb-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search schools by name or location…"
            className="w-full border border-gray-200 rounded-full pl-9 pr-4 py-2.5 text-sm outline-brand-purple"
          />
        </div>
        {!isSchoolMember(profile) ? (
          <button
            onClick={() => navigate('/onboarding/create-school')}
            className="mt-3 w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500"
          >
            <Plus size={16} /> Create Your Own School
          </button>
        ) : null}
      </div>

      <div className="screen-scroll px-4">
        {loading ? (
          <p className="text-center text-gray-400 mt-8">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-400 mt-8">No schools found.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map((s) => (
              <button key={s.id} onClick={() => navigate(`/schools/${s.id}`)} className="w-full flex items-center gap-3 py-3.5 text-left">
                {s.logo_url ? (
                  <img src={s.logo_url} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
                ) : (
                  <span className="w-11 h-11 rounded-full bg-brand-light flex items-center justify-center shrink-0">
                    <Landmark size={18} className="text-brand-purple" />
                  </span>
                )}
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{s.name}</p>
                  <p className="text-xs text-gray-400 truncate">{s.location} · {s.school_type}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  )
}
