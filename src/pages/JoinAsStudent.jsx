import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { previewInvite, redeemInvite } from '../lib/invites.js'
import { AuthPage, CodeInput, PrimaryButton, Notice } from '../components/AuthKit.jsx'

// Students type their school's join code. The school may need to approve them first.
export default function JoinAsStudent() {
  const navigate = useNavigate()
  const { saveProfileDetails } = useAuth()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)

  const ready = code.trim().length >= 4

  function enterApp(res) {
    if (res.reload) { window.location.hash = '#/home'; window.location.reload(); return }
    navigate('/home', { replace: true })
  }

  async function handleJoin(e) {
    e.preventDefault()
    if (!ready || busy) return
    setBusy(true)
    setError('')
    const peek = await previewInvite(code)
    if (!peek.ok) { setError(peek.error); setBusy(false); return }
    if (peek.kind !== 'student') {
      setError('That is a staff code. Go back and choose "I have a staff invite code".')
      setBusy(false)
      return
    }
    const res = await redeemInvite(code, saveProfileDetails)
    setBusy(false)
    if (!res.ok) { setError(res.error); return }
    if (res.status === 'active') { enterApp(res); return }
    setDone(res)
  }

  if (done) {
    return (
      <AuthPage title="Request sent" back={false}>
        <span className="w-14 h-14 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center">
          <Check size={26} />
        </span>
        <p className="mt-5 text-[15px] leading-relaxed text-gray-600">
          <span className="font-semibold text-brand-navy">{done.school_name}</span> needs to approve your request before you get full access.
        </p>
        <div className="mt-8">
          <PrimaryButton type="button" onClick={() => enterApp(done)}>Continue to Schoolink</PrimaryButton>
        </div>
      </AuthPage>
    )
  }

  return (
    <AuthPage title="Join as a student" subtitle="Enter the student join code from your school.">
      <form onSubmit={handleJoin} noValidate className="space-y-5">
        <CodeInput id="student-code" value={code} onChange={setCode} placeholder="AB12CD34" aria-label="Student join code" />
        {error ? <Notice tone="error">{error}</Notice> : null}
        <PrimaryButton type="submit" disabled={!ready} busy={busy} busyLabel="Checking code…">Join</PrimaryButton>
      </form>
    </AuthPage>
  )
         }
