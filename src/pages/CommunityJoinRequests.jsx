import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Check, X, Loader2, RefreshCw } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import PersonAvatar from '../components/PersonAvatar.jsx'
import { supabase } from '../lib/supabaseClient.js'

export default function CommunityJoinRequests() {
  const { communityId } = useParams()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    let alive = true
    loadRequests(() => alive)
    return () => { alive = false }
  }, [communityId])

  async function loadRequests(isAlive = () => true) {
    setLoading(true)
    setError('')
    setLoadFailed(false)

    // Step 1: the requests themselves
    const { data: reqs, error: reqErr } = await supabase
      .from('community_join_requests')
      .select('id, community_id, user_id, status, created_at')
      .eq('community_id', communityId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    if (!isAlive()) return
    if (reqErr) {
      setError(`Could not load requests. ${reqErr.message || ''}`.trim())
      setLoadFailed(true)
      setRequests([])
      setLoading(false)
      return
    }

    // Step 2: the people who asked. If this fails the list still shows.
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

  // Approval and rejection go through the server, which checks the person may review
  async function review(req, approve) {
    setBusyId(req.id)
    setError('')
    const { data, error: err } = await supabase.rpc('community_review_join', {
      p_request: req.id,
      p_approve: approve,
    })
    setBusyId(null)
    if (err || !data?.ok) {
      setError(err?.message || data?.error || 'Could not do that. Try again.')
      return
    }
    setRequests((prev) => prev.filter((r) => r.id !== req.id))
  }

  return (
    <div className="app-shell">
      <BackHeader title="Join Requests" />
      <div className="screen-scroll px-4 pt-3">
        {error ? (
          <p role="alert" className="text-sm text-red-500 mb-2">{error}</p>
        ) : null}

        {loading ? (
          <p className="text-center text-gray-400 mt-8">Loading…</p>
        ) : loadFailed ? (
          <div className="flex justify-center mt-6">
            <button
              onClick={() => loadRequests()}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 text-sm font-medium"
            >
              <RefreshCw size={15} />
              Try again
            </button>
          </div>
        ) : requests.length === 0 ? (
          <p className="text-center text-gray-400 mt-8">No pending requests.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {requests.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <PersonAvatar p={r.profiles} size={40} />
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">
                      {r.profiles?.full_name || 'Schoolink member'}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{r.profiles?.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {busyId === r.id ? (
                    <Loader2 size={18} className="animate-spin text-gray-400 mx-2" />
                  ) : (
                    <>
                      <button
                        onClick={() => review(r, true)}
                        disabled={busyId !== null}
                        aria-label="Approve"
                        className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center disabled:opacity-40"
                      >
                        <Check size={15} className="text-green-600" />
                      </button>
                      <button
                        onClick={() => review(r, false)}
                        disabled={busyId !== null}
                        aria-label="Turn down"
                        className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center disabled:opacity-40"
                      >
                        <X size={15} className="text-red-500" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
        }
