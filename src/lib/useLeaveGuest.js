import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

// Used by "Sign in" / "Create account" buttons shown to guests:
// ends the guest visit and opens the welcome screen.
export default function useLeaveGuest() {
  const navigate = useNavigate()
  const { signOut } = useAuth()
  return async function leaveGuest() {
    await signOut()
    navigate('/', { replace: true })
  }
        }
