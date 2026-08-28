import { useEffect, useState } from 'react'
import { UserX } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function BlockedUsers() {
  const { user } = useAuth()
  const [blocked, setBlocked] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadBlocked()
  }, [])

  async function loadBlocked() {
    setLoading(true)
    const { data } = await supabase
      .from('blocked_users')
      .select('blocked_id, profiles!blocked_users_blocked_id_fkey(full_name, role)')
      .eq('blocker_id', user.id)
    setBlocked(data ?? [])
    setLoading(false)
  }

  async function handleUnblock(blockedId) {
    await supabase.from('blocked_users').delete().eq('blocker_id', user.id).eq('blocked_id', blockedId)
    setBlocked((prev) => prev.filter((b) => b.blocked_id !== blockedId))
  }

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader title="Blocked Users" />
      <div className="screen-scroll px-6 pt-4">
        {loading ? (
          <p className="text-center text-gray-400 mt-8">Loading…</p>
        ) : blocked.length === 0 ? (
          <p className="text-center text-gray-400 mt-8">
            You haven't blocked anyone. Block someone from their chat thread.
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {blocked.map((b) => (
              <div key={b.blocked_id} className="flex items-center justify-between py-3.5">
                <div>
                  <p className="font-medium text-sm">{b.profiles?.full_name || 'Schoolink member'}</p>
                  <p className="text-xs text-gray-400">{b.profiles?.role}</p>
                </div>
                <button
                  onClick={() => handleUnblock(b.blocked_id)}
                  className="flex items-center gap-1 text-brand-purple text-xs font-medium"
                >
                  <UserX size={14} /> Unblock
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
  }
