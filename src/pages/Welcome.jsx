import { useEffect, useState } from 'react'
import { GraduationCap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import GoogleIcon from '../components/GoogleIcon.jsx'

export default function Welcome() {
  const navigate = useNavigate()
  const { signInWithGoogle, signInAsGuest, session } = useAuth()
  const [guestBusy, setGuestBusy] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (session) {
      navigate('/home', { replace: true })
    }
  }, [session, navigate])

  async function handleGoogle() {
    setGoogleBusy(true)
    setError('')
    const { error: googleError } = await signInWithGoogle()
    if (googleError) {
      setError(googleError.message)
    }
    setGoogleBusy(false)
  }

  async function handleGuest() {
    setGuestBusy(true)
    setError('')
    const { error: guestError } = await signInAsGuest()
    if (guestError) {
      setError(guestError.message)
    }
    setGuestBusy(false)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white p-6">
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center mb-6">
          <GraduationCap className="w-16 h-16 text-blue-600" />
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to Schoolink</h1>
        <p className="text-gray-600 mb-8">Connect with your school community</p>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={handleGoogle}
            disabled={googleBusy}
            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 text-gray-700 font-medium py-3 px-4 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
          >
            <GoogleIcon />
            {googleBusy ? 'Signing in...' : 'Continue with Google'}
          </button>

          <button
            onClick={handleGuest}
            disabled={guestBusy}
            className="w-full bg-blue-600 text-white font-medium py-3 px-4 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {guestBusy ? 'Signing in...' : 'Continue as Guest'}
          </button>
        </div>

        <p className="text-xs text-gray-500 mt-6">
          Guest accounts have limited access. Sign up later to save your data.
        </p>
      </div>
    </div>
  )
}
