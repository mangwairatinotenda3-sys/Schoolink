import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { GraduationCap, ShieldCheck, Loader2, AlertCircle, Check } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { previewInvite, redeemInvite } from '../lib/invites.js'

export const PENDING_INVITE_KEY = 'schoolink_pending_invite_code'

// Used by Welcome.jsx to finish a join that was started while signed out.
export async function applyInviteCode(code, saveProfileDetails) {
  const res = await redeemInvite(code, saveProfileDetails)
  return res.ok ? { success: true, schoolName: res.school_name, status: res.status } : { error: res.error }
}

function remember(code) {
  try { localStorage.setItem(PENDING_INVITE_KEY, code) } catch { /* private mode */ }
}

export default function JoinByLink() {
  const { code } = useParams()
  const navigate = useNavigate()
  const { user, saveProfileDetails, signOut } = useAuth()
  const isGuest = !!user?.is_anonymous

  const [info, setInfo] = useState(null)
  const [phase, setPhase] = useState('checking')
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  useEffect(() => {
    let live = true
    setPhase('checking')
    previewInvite(code).then((res) => {
      if (!live) return
      setInfo(res)
      setPhase(res.ok ? 'ready' : 'invalid')
    })
    return () => { live = false }
  }, [code])

  async function join() {
    setPhase('joining')
    setError('')
    const res = await redeemInvite(code, saveProfileDetails)
    if (!res.ok) { setError(res.error || 'Could not join.'); setPhase('ready'); return }
    setResult(res)
    setPhase('done')
    setTimeout(() => {
      if (res.reload) { window.location.hash = '#/home'; window.location.reload() } else navigate('/home', { replace: true })
    }, 1600)
  }

  function startSignIn() {
    remember(code)
    navigate('/', { replace: true })
  }

  async function startSignUp() {
    remember(code)
    await signOut()
    navigate('/', { replace: true })
  }

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader title="Join school" />
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        {phase === 'checking' ? <Loader2 className="animate-spin text-brand-purple" /> : null}

        {phase === 'invalid' ? (
          <>
            <span className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center"><AlertCircle size={28} className="text-red-500" /></span>
            <p className="font-semibold text-lg mt-4">Invite not valid</p>
            <p className="text-gray-500 text-sm mt-1 max-w-xs">{info?.error}</p>
            <button onClick={() => navigate(user ? '/home' : '/', { replace: true })} className="mt-6 bg-brand-purple text-white font-medium py-3 px-8 rounded-full">Continue</button>
          </>
        ) : null}

        {phase === 'ready' || phase === 'joining' ? (
          <>
            <span className="w-20 h-20 rounded-full bg-brand-light flex items-center justify-center"><GraduationCap size={34} className="text-brand-purple" /></span>
            <p className="text-sm text-gray-400 mt-5">You have been invited to join</p>
            <p className="font-bold text-2xl mt-1 break-words max-w-xs">{info.school_name}</p>
            <span className="mt-3 text-xs font-semibold text-brand-purple bg-brand-light rounded-full px-3 py-1">As {info.role}</span>
            {info.needs_approval ? <p className="text-sm text-gray-500 mt-4 max-w-xs">The school's admin approves new students before you get full access.</p> : null}

            <div className="mt-6 flex items-start gap-2 text-left bg-gray-50 rounded-xl p-3 max-w-xs">
              <ShieldCheck size={17} className="text-gray-500 shrink-0 mt-0.5" />
              <p className="text-xs text-gray-500">Only join if you know this school. Schoolink never asks for your password, a code from your messages or any payment to join.</p>
            </div>

            {error ? <p className="text-red-500 text-sm mt-4">{error}</p> : null}

            {!user ? (
              <button onClick={startSignIn} className="mt-6 w-full max-w-xs bg-brand-purple text-white font-semibold py-3.5 rounded-full">Sign in or create account to join</button>
            ) : isGuest ? (
              <>
                <p className="text-sm text-gray-500 mt-5 max-w-xs">Guest accounts can't join a school. Create a free account first.</p>
                <button onClick={startSignUp} className="mt-3 w-full max-w-xs bg-brand-purple text-white font-semibold py-3.5 rounded-full">Create an account</button>
              </>
            ) : (
              <button onClick={join} disabled={phase === 'joining'} className="mt-6 w-full max-w-xs bg-brand-purple text-white font-semibold py-3.5 rounded-full disabled:opacity-60 flex items-center justify-center">
                {phase === 'joining' ? <Loader2 size={18} className="animate-spin" /> : `Join ${info.school_name}`}
              </button>
            )}
            <button onClick={() => navigate(user ? '/home' : '/', { replace: true })} className="mt-2 py-3 text-gray-500 font-medium text-sm">Not now</button>
          </>
        ) : null}

        {phase === 'done' && result ? (
          <>
            <span className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center"><Check size={30} className="text-green-600" /></span>
            <p className="text-xl font-bold mt-4">{result.status === 'pending' ? 'Request sent' : result.already ? 'You are already in' : "You're in!"}</p>
            <p className="text-gray-500 text-sm mt-1 max-w-xs">
              {result.status === 'pending' ? `${result.school_name} will approve you soon.` : `Welcome to ${result.school_name}.`}
            </p>
          </>
        ) : null}
      </div>
    </div>
  )
                   }
