import { useEffect, useState } from 'react'
import { UserPlus } from 'lucide-react'
import useLeaveGuest from '../lib/useLeaveGuest.js'

// The "sign in to continue" box. It opens when a guest tries to do something
// only members can do (follow, like, comment, download, ...).
export default function GuestPrompt() {
  const leaveGuest = useLeaveGuest()
  const [reason, setReason] = useState(null)

  useEffect(() => {
    const open = (e) => setReason(e.detail?.reason || 'action')
    window.addEventListener('schoolink:guest-blocked', open)
    return () => window.removeEventListener('schoolink:guest-blocked', open)
  }, [])

  if (!reason) return null

  const text = reason === 'download'
    ? 'Sign in to download files and photos.'
    : 'Sign in or create an account to follow people, like, comment, chat and post.'

  return (
    <div
      onClick={() => setReason(null)}
      style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 480, background: '#fff', color: '#111827', borderRadius: '20px 20px 0 0', padding: '24px 20px 28px' }}
      >
        <div
          style={{ width: 52, height: 52, borderRadius: 999, background: '#EDE9FE', color: '#6D28D9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}
        >
          <UserPlus size={26} />
        </div>
        <p style={{ textAlign: 'center', fontWeight: 700, fontSize: 18, marginTop: 12 }}>Join Schoolink</p>
        <p style={{ textAlign: 'center', fontSize: 14, color: '#6B7280', marginTop: 6 }}>{text}</p>
        <button
          onClick={leaveGuest}
          style={{ width: '100%', marginTop: 18, padding: '12px 0', borderRadius: 12, background: '#6D28D9', color: '#fff', fontWeight: 600 }}
        >
          Sign in
        </button>
        <button
          onClick={leaveGuest}
          style={{ width: '100%', marginTop: 8, padding: '12px 0', borderRadius: 12, border: '1px solid #D1D5DB', color: '#111827', fontWeight: 600 }}
        >
          Create account
        </button>
        <button
          onClick={() => setReason(null)}
          style={{ width: '100%', marginTop: 8, padding: '10px 0', color: '#6B7280', fontSize: 14 }}
        >
          Not now
        </button>
      </div>
    </div>
  )
            }
