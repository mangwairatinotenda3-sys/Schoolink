import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function JoinSchool() {
  const navigate = useNavigate()
  const { saveProfileDetails } = useAuth()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleJoin() {
    if (!code.trim()) return
    setBusy(true)
    setError('')

    const { data: invite, error: fetchError } = await supabase
      .from('invitations')
      .select('*')
      .eq('code', code.trim().toUpperCase())
      .eq('status', 'pending')
      .maybeSingle()

    if (fetchError || !invite) {
      setError('Invalid or already-used invite code.')
      setBusy(false)
      return
    }

    if (new Date(invite.expires_at) < new Date()) {
      setError('This invite code has expired.')
      setBusy(false)
      return
    }

    await saveProfileDetails({
      school_id: invite.school_id,
      role: invite.role,
      account_type: 'school_member',
    })

    await supabase.from('invitations').update({ status: 'accepted' }).eq('id', invite.id)

    setBusy(false)
    navigate('/home')
  }

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader title="Join Your School" />
      <div className="flex-1 flex flex-col px-6 pt-4">
        <p className="text-gray-500">Enter the invite code your school sent you.</p>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="e.g. AB12CD34"
          className="mt-4 border border-gray-200 rounded-xl px-4 py-3.5 outline-brand-purple tracking-widest text-center font-mono"
        />
        {error ? <p className="text-red-500 text-sm mt-3">{error}</p> : null}

        <div className="flex-1" />
        <button
          onClick={handleJoin}
          disabled={busy}
          className="w-full bg-brand-purple text-white font-medium py-3.5 rounded-xl mb-6 disabled:opacity-60"
        >
          {busy ? 'Joining…' : 'Join School'}
        </button>
      </div>
    </div>
  )
         }
