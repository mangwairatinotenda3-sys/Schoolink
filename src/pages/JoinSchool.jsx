import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { previewInvite, redeemInvite } from '../lib/invites.js'
import { AuthPage, CodeInput, PrimaryButton, Notice } from '../components/AuthKit.jsx'

// Staff type the invite code their school sent them.
export default function JoinSchool() {
  const navigate = useNavigate()
  const { saveProfileDetails } = useAuth()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const ready = code.trim().length >= 4

  async function handleJoin(e) {
    e.preventDefault()
    if (!ready || busy) return
    setBusy(true)
    setError('')
    const peek = await previewInvite(code)
    if (!peek.ok) { setError(peek.error); setBusy(false); return }
    if (peek.kind !== 'staff') {
      setError('That is a student code. Go back and choose "Join as a student".')
      setBusy(false)
      return
    }
    const res = await redeemInvite(code, saveProfileDetails)
    setBusy(false)
    if (!res.ok) { setError(res.error); return }
    if (res.reload) { window.location.hash = '#/home'; window.location.reload(); return }
    navigate('/home', { replace: true })
  }

  return (
    <AuthPage
      title="Join your school"
      subtitle="Enter the staff invite code your school sent you. It is usually 8 characters."
    >
      <form onSubmit={handleJoin} noValidate className="space-y-5">
        <CodeInput id="staff-code" value={code} onChange={setCode} placeholder="AB12CD34" aria-label="Staff invite code" />
        {error ? <Notice tone="error">{error}</Notice> : null}
        <PrimaryButton type="submit" disabled={!ready} busy={busy} busyLabel="Checking code…">Join school</PrimaryButton>
      </form>
    </AuthPage>
  )
}
