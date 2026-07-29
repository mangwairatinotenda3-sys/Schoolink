import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function JoinAsStudent() {
  const navigate = useNavigate()
  const { saveProfileDetails } = useAuth()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  async function handleJoin() {
    if (!code.trim()) return
    setBusy(true)
    setError('')

    const { data: school, error: fetchError } = await supabase
      .from('schools')
      .select('*')
      .eq('student_join_code', code.trim().toUpperCase())
      .maybeSingle()

    if (fetchError || !school) {
      setError('Invalid school code. Double check with your school.')
      setBusy(false)
      return
    }

    await saveProfileDetails({
      school_id: school.id,
      role: 'Student',
      account_type: 'school_member',
      status: 'pending',
    })

    setBusy(false)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="flex-1 flex flex-col">
        <BackHeader title="Join as a Student" />
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-2">
          <p className="text-lg font-semibold">Request sent!</p>
          <p className="text-gray-500">
            Your school's admin needs to approve your request before you get full access.
          </p>
          <button
            onClick={() => navigate('/home')}
            className="mt-4 bg-brand-purple text-white font-medium py-3 px-6 rounded-xl"
          >
            Continue to Schoolink
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader title="Join as a Student" />
      <div className="flex-1 flex flex-col px-6 pt-4">
        <p className="text-gray-500">Enter your school's student join code.</p>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="e.g. SPRING2026"
          className="mt-4 border border-gray-200 rounded-xl px-4 py-3.5 outline-brand-purple tracking-widest text-center font-mono"
        />
        {error ? <p className="text-red-500 text-sm mt-3">{error}</p> : null}

        <div className="flex-1" />
        <button
          onClick={handleJoin}
          disabled={busy}
          className="w-full bg-brand-purple text-white font-medium py-3.5 rounded-xl mb-6 disabled:opacity-60"
        >
          {busy ? 'Submitting…' : 'Submit Request'}
        </button>
      </div>
    </div>
  )
    }
