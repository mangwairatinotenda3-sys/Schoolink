import { useEffect, useState } from 'react'
import { UserX, MessageCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import BackHeader from '../components/BackHeader.jsx'
import BottomNav from '../components/BottomNav.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { isSchoolMember, canManageStaff } from '../lib/permissions.js'
import { useIsOnline } from '../lib/presence.jsx'

function MemberRow({ member, user, profile, onRemove, navigate }) {
  const isOnline = useIsOnline(member.id)
  const isMe = member.id === user.id

  return (
    <div className="flex items-center justify-between py-4">
      <button
        onClick={() => !isMe && navigate(`/chats/${member.id}`)}
        className="flex items-center gap-3 flex-1 text-left"
      >
        <span className="relative shrink-0">
          {member.avatar_url ? (
            <img src={member.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
          ) : (
            <span className="w-9 h-9 rounded-full bg-brand-light flex items-center justify-center text-sm">🙂</span>
          )}
          {isOnline ? (
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white" />
          ) : null}
        </span>
        <div>
          <p className="font-medium text-sm">{member.full_name || 'Unnamed member'}</p>
          <p className="text-xs text-gray-400">{member.role}</p>
        </div>
      </button>
      <div className="flex items-center gap-3">
        {!isMe ? (
          <button onClick={() => navigate(`/chats/${member.id}`)}>
            <MessageCircle size={18} className="text-brand-purple" />
          </button>
        ) : null}
        {canManageStaff(profile) && member.role !== 'Headteacher' && !isMe ? (
          <button
            onClick={() => onRemove(member)}
            className="flex items-center gap-1 text-red-500 text-xs font-medium"
          >
            <UserX size={16} />
          </button>
        ) : null}
      </div>
    </div>
  )
}

export default function StaffDirectory() {
  const navigate = useNavigate()
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
              <MemberRow key={m.id} member={m} user={user} profile={profile} onRemove={handleRemove} navigate={navigate} />
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  )
  }
