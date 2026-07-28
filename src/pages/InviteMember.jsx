import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

const roles = ['Deputy Head', 'Teacher / Tutor', 'Bursar', 'Librarian', 'ICT Administrator', 'Receptionist', 'School Nurse']

function generateCode() {
  return Math.random().toString(36).slice(2, 10).toUpperCase()
}

export default function InviteMember() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState(roles[0])
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleGenerate() {
    if (!profile?.school_id) {
      setError('You need to belong to a school to invite members.')
      return
    }
    setBusy(true)
    setError('')

    const newCode = generateCode()
    const { error: insertError } = await supabase.from('invitations').insert({
      school_id: profile.school_id,
      email: email || null,
      role,
      code: newCode,
      invited_by: user.id,
    })

    setBusy(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    setCode(newCode)
  }

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader title="Invite a Member" />
      <div className="flex-1 flex flex-col px-6 pt-4">
        <label className="text-sm font-medium mb-2">Their Email (optional)</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="colleague@school.com"
          className="border border-gray-200 rounded-xl px-4 py-3.5 outline-brand-purple"
        />

        <label className="text-sm font-medium mt-4 mb-2">Role</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="border border-gray-200 rounded-xl px-4 py-3.5 outline-brand-purple"
        >
          {roles.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>

        {error ? <p className="text-red-500 text-sm mt-3">{error}</p> : null}

        {code ? (
          <div className="mt-6 bg-brand-light rounded-xl p-4 text-center">
            <p className="text-sm text-gray-500">Share this code with them:</p>
            <p className="text-2xl font-mono font-bold tracking-widest text-brand-purple mt-1">{code}</p>
            <p className="text-xs text-gray-400 mt-2">Valid for 14 days. They'll enter it during sign up.</p>
          </div>
        ) : null}

        <div className="flex-1" />
        <button
          onClick={handleGenerate}
          disabled={busy}
          className="w-full bg-brand-purple text-white font-medium py-3.5 rounded-xl mb-6 disabled:opacity-60"
        >
          {busy ? 'Generating…' : 'Generate Invite Code'}
        </button>
      </div>
    </div>
  )
}
