import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Check,
  X,
  Loader2,
  RefreshCw,
  UserPlus,
  UserCheck,
  WifiOff,
} from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import PersonAvatar from '../components/PersonAvatar.jsx'
import { supabase } from '../lib/supabaseClient.js'

// "2 min ago", "3 h ago", "Yesterday", "12 Oct"
function timeAgo(iso) {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (secs < 60) return 'Just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

function roleLabel(role) {
  if (!role) return 'Member'
  return role.charAt(0).toUpperCase() + role.slice(1)
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-gray-100 animate-pulse">
      <div className="w-12 h-12 rounded-full bg-gray-100 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="h-3.5 w-32 rounded bg-gray-100 mb-2" />
        <div className="h-3 w-20 rounded bg-gray-100" />
      </div>
      <div className="h-9 w-20 rounded-full bg-gray-100" />
    </div>
  )
}

export default function CommunityJoinRequests() {
  const { communityId } = useParams()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [confirmAll, setConfirmAll] = useState(false)
  const [leavingId, setLeavingId] = useState(null)
  const [toast, setToast] = useState(null) // { text, tone }
  const toastTimer = useRef(null)
  const confirmTimer = useRef(null)

  useEffect(() => {
    let alive = true
    loadRequests(() => alive)
    return () => {
      alive = false
      clearTimeout(toastTimer.current)
      clearTimeout(confirmTimer.current)
    }
  }, [communityId])

  function showToast(text, tone = 'ok') {
    clearTimeout(toastTimer.current)
    setToast({ text, tone })
    toastTimer.current = setTimeout(() => setToast(null), 2600)
  }

  async function loadRequests(isAlive = () => true) {
    setLoading(true)
    setLoadFailed(false)
    setLoadError('')

    const { data: reqs, error: reqErr } = await supabase
      .from('community_join_requests')
      .select('id, community_id, user_id, status, created_at')
      .eq('community_id', communityId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    if (!isAlive()) return
    if (reqErr) {
      setLoadError(reqErr.message || '')
      setLoadFailed(true)
      setRequests([])
      setLoading(false)
      return
    }

    const list = reqs ?? []
    const ids = [...new Set(list.map((r) => r.user_id).filter(Boolean))]
    let byId = {}
    if (ids.length) {
      const { data: people } = await supabase
        .from('profiles')
        .select('id, full_name, role, avatar_url')
        .in('id', ids)
      if (!isAlive()) return
      byId = Object.fromEntries((people ?? []).map((p) => [p.id, p]))
    }

    setRequests(list.map((r) => ({ ...r, profiles: byId[r.user_id] || null })))
    setLoading(false)
  }

  function removeWithAnimation(id) {
    setLeavingId(id)
    setTimeout(() => {
      setRequests((prev) => prev.filter((r) => r.id !== id))
      setLeavingId(null)
    }, 220)
  }

  // Approval and rejection go through the server, which checks the person may review
  async function review(req, approve) {
    if (busyId || bulkBusy) return
    setBusyId(req.id)
    const { data, error: err } = await supabase.rpc('community_review_join', {
      p_request: req.id,
      p_approve: approve,
    })
    setBusyId(null)
    if (err || !data?.ok) {
      showToast(err?.message || data?.error || 'Could not do that. Try again.', 'error')
      return
    }
    const name = req.profiles?.full_name || 'Member'
    showToast(approve ? `${name} joined the community` : `Request from ${name} declined`)
    removeWithAnimation(req.id)
  }

  // First tap arms the button, second tap within 4 seconds approves everyone
  async function approveAll() {
    if (bulkBusy || busyId || requests.length === 0) return
    if (!confirmAll) {
      setConfirmAll(true)
      clearTimeout(confirmTimer.current)
      confirmTimer.current = setTimeout(() => setConfirmAll(false), 4000)
      return
    }
    clearTimeout(confirmTimer.current)
    setConfirmAll(false)
    setBulkBusy(true)

    const todo = [...requests]
    let done = 0
    let failed = 0
    let lastMessage = ''
    for (const r of todo) {
      const { data, error: err } = await supabase.rpc('community_review_join', {
        p_request: r.id,
        p_approve: true,
      })
      if (err || !data?.ok) {
        failed += 1
        lastMessage = err?.message || data?.error || ''
      } else {
        done += 1
        setRequests((prev) => prev.filter((x) => x.id !== r.id))
      }
    }
    setBulkBusy(false)
    if (failed === 0) showToast(`${done} ${done === 1 ? 'person' : 'people'} approved`)
    else showToast(`${done} approved, ${failed} failed. ${lastMessage}`.trim(), 'error')
  }

  const count = requests.length
  const disabled = busyId !== null || bulkBusy

  return (
    <div className="app-shell join-root">
      <style>{`
        .join-root, .join-root * { -webkit-tap-highlight-color: transparent; }
        .join-root button:focus { outline: none; }
        .join-card { transition: opacity .22s ease, transform .22s ease, max-height .22s ease; max-height: 140px; }
        .join-card.leaving { opacity: 0; transform: translateX(24px); max-height: 0; margin: 0; padding-top: 0; padding-bottom: 0; }
        .join-press:active { transform: scale(0.96); }
        .join-toast { animation: joinToastIn .22s ease; }
        @keyframes joinToastIn { from { opacity: 0; transform: translate(-50%, 12px); } to { opacity: 1; transform: translate(-50%, 0); } }
      `}</style>

      <BackHeader title="Join Requests" />

      <div className="screen-scroll px-4 pt-3 pb-24">
        {/* Summary */}
        {!loading && !loadFailed && count > 0 ? (
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[15px] font-semibold text-gray-900">
                {count} pending {count === 1 ? 'request' : 'requests'}
              </p>
              <p className="text-xs text-gray-400">Oldest first</p>
            </div>
            <button
              onClick={approveAll}
              disabled={disabled}
              className={`join-press h-9 px-4 rounded-full text-[13px] font-semibold flex items-center gap-1.5 disabled:opacity-50 transition-colors ${
                confirmAll ? 'bg-green-600 text-white' : 'bg-green-50 text-green-700'
              }`}
            >
              {bulkBusy ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <UserCheck size={15} />
              )}
              {bulkBusy ? 'Approving…' : confirmAll ? `Tap again to approve ${count}` : 'Approve all'}
            </button>
          </div>
        ) : null}

        {/* Loading */}
        {loading ? (
          <div className="flex flex-col gap-2.5">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        ) : null}

        {/* Error */}
        {!loading && loadFailed ? (
          <div className="flex flex-col items-center text-center mt-16 px-6">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
              <WifiOff size={28} className="text-red-400" />
            </div>
            <p className="text-base font-semibold text-gray-900">Could not load requests</p>
            {loadError ? <p className="text-xs text-gray-400 mt-1 break-words">{loadError}</p> : null}
            <button
              onClick={() => loadRequests()}
              className="join-press mt-5 h-10 px-5 rounded-full bg-gray-900 text-white text-sm font-semibold flex items-center gap-2"
            >
              <RefreshCw size={15} />
              Try again
            </button>
          </div>
        ) : null}

        {/* Empty */}
        {!loading && !loadFailed && count === 0 ? (
          <div className="flex flex-col items-center text-center mt-20 px-6">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <UserPlus size={28} className="text-gray-400" />
            </div>
            <p className="text-base font-semibold text-gray-900">No pending requests</p>
            <p className="text-sm text-gray-400 mt-1">
              When someone asks to join this community, they will appear here.
            </p>
            <button
              onClick={() => loadRequests()}
              className="join-press mt-5 h-9 px-4 rounded-full bg-gray-100 text-[13px] font-semibold text-gray-700 flex items-center gap-2"
            >
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>
        ) : null}

        {/* List */}
        {!loading && !loadFailed && count > 0 ? (
          <div className="flex flex-col gap-2.5">
            {requests.map((r) => {
              const busy = busyId === r.id
              return (
                <div
                  key={r.id}
                  className={`join-card ${leavingId === r.id ? 'leaving' : ''} rounded-2xl bg-white border border-gray-100 p-3 shadow-sm`}
                >
                  <div className="flex items-center gap-3">
                    <PersonAvatar p={r.profiles} size={48} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[15px] text-gray-900 truncate">
                        {r.profiles?.full_name || 'Schoolink member'}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          {roleLabel(r.profiles?.role)}
                        </span>
                        <span className="text-xs text-gray-400">{timeAgo(r.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => review(r, true)}
                      disabled={disabled}
                      aria-label="Approve"
                      className="join-press flex-1 h-10 rounded-full bg-green-600 text-white text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                      Approve
                    </button>
                    <button
                      onClick={() => review(r, false)}
                      disabled={disabled}
                      aria-label="Decline"
                      className="join-press flex-1 h-10 rounded-full bg-gray-100 text-gray-700 text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <X size={16} />
                      Decline
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : null}
      </div>

      {/* Confirmation message */}
      {toast ? (
        <div
          role="status"
          className={`join-toast fixed left-1/2 bottom-6 -translate-x-1/2 max-w-[88%] px-4 py-2.5 rounded-full text-[13px] font-medium shadow-lg text-white z-50 ${
            toast.tone === 'error' ? 'bg-red-600' : 'bg-gray-900'
          }`}
        >
          {toast.text}
        </div>
      ) : null}
    </div>
  )
}
