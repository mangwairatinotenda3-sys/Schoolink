import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ShieldOff, Clock, XCircle, Hourglass } from 'lucide-react'
import AppealForm from './AppealForm.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

function dayText(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
}

// "You are posting too fast" notice, shown whichever screen the request came from
function LimitToast() {
  const [text, setText] = useState('')
  const timer = useRef(null)

  useEffect(() => {
    function onLimit(e) {
      setText(e.detail?.message || 'You are doing that too fast. Please wait a moment.')
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setText(''), 5000)
    }
    window.addEventListener('schoolink:limit', onLimit)
    return () => { window.removeEventListener('schoolink:limit', onLimit); clearTimeout(timer.current) }
  }, [])

  if (!text) return null
  return (
    <div className="fixed left-0 right-0 z-[90] flex justify-center px-4 pointer-events-none" style={{ top: 'max(14px, env(safe-area-inset-top))' }}>
      <div role="status" className="pointer-events-auto max-w-[440px] w-full flex items-start gap-3 rounded-2xl bg-gray-900 text-white px-4 py-3 shadow-xl" style={{ animation: 'sl-drop 220ms cubic-bezier(.2,.8,.2,1)' }}>
        <style>{'@keyframes sl-drop{from{transform:translateY(-16px);opacity:0}to{transform:none;opacity:1}}'}</style>
        <Clock size={18} className="shrink-0 mt-0.5 text-amber-300" />
        <p className="text-sm leading-snug">{text}</p>
      </div>
    </div>
  )
}

// Full-screen notice for a banned account, with the appeal form
function BannedScreen({ status, onRefresh }) {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const appeal = status.appeal
  const pending = appeal?.status === 'pending'
  const rejected = appeal?.status === 'rejected'

  return (
    <div className="fixed inset-0 z-[100] bg-white flex justify-center overflow-y-auto">
      <div className="w-full max-w-[480px] px-6 pb-10" style={{ paddingTop: 'max(48px, env(safe-area-inset-top))' }}>
        <div className="flex flex-col items-center text-center">
          <span className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center"><ShieldOff size={36} className="text-red-500" /></span>
          <h1 className="text-2xl font-bold mt-5">Your account is suspended</h1>
          <p className="text-sm text-gray-500 mt-2 leading-snug">You cannot use Schoolink while the suspension is on. If you think it is a mistake, you can appeal.</p>
        </div>

        <div className="mt-6 rounded-2xl bg-gray-50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Reason</p>
          <p className="text-[15px] mt-1">{status.reason || 'It broke the Schoolink Terms of Service.'}</p>
          {status.since ? <p className="text-xs text-gray-400 mt-2">Since {dayText(status.since)}</p> : null}
        </div>

        {pending ? (
          <div className="mt-5 rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 text-brand-purple font-semibold"><Hourglass size={18} /> Your appeal is being reviewed</div>
            <p className="text-xs text-gray-400 mt-1">Sent {dayText(appeal.created_at)}</p>
            <p className="text-sm text-gray-600 mt-3 whitespace-pre-wrap break-words bg-gray-50 rounded-xl p-3">{appeal.message}</p>
            <p className="text-sm text-gray-500 mt-3">You do not need to do anything. This screen changes by itself when there is a decision.</p>
            <button onClick={onRefresh} className="mt-3 text-sm font-semibold text-brand-purple">Check now</button>
          </div>
        ) : (
          <div className="mt-5">
            {rejected ? (
              <div className="rounded-2xl bg-red-50 p-4 mb-5">
                <div className="flex items-center gap-2 text-red-600 font-semibold"><XCircle size={18} /> Your last appeal was not approved</div>
                {appeal.decision_note ? <p className="text-sm text-red-700 mt-2 break-words">{appeal.decision_note}</p> : null}
                {!status.can_appeal && status.next_appeal_at ? <p className="text-xs text-red-500 mt-2">You can appeal again on {dayText(status.next_appeal_at)}.</p> : null}
              </div>
            ) : null}
            {status.can_appeal ? <AppealForm onSent={onRefresh} /> : null}
          </div>
        )}

        <div className="mt-8 flex flex-col items-center gap-3">
          <button onClick={() => navigate('/terms')} className="text-sm text-gray-500">Read the Terms of Service</button>
          <button onClick={signOut} className="text-sm font-semibold text-red-500">Sign out</button>
        </div>
      </div>
    </div>
  )
}

// A small link on the sign-in screen for people who are locked out by a ban
function AppealLink() {
  const { session, loading } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  if (loading || session || pathname !== '/') return null
  return (
    <button onClick={() => navigate('/appeal')} className="fixed left-0 right-0 z-[40] text-center text-[11px] text-gray-400 underline" style={{ bottom: 'max(6px, env(safe-area-inset-bottom))' }}>
      Account banned? Send an appeal
    </button>
  )
}

// Put <GlobalGuards /> once inside the app. It watches for slow-down notices and for bans.
export default function GlobalGuards() {
  const { user, profile } = useAuth()
  const { pathname } = useLocation()
  const [status, setStatus] = useState(null)
  const isGuest = !user || user.is_anonymous || profile?.account_type === 'guest'

  const check = useCallback(async () => {
    if (!user || isGuest) { setStatus(null); return }
    const { data } = await supabase.rpc('my_ban_status')
    setStatus(data?.banned ? data : null)
  }, [user?.id, isGuest])

  useEffect(() => {
    check()
    if (!user || isGuest) return undefined
    const t = setInterval(check, 30000)
    const onFocus = () => check()
    window.addEventListener('focus', onFocus)
    window.addEventListener('schoolink:suspended', onFocus)
    return () => { clearInterval(t); window.removeEventListener('focus', onFocus); window.removeEventListener('schoolink:suspended', onFocus) }
  }, [check, user?.id, isGuest])

  return (
    <>
      <LimitToast />
      <AppealLink />
      {status && pathname !== '/terms' && pathname !== '/privacy' ? <BannedScreen status={status} onRefresh={check} /> : null}
    </>
  )
  }
