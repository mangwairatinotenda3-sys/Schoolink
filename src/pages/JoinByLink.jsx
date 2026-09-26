import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

export const PENDING_INVITE_KEY = 'schoolink_pending_invite_code'

// Shared by JoinByLink (this page) and Welcome.jsx (for the "sign up first,
// then finish joining" path). Tries a staff invite code first, then falls
// back to a school's student join code.
export async function applyInviteCode(code, saveProfileDetails) {
  const normalized = code.trim().toUpperCase()

  const { data: invite } = await supabase
    .from('invitations')
    .select('*')
    .eq('code', normalized)
    .eq('status', 'pending')
    .maybeSingle()

  if (invite) {
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return { error: 'This invite link has expired.' }
    }
    const { error } = await saveProfileDetails({
      school_id: invite.school_id,
      role: invite.role,
      account_type: 'school_member',
      status: 'active',
    })
    if (error) return { error: error.message }
    await supabase.from('invitations').update({ status: 'accepted' }).eq('id', invite.id)
    return { success: true }
  }

  const { data: school } = await supabase
    .from('schools')
    .select('id, name')
    .eq('student_join_code', normalized)
    .maybeSingle()

  if (school) {
    // A clicked link (as opposed to a typed-in code elsewhere) came from
    // something the school actively shared, so this joins right away
    // instead of sitting in Pending Approvals.
    const { error } = await saveProfileDetails({
      school_id: school.id,
      role: 'Student',
      account_type: 'school_member',
      status: 'active',
    })
    if (error) return { error: error.message }
    return { success: true, schoolName: school.name }
  }

  return { error: 'This invite link is invalid or has expired.' }
}

export default function JoinByLink() {
  const { code } = useParams()
  const navigate = useNavigate()
  const { user, saveProfileDetails } = useAuth()
  const [status, setStatus] = useState('checking')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!code) return
    if (!user) {
      localStorage.setItem(PENDING_INVITE_KEY, code)
      navigate('/', { replace: true })
      return
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, user])

  async function run() {
    setStatus('joining')
    const result = await applyInviteCode(code, saveProfileDetails)
    if (result.error) {
      setError(result.error)
      setStatus('error')
      return
    }
    setStatus('done')
    setTimeout(() => navigate('/home', { replace: true }), 1200)
  }

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader title="Join School" />
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-2">
        {status === 'checking' || status === 'joining' ? <p className="text-gray-500">Joining your school…</p> : null}
        {status === 'done' ? <p className="text-lg font-semibold text-brand-purple">You're in! 🎉</p> : null}
        {status === 'error' ? (
          <>
            <p className="text-red-500">{error}</p>
            <button onClick={() => navigate('/')} className="mt-4 bg-brand-purple text-white font-medium py-3 px-6 rounded-xl">
              Go to Schoolink
            </button>
          </>
        ) : null}
      </div>
    </div>
  )
  }
