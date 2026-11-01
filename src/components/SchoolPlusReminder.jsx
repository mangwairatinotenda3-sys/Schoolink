import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BadgeAlert, CalendarClock, ChevronRight, X } from 'lucide-react'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { canManageStaff } from '../lib/permissions.js'

const WARN_MS = 7 * 86400000
const ENDED_SHOWN_MS = 14 * 86400000
const DISMISS_KEY = 'schoolPlusReminderHidden'

const dayKey = () => new Date().toISOString().slice(0, 10)

function wasHiddenToday(schoolId) {
  try { return localStorage.getItem(`${DISMISS_KEY}:${schoolId}`) === dayKey() } catch { return false }
}

function hideForToday(schoolId) {
  try { localStorage.setItem(`${DISMISS_KEY}:${schoolId}`, dayKey()) } catch { /* storage blocked: it just shows again */ }
}

const fmtDate = (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

// Shown to the headteacher and deputy when School Plus is about to end, or has just ended.
export default function SchoolPlusReminder({ schoolId }) {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const isHead = canManageStaff(profile)
  const [sub, setSub] = useState(null)
  const [hidden, setHidden] = useState(() => !!schoolId && wasHiddenToday(schoolId))

  useEffect(() => {
    if (!schoolId || !isHead) return
    supabase.from('school_subscriptions').select('expires_at, is_promo').eq('school_id', schoolId).maybeSingle()
      .then(({ data }) => setSub(data ?? null))
  }, [schoolId, isHead])

  if (!isHead || !sub || hidden) return null

  const end = Date.parse(sub.expires_at)
  const now = Date.now()
  const left = end - now
  const daysLeft = Math.ceil(left / 86400000)

  let tone
  let title
  let body
  if (left > 0 && left <= WARN_MS) {
    tone = 'amber'
    title = `School Plus ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`
    body = `It runs out on ${fmtDate(sub.expires_at)}. Renew now and the new time is added to your current end date, so you lose nothing.`
  } else if (left <= 0 && now - end <= ENDED_SHOWN_MS) {
    tone = 'red'
    title = 'School Plus has ended'
    body = 'Your school is not showing the verified badge right now. Renew to switch it back on.'
  } else {
    return null
  }

  const onPlans = pathname.includes('verification')
  function renew() {
    if (onPlans) document.getElementById('school-plus-plans')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    else navigate('/school-settings/verification')
  }

  function hide() {
    hideForToday(schoolId)
    setHidden(true)
  }

  const red = tone === 'red'
  return (
    <div role="status" className={`mx-4 mt-3 rounded-2xl border p-4 ${red ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
      <div className="flex items-start gap-3">
        <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${red ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>
          {red ? <BadgeAlert size={18} /> : <CalendarClock size={18} />}
        </span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold ${red ? 'text-red-700' : 'text-amber-800'}`}>{title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-gray-600">{body}</p>
          <button onClick={renew} className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-brand-purple px-3.5 py-1.5 text-xs font-semibold text-white active:scale-95 transition-transform">
            Renew School Plus <ChevronRight size={14} />
          </button>
        </div>
        <button onClick={hide} aria-label="Hide for today" className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 shrink-0 active:bg-black/5">
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
