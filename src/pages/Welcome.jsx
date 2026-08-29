import { useEffect } from 'react'
import { GraduationCap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import GoogleIcon from '../components/GoogleIcon.jsx'

export default function Welcome() {
  const navigate = useNavigate()
  const { signInWithGoogle, session, loading } = useAuth()

  useEffect(() => {
    if (session) {
      navigate('/home', { replace: true })
    }
  }, [session, navigate])

  return (
    <div className="flex-1 flex flex-col px-6 pt-14 pb-8">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-10 h-10 rounded-xl bg-brand-purple flex items-center justify-center">
          <GraduationCap className="text-white" size={22} />
        </span>
        <div>
          <h1 className="text-xl font-bold text-brand-purple leading-tight">Schoolink</h1>
          <p className="text-[11px] text-gray-400 -mt-1">Connecting Schools Worldwide</p>
        </div>
      </div>

      <h2 className="text-2xl font-bold mt-8">Welcome to Schoolink</h2>
      <p className="text-gray-500 mt-2">
        Your all-in-one platform for schools, staff, parents and communities.
      </p>

      <div className="flex-1 flex items-center justify-center">
        <div className="text-7xl">🏫</div>
      </div>

      <div className="space-y-3">
        <button
          onClick={() => navigate('/sign-in/email')}
          className="w-full bg-brand-purple text-white font-medium py-3.5 rounded-xl"
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
          onClick={() => navigate('/home')}
          className="w-full font-medium py-3.5 rounded-xl text-gray-600"
        >
          Continue as Guest
        </button>
      </div>

      <p className="text-center text-xs text-gray-400 mt-4">
        By continuing, you agree to our{' '}
        <span className="text-brand-purple">Terms of Service</span> and{' '}
        <span className="text-brand-purple">Privacy Policy</span>
      </p>
    </div>
  )
      }
