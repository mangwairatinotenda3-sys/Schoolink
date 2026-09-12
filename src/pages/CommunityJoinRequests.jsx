import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Check, X } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'

export default function CommunityJoinRequests() {
  const { communityId } = useParams()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadRequests()
  }, [communityId])

  async function loadRequests() {
    setLoading(true)
    const { data } = await supabase
      .from('community_join_requests')
      .select('*, profiles(full_name, role, avatar_url)')
      .eq('community_id', communityId)
      .eq('status', 'pending')
    setRequests(data ?? [])
    setLoading(false)
  }

  async function handleApprove(req) {
    await supabase.from('community_members').insert({ community_id: communityId, user_id: req.user_id })
    await supabase.from('community_join_requests').update({ status: 'approved' }).eq('id', req.id)
    setRequests((prev) => prev.filter((r) => r.id !== req.id))
  }

  async function handleReject(req) {
    await supabase.from('community_join_requests').update({ status: 'rejected' }).eq('id', req.id)
    setRequests((prev) => prev.filter((r) => r.id !== req.id))
  }

  return (
    <div className="app-shell">
      <BackHeader title="Join Requests" />
      <div className="screen-scroll px-4 pt-3">
        {loading ? (
          <p className="text-center text-gray-400 mt-8">Loading…</p>
        ) : requests.length === 0 ? (
          <p className="text-center text-gray-400 mt-8">No pending requests.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {requests.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3 min-w-0">
                  {r.profiles?.avatar_url ? (
                    <img src={r.profiles.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                  ) : (
                    <span className="w-10 h-10 rounded-full bg-brand-light flex items-center justify-center shrink-0">🙂</span>
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{r.profiles?.full_name || 'Schoolink member'}</p>
                    <p className="text-xs text-gray-400 truncate">{r.profiles?.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => handleApprove(r)} className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center"><Check size={15} className="text-green-600" /></button>
                  <button onClick={() => handleReject(r)} className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center"><X size={15} className="text-red-500" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
