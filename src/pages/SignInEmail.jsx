import { Mail } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackHeader from '../components/BackHeader.jsx'

const LAST_EMAIL_KEY = 'schoolink_last_email'

export default function SignInEmail() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [savedEmail, setSavedEmail] = useState('')
  const [useDifferent, setUseDifferent] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(LAST_EMAIL_KEY)
    if (stored) setSavedEmail(stored)
  }, [])

  function handleContinue(e) {
    e.preventDefault()
    if (!email) return
    navigate('/sign-in/password', { state: { email } })
  }

  function continueWithSaved() {
    navigate('/sign-in/password', { state: { email: savedEmail } })
  }

  if (savedEmail && !useDifferent) {
    return (
      <div className="flex-1 flex flex-col">
        <BackHeader title="Sign in" />
        <div className="flex-1 flex flex-col px-6 pt-10 items-center text-center">
          <span className="w-16 h-16 rounded-2xl bg-brand-light flex items-center justify-center mb-4">
            <Mail className="text-brand-purple" size={28} />
          </span>
          <h2 className="font-semibold text-lg">Welcome back!</h2>
          <p className="text-gray-500 mt-1">Continue with the account you used last time.</p>

          <button onClick={continueWithSaved} className="mt-8 w-full bg-brand-purple text-white font-medium py-3.5 rounded-xl">
            Continue as {savedEmail}
          </button>
          <button onClick={() => setUseDifferent(true)} className="mt-3 w-full font-medium py-3.5 rounded-xl text-gray-500">
            Use a different account
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader title="Sign in with Email" />
      <form onSubmit={handleContinue} className="flex-1 flex flex-col px-6 pt-6">
        <div className="flex justify-center mb-6">
          <span className="w-16 h-16 rounded-2xl bg-brand-light flex items-center justify-center">
            <Mail className="text-brand-purple" size={28} />
          </span>
        </div>
        <h2 className="text-center font-semibold text-lg">Enter your school email address to continue.</h2>

        <label className="text-sm font-medium mt-8 mb-2">Email Address</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@school.com" className="border border-gray-200 rounded-xl px-4 py-3.5 outline-brand-purple" />

        <button type="submit" className="mt-8 w-full bg-brand-purple text-white font-medium py-3.5 rounded-xl">
          Continue
        </button>

        <p className="text-center text-sm text-gray-500 mt-4">New here? Just continue — we'll set up your account automatically.</p>
      </form>
    </div>
  )
}
