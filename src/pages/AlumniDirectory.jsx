import { useEffect, useState } from 'react'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function AlumniDirectory() {
  const { profile } = useAuth()
  const [alumni, setAlumni] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (profile?.school_id) loadAlumni()
  }, [profile?.school_id])

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

  return (
    <div className="app-shell">
      <BackHeader title="Alumni" />
      <div className="screen-scroll px-4 pt-3">
        {loading ? (
          <p className="text-center text-gray-400 mt-8">Loading…</p>
        ) : alumni.length === 0 ? (
          <p className="text-center text-gray-400 mt-8">No alumni have joined from this school yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {alumni.map((a) => (
              <div key={a.id} className="flex items-start gap-3 py-3.5">
                {a.avatar_url ? (
                  <img src={a.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
                ) : (
                  <span className="w-11 h-11 rounded-full bg-brand-light flex items-center justify-center text-lg shrink-0">🎓</span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm">{a.full_name || 'Alumni member'}</p>
                  <p className="text-xs text-gray-400">
                    {[a.graduation_year ? `Class of ${a.graduation_year}` : null, a.occupation].filter(Boolean).join(' · ')}
                  </p>
                  {a.alumni_testimonial ? <p className="text-sm text-gray-600 mt-1">"{a.alumni_testimonial}"</p> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
