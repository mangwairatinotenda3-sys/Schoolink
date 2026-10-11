import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, GraduationCap } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import BottomNav from '../components/BottomNav.jsx'
import VerifiedBadge from '../components/VerifiedBadge.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

// Former students of the viewer's school: search, filter by class year, tap for their profile.
export default function AlumniDirectory() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [alumni, setAlumni] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [year, setYear] = useState('all')

  useEffect(() => {
    if (profile === null) return
    if (profile.school_id) loadAlumni()
    else setLoading(false)
  }, [profile?.school_id, profile === null])

  async function loadAlumni() {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('school_id', profile.school_id)
      .eq('account_type', 'alumni')
      .order('graduation_year', { ascending: false })
    setAlumni(data ?? [])
    setLoading(false)
  }

  const years = useMemo(
    () => [...new Set(alumni.map((a) => a.graduation_year).filter(Boolean))].sort((a, b) => b - a),
    [alumni]
  )

  const shown = alumni.filter((a) => {
    if (year !== 'all' && String(a.graduation_year) !== String(year)) return false
    const q = query.trim().toLowerCase()
    if (!q) return true
    return [a.full_name, a.occupation, a.alumni_testimonial].filter(Boolean).join(' ').toLowerCase().includes(q)
  })

  return (
    <div className="app-shell">
      <BackHeader title="Alumni" dark />
      <div className="screen-scroll px-4 pt-3">
        {profile !== null && !profile.school_id ? (
          <div className="text-center mt-16 px-6">
            <span className="w-16 h-16 mx-auto rounded-full bg-brand-light flex items-center justify-center">
              <GraduationCap size={30} className="text-brand-purple" />
            </span>
            <p className="font-semibold mt-4">Alumni belong to a school</p>
            <p className="text-sm text-gray-400 mt-1">Join a school to see the former students who stay connected to it.</p>
          </div>
        ) : loading ? (
          <p className="text-center text-gray-400 mt-8">Loading…</p>
        ) : alumni.length === 0 ? (
          <div className="text-center mt-16 px-6">
            <span className="w-16 h-16 mx-auto rounded-full bg-brand-light flex items-center justify-center">
              <GraduationCap size={30} className="text-brand-purple" />
            </span>
            <p className="font-semibold mt-4">No alumni yet</p>
            <p className="text-sm text-gray-400 mt-1">Former students who join from this school will show up here.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 bg-gray-50 rounded-2xl px-4 py-3">
              <Search size={18} className="text-gray-400 shrink-0" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name or occupation"
                className="flex-1 bg-transparent outline-none text-sm"
              />
            </div>

            {years.length > 0 ? (
              <div className="flex gap-2 overflow-x-auto mt-3 pb-1">
                {['all', ...years].map((y) => (
                  <button
                    key={y}
                    onClick={() => setYear(y)}
                    className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-medium border ${
                      String(year) === String(y) ? 'bg-brand-purple text-white border-brand-purple' : 'border-gray-200 text-gray-500'
                    }`}
                  >
                    {y === 'all' ? 'All' : y}
                  </button>
                ))}
              </div>
            ) : null}

            <p className="text-xs text-gray-400 mt-3 mb-2">
              {shown.length} alumni{year !== 'all' ? ` · Class of ${year}` : ''}
            </p>

            {shown.length === 0 ? (
              <p className="text-center text-gray-400 mt-8 text-sm">No one matches that search.</p>
            ) : (
              <div className="space-y-3">
                {shown.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => navigate(`/users/${a.id}`)}
                    className="w-full flex items-start gap-3 p-3.5 rounded-2xl border border-gray-100 bg-white text-left shadow-sm"
                  >
                    {a.avatar_url ? (
                      <img src={a.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
                    ) : (
                      <span className="w-12 h-12 rounded-full bg-brand-light flex items-center justify-center shrink-0">
                        <GraduationCap size={22} className="text-brand-purple" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 font-semibold text-sm">
                        {a.full_name || 'Alumni member'}
                        <VerifiedBadge userId={a.id} size={15} />
                      </span>
                      <span className="block text-xs text-gray-400 mt-0.5">
                        {[a.graduation_year ? `Class of ${a.graduation_year}` : null, a.occupation].filter(Boolean).join(' · ') || 'Details not added yet'}
                      </span>
                      {a.alumni_testimonial ? (
                        <span className="block text-sm text-gray-600 mt-2">"{a.alumni_testimonial}"</span>
                      ) : null}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      <BottomNav />
    </div>
  )
}
