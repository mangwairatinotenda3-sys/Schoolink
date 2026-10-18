import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { previewInvite, redeemInvite } from '../lib/invites.js'

// Staff type the code their school sent them.
export default function JoinSchool() {
  const navigate = useNavigate()
  const { saveProfileDetails } = useAuth()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleJoin() {
    if (code.trim().length < 4 || busy) return
    setBusy(true)
    setError('')
    const peek = await previewInvite(code)
    if (!peek.ok) { setError(peek.error); setBusy(false); return }
    if (peek.kind !== 'staff') { setError('That is a student code. Go back and choose "Join as a student".'); setBusy(false); return }
    const res = await redeemInvite(code, saveProfileDetails)
    setBusy(false)
    if (!res.ok) { setError(res.error); return }
    if (res.reload) { window.location.hash = '#/home'; window.location.reload(); return }
    navigate('/home', { replace: true })
  }

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader title="Join your school" />
      <div className="flex-1 flex flex-col px-6 pt-4">
        <p className="text-gray-500">Enter the invite code your school sent you.</p>
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
          {busy ? <Loader2 size={18} className="animate-spin" /> : 'Join school'}
        </button>
      </div>
    </div>
  )
      }
