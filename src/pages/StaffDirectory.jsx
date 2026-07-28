import { useEffect, useState } from 'react'
import { UserX } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import BottomNav from '../components/BottomNav.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { isSchoolMember, canManageStaff } from '../lib/permissions.js'

export default function StaffDirectory() {
  const { user, profile } = useAuth()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!profile?.school_id) {
      setLoading(false)
      return
    }
    loadMembers()
  }, [profile?.school_id])

  async function loadMembers() {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('school_id', profile.school_id)
      .order('role', { ascending: true })
    setMembers(data ?? [])
    setLoading(false)
  }

  async function handleRemove(member) {
    setError('')
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ school_id: null, role: null, account_type: 'guest' })
      .eq('id', member.id)

    if (updateError) {
      setError(updateError.message)
      return
    }
    setMembers((prev) => prev.filter((m) => m.id !== member.id))
  }

  if (!isSchoolMember(profile)) {
    return (
      <div className="flex-1 flex flex-col">
        <BackHeader title="Staff Directory" />
        <div className="screen-scroll px-4 flex items-center justify-center text-gray-400 text-center">
          You need to belong to a school to view its staff directory.
        </div>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader title="Staff Directory" />
      <div className="screen-scroll px-4">
        {error ? <p className="text-red-500 text-sm mt-3">{error}</p> : null}
        {loading ? (
          <p className="text-center text-gray-400 mt-8">Loading…</p>
        ) : members.length === 0 ? (
          <p className="text-center text-gray-400 mt-8">No members found yet.</p>
        ) : (
          <div className="divide-y divide-gray-100 mt-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-4">
                <div>
                  <p className="font-medium text-sm">{m.full_name || 'Unnamed member'}</p>
                  <p className="text-xs text-gray-400">{m.role}</p>
                </div>
                {canManageStaff(profile) && m.role !== 'Headteacher' && m.id !== user.id ? (
                  <button
                    onClick={() => handleRemove(m)}
                    className="flex items-center gap-1 text-red-500 text-xs font-medium"
                  >
                    <UserX size={16} /> Remove
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  )
}
