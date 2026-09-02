import { useEffect, useState } from 'react'
import { GraduationCap, Sparkles, Users, BookOpen } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import GoogleIcon from '../components/GoogleIcon.jsx'

export default function Welcome() {
  const navigate = useNavigate()
  const { signInWithGoogle, signInAsGuest, session } = useAuth()
  const [guestBusy, setGuestBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (session) {
      navigate('/home', { replace: true })
    }
  }, [session, navigate])

  async function handleGuest() {
    setGuestBusy(true)
    setError('')
    const { error: guestError } = await signInAsGuest()
    setGuestBusy(false)
    if (guestError) {
      setError("Guest access isn't available right now. Please try again shortly.")
    }
  }

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden">
      <div
        className="px-6 pt-14 pb-10 text-white relative"
        style={{ background: 'linear-gradient(160deg, var(--brand-purple, #6C4CE0) 0%, #241B4E 100%)' }}
      >
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10" />
        <div className="absolute top-24 -left-8 w-24 h-24 rounded-full bg-white/10" />

        <div className="flex items-center gap-3 relative">
          <span className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center">
            <GraduationCap size={26} />
          </span>
          <div>
            <h1 className="text-2xl font-bold leading-tight">Schoolink</h1>
            <p className="text-xs text-white/70">Connecting Schools Worldwide</p>
          </div>
        </div>

        <h2 className="text-3xl font-bold mt-8 leading-tight">
          Where every school<br />finds its voice.
        </h2>
        <p className="text-white/75 mt-3 text-sm max-w-xs">
          One platform for staff, students, parents and communities — built for how schools actually work.
        </p>

        <div className="flex gap-4 mt-6 text-white/80 text-xs">
          <span className="flex items-center gap-1.5">
            <Users size={14} /> Communities
          </span>
          <span className="flex items-center gap-1.5">
            <BookOpen size={14} /> Library
          </span>
          <span className="flex items-center gap-1.5">
            <Sparkles size={14} /> Real-time
          </span>
        </div>
      </div>

      <div className="flex-1 flex flex-col px-6 pt-8">
        {error ? <p className="text-red-500 text-sm text-center mb-3">{error}</p> : null}

        <div className="space-y-3">
          <button
            onClick={() => navigate('/sign-in/email')}
            className="w-full text-white font-medium py-3.5 rounded-xl shadow-lg shadow-brand-purple/20"
            style={{ backgroundColor: 'var(--brand-purple, #6C4CE0)' }}
          >
            Sign in with Email
          </button>
          <button
            onClick={signInWithGoogle}
            className="w-full border border-gray-200 font-medium py-3.5 rounded-xl flex items-center justify-center gap-2"
          >
            <GoogleIcon size={18} />
            Continue with Google
          </button>
          <button
            onClick={handleGuest}
            disabled={guestBusy}
            className="w-full font-medium py-3.5 rounded-xl text-gray-600 bg-gray-50 disabled:opacity-60"
          >
            {guestBusy ? 'Setting up…' : '👋 Continue as Guest'}
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          By continuing, you agree to our{' '}
          <span className="text-brand-purple">Terms of Service</span> and{' '}
          <span className="text-brand-purple">Privacy Policy</span>
        </p>
      </div>
    </div>
  )
    }
