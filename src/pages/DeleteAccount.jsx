import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2, AlertTriangle, Download, Eye, EyeOff } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

const GONE = [
  'Your profile, photos and bio',
  'Your posts, comments, statuses and saved items',
  'Your chats and messages you sent',
  'Your follows, communities and notification settings',
  'Your login history and device notification settings',
]

export default function DeleteAccount() {
  const navigate = useNavigate()
  const { user, teamRole, signOut } = useAuth()
  const isEmail = user?.app_metadata?.provider === 'email' && !user?.is_anonymous
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const blocked = teamRole === 'owner'
  const ready = typed.trim().toUpperCase() === 'DELETE' && (!isEmail || password.length > 0) && !blocked

  async function handleDelete() {
    setError('')
    setBusy(true)

    // Email accounts confirm their password first, so a borrowed phone can't delete the account.
    if (isEmail) {
      const { error: pwError } = await supabase.auth.signInWithPassword({ email: user.email, password })
      if (pwError) {
        setBusy(false)
        setError('That password is not right.')
        return
      }
    }

    const { error: rpcError } = await supabase.rpc('delete_my_account')
    if (rpcError) {
      setBusy(false)
      setError(rpcError.message || 'Could not delete the account. Please try again.')
      return
    }

    try {
      Object.keys(localStorage).filter((k) => k.startsWith('sl_') || k.startsWith('schoolink')).forEach((k) => localStorage.removeItem(k))
    } catch { /* ignore */ }
    await signOut()
    navigate('/', { replace: true })
  }

  return (
    <div className="app-shell">
      <BackHeader title="Delete account" />
      <div className="screen-scroll px-5 pt-2 pb-10">
        <div className="rounded-2xl bg-red-50 p-4 flex gap-3">
          <AlertTriangle size={22} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-700">This cannot be undone</p>
            <p className="text-sm text-red-700/80 mt-1 leading-snug">Your account and the things you made are removed from Schoolink straight away.</p>
          </div>
        </div>

        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mt-6 mb-2">What will be deleted</p>
        <ul className="space-y-2">
          {GONE.map((g) => (
            <li key={g} className="flex gap-2.5 text-sm text-gray-700"><span className="mt-2 w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />{g}</li>
          ))}
        </ul>
        <p className="text-[13px] text-gray-400 mt-3 leading-snug">Reports, bans and appeals may be kept where they protect other people. Marks and records that belong to your school stay with the school.</p>

        <button onClick={() => navigate('/settings/safety')} className="mt-5 w-full flex items-center gap-3 rounded-2xl border border-gray-200 px-4 py-3.5 text-left active:bg-gray-50">
          <Download size={18} className="text-brand-purple" />
          <span className="flex-1">
            <span className="block text-sm font-medium">Download a copy of my data first</span>
            <span className="block text-xs text-gray-400">Do this before deleting</span>
          </span>
        </button>

        {blocked ? (
          <p className="mt-6 text-sm text-amber-700 bg-amber-50 rounded-xl p-3 leading-snug">The Schoolink owner account cannot be deleted from the app.</p>
        ) : (
          <div className="mt-7">
            {isEmail ? (
              <>
                <label className="text-sm font-medium">Your password</label>
                <div className="relative mt-2">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-11 outline-brand-purple"
                  />
                  <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </>
            ) : null}

            <label className="text-sm font-medium block mt-4">Type <b>DELETE</b> to confirm</label>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoCapitalize="characters"
              autoCorrect="off"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 mt-2 outline-brand-purple"
            />
          </div>
        )}

        {error ? <p className="text-red-500 text-sm mt-4">{error}</p> : null}

        <button
          onClick={handleDelete}
          disabled={!ready || busy}
          className="mt-6 w-full flex items-center justify-center gap-2 rounded-full bg-red-500 text-white font-semibold py-3.5 disabled:opacity-40 active:opacity-80"
        >
          <Trash2 size={18} /> {busy ? 'Deleting…' : 'Delete my account'}
        </button>
        <button onClick={() => navigate(-1)} className="mt-3 w-full rounded-full bg-gray-100 font-semibold py-3.5">Keep my account</button>
      </div>
    </div>
  )
}
