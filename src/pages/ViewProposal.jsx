import { useEffect, useState } from 'react'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { canManageStaff } from '../lib/permissions.js'

export default function ViewProposals() {
  const { profile } = useAuth()
  const [proposals, setProposals] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (profile?.school_id) loadProposals()
  }, [profile?.school_id])

  async function loadProposals() {
    setLoading(true)
    const { data } = await supabase.from('investor_proposals').select('*').eq('school_id', profile.school_id).order('created_at', { ascending: false })
    setProposals(data ?? [])
    setLoading(false)
  }

  async function updateStatus(id, status) {
    await supabase.from('investor_proposals').update({ status }).eq('id', id)
    loadProposals()
  }

  if (!canManageStaff(profile)) {
    return (
      <div className="app-shell">
        <BackHeader title="Investor Proposals" />
        <div className="screen-scroll px-6 flex items-center justify-center text-center text-gray-400">
          Only school leadership can view this.
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <BackHeader title="Investor Proposals" />
      <div className="screen-scroll px-4 pt-3">
        {loading ? (
          <p className="text-center text-gray-400 mt-8">Loading…</p>
        ) : proposals.length === 0 ? (
          <p className="text-center text-gray-400 mt-8">No proposals yet.</p>
        ) : (
          <div className="space-y-3">
            {proposals.map((p) => (
              <div key={p.id} className="border border-gray-100 rounded-xl p-4">
                <p className="font-semibold text-sm">{p.investor_name}</p>
                <p className="text-sm text-gray-600 mt-1">{p.message}</p>
                <select value={p.status} onChange={(e) => updateStatus(p.id, e.target.value)} className="mt-2 text-xs border border-gray-200 rounded-lg px-2 py-1">
                  <option value="pending">Pending</option>
                  <option value="reviewing">Reviewing</option>
                  <option value="accepted">Accepted</option>
                  <option value="declined">Declined</option>
                </select>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
