import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { previewInvite, redeemInvite } from '../lib/invites.js'

// Students type their school's join code. The school decides whether an admin approves them first.
export default function JoinAsStudent() {
  const navigate = useNavigate()
  const { saveProfileDetails } = useAuth()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)

  async function handleJoin() {
    if (code.trim().length < 4 || busy) return
    setBusy(true)
    setError('')
    const peek = await previewInvite(code)
    if (!peek.ok) { setError(peek.error); setBusy(false); return }
    if (peek.kind !== 'student') { setError('That is a staff code. Go back and choose "Join as staff".'); setBusy(false); return }
    const res = await redeemInvite(code, saveProfileDetails)
    setBusy(false)
    if (!res.ok) { setError(res.error); return }
    if (res.status === 'active') {
      if (res.reload) { window.location.hash = '#/home'; window.location.reload(); return }
      navigate('/home', { replace: true })
      return
    }
    setDone(res)
  }

  if (done) {
    return (
      <div className="flex-1 flex flex-col">
        <BackHeader title="Join as a student" />
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-2">
          <p className="text-lg font-semibold">Request sent!</p>
          <p className="text-gray-500">{done.school_name} needs to approve your request before you get full access.</p>
          <button onClick={() => { if (done.reload) { window.location.hash = '#/home'; window.location.reload() } else navigate('/home', { replace: true }) }} className="mt-4 bg-brand-purple text-white font-medium py-3 px-6 rounded-xl">
            Continue to Schoolink
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader title="Join as a student" />
      <div className="flex-1 flex flex-col px-6 pt-4">
        <p className="text-gray-500">Enter your school's student join code.</p>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
          placeholder="e.g. AB12CD34"
          autoCapitalize="characters"
          className="mt-4 border border-gray-200 rounded-xl px-4 py-3.5 outline-brand-purple tracking-widest text-center font-mono"
        />
        {error ? <p className="text-red-500 text-sm mt-3">{error}</p> : null}
        <div className="flex-1" />
        <button onClick={handleJoin} disabled={busy || code.trim().length < 4} className="w-full bg-brand-purple text-white font-medium py-3.5 rounded-xl mb-6 disabled:opacity-60 flex items-center justify-center">
          {busy ? <Loader2 size={18} className="animate-spin" /> : 'Join'}
        </button>
      </div>
    </div>
  )
}
