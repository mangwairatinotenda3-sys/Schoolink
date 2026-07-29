import { useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import BottomNav from '../components/BottomNav.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { canManageStaff, isPendingApproval } from '../lib/permissions.js'

export default function PendingApprovals() {
  const { profile } = useAuth()
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.school_id) {
      setLoading(false)
      return
    }
    loadPending()
  }, [profile?.school_id])

  async function loadPending() {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('school_id', profile.school_id)
      .eq('status', 'pending')
    setPending(data ?? [])
    setLoading(false)
  }

  async function handleApprove(p) {
    await supabase.from('profiles').update({ status: 'active' }).eq('id', p.id)
    setPending((prev) => prev.filter((row) => row.id !== p.id))
  }

  async function handleReject(p) {
    await supabase
      .from('profiles')
      .update({ school_id: null, role: null, account_type: 'guest', status: 'active' })
      .eq('id', p.id)
    setPending((prev) => prev.filter((row) => row.id !== p.id))
  }

  if (!canManageStaff(profile)) {
    return (
      <div className="flex-1 flex flex-col">
        <BackHeader title="Pending Approvals" />
        <div className="screen-scroll px-4 flex items-center justify-center text-gray-400 text-center">
          Only Headteachers and Deputy Heads can view this page.
        </div>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader title="Pending Approvals" />
      <div className="screen-scroll px-4">
        {loading ? (
          <p className="text-center text-gray-400 mt-8">Loading…</p>
        ) : pending.length === 0 ? (
          <p className="text-center text-gray-400 mt-8">No pending requests right now.</p>
        ) : (
          <div className="divide-y divide-gray-100 mt-2">
            {pending.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-4">
                <div>
                  <p className="font-medium text-sm">{p.full_name || 'Unnamed member'}</p>
                  <p className="text-xs text-gray-400">{p.role}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleApprove(p)}
                    className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center"
                  >
                    <Check size={16} className="text-green-600" />
                  </button>
                  <button
                    onClick={() => handleReject(p)}
                    className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center"
                  >
                    <X size={16} className="text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  )
  }
