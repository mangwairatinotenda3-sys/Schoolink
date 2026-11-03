import { useCallback, useEffect, useState } from 'react'
import { Check, X, Clock, RefreshCw } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'

const BUCKET = 'id-verification'

// Schoolink team (owners and verifiers): check student school reports,
// then approve them or send them back with a reason.
export default function StudentReports() {
  const [allowed, setAllowed] = useState(null)
  const [rows, setRows] = useState([])
  const [people, setPeople] = useState({})
  const [schoolNames, setSchoolNames] = useState({})
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState(null)
  const [images, setImages] = useState({})
  const [busyId, setBusyId] = useState(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    // Same people who can use the verification queue: owners and verifiers.
    supabase.rpc('team_role').then(({ data, error }) => {
      setAllowed(!error && (data === 'owner' || data === 'verifier'))
    })
  }, [])

  // silent = true refreshes without the loading state (used for live updates)
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    const { data: reports, error } = await supabase
      .from('student_report_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
    if (error) {
      setMessage("Couldn't load reports. Tap the refresh button to try again.")
      setLoading(false)
      return
    }
    setMessage('')
    const list = reports ?? []
    setRows(list)

    const userIds = [...new Set(list.map((r) => r.user_id))]
    const schoolIds = [...new Set(list.map((r) => r.school_id).filter(Boolean))]
    const [{ data: profiles }, { data: schools }] = await Promise.all([
      userIds.length
        ? supabase.from('profiles').select('id, full_name, username, class_name, admission_no').in('id', userIds)
        : Promise.resolve({ data: [] }),
      schoolIds.length
        ? supabase.from('schools').select('id, name').in('id', schoolIds)
        : Promise.resolve({ data: [] }),
    ])
    setPeople(Object.fromEntries((profiles ?? []).map((p) => [p.id, p])))
    setSchoolNames(Object.fromEntries((schools ?? []).map((s) => [s.id, s.name])))
    setLoading(false)
  }, [])

  useEffect(() => {
    if (allowed) load()
  }, [allowed, load])

  // Live: a new report, or a decision made by another team member, shows up straight away.
  useEffect(() => {
    if (!allowed) return undefined
    let timer = null
    const later = () => {
      clearTimeout(timer)
      timer = setTimeout(() => load(true), 250)
    }
    const channel = supabase
      .channel(`student-reports-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_report_requests' }, later)
      .subscribe()
    const onVisible = () => { if (document.visibilityState === 'visible') later() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(timer)
      supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [allowed, load])

  async function toggle(r) {
    if (openId === r.id) { setOpenId(null); return }
    setOpenId(r.id)
    if (images[r.id]) return
    // Short-lived links (5 minutes). The photos themselves stay private.
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls([r.front_path, r.back_path], 300)
    if (error || !data) { setMessage('Could not load the photos.'); return }
    setImages((prev) => ({ ...prev, [r.id]: { front: data[0]?.signedUrl, back: data[1]?.signedUrl } }))
  }

  async function review(r, approve) {
    let reason = null
    if (!approve) {
      reason = window.prompt('Why is this report not accepted? The student will see this.', '')
      if (reason === null) return
      if (!reason.trim()) { setMessage('Add a reason so the student knows what to fix.'); return }
    }
    setBusyId(r.id)
    setMessage('')
    const { data, error } = await supabase.rpc('review_student_report', { p_id: r.id, p_approve: approve, p_reason: reason })
    setBusyId(null)
    if (error || !data?.ok) { setMessage(data?.error || "Couldn't save. Try again."); return }
    setRows((prev) => prev.filter((x) => x.id !== r.id))
    setOpenId(null)
    setMessage(approve ? 'Student verified' : 'Sent back to the student')
  }

  return (
    <div className="app-shell">
      <BackHeader title="Student reports" />
      <div className="screen-scroll px-4 pt-2 pb-8 space-y-3">
        {allowed === null ? <p className="text-sm text-gray-400 text-center py-8">Checking access…</p> : null}
        {allowed === false ? <p className="text-sm text-gray-500 text-center py-8">This page is for the Schoolink team.</p> : null}

        {allowed ? (
          <>
            <div className="flex items-center justify-between py-1">
              <p className="text-xs text-gray-400">
                {loading ? 'Checking reports…' : rows.length === 0 ? 'Nothing waiting' : `${rows.length} waiting for review`}
              </p>
              <button
                type="button"
                onClick={() => load()}
                aria-label="Refresh reports"
                className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500"
              >
                <RefreshCw size={16} />
              </button>
            </div>

            {message ? <p className="text-sm text-brand-purple text-center">{message}</p> : null}
            {loading ? <p className="text-sm text-gray-400 text-center py-8">Loading…</p> : null}

            {!loading && rows.length === 0 ? (
              <div className="text-center py-12">
                <span className="mx-auto w-14 h-14 rounded-full bg-brand-light flex items-center justify-center">
                  <Clock size={24} className="text-brand-purple" />
                </span>
                <p className="text-sm text-gray-400 mt-3">No student reports waiting.</p>
              </div>
            ) : null}

            {rows.map((r) => {
              const person = people[r.user_id]
              const open = openId === r.id
              const img = images[r.id]
              return (
                <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-3">
                  <button type="button" onClick={() => toggle(r)} className="w-full text-left">
                    <p className="font-semibold text-sm">
                      {person?.full_name || 'Student'}{person?.username ? ` (@${person.username})` : ''}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {schoolNames[r.school_id] || 'No school chosen'}
                      {person?.class_name ? ` · ${person.class_name}` : ''}
                      {person?.admission_no ? ` · Adm ${person.admission_no}` : ''}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">Sent {new Date(r.created_at).toLocaleDateString()}</p>
                  </button>

                  {open ? (
                    <div className="mt-3 space-y-3">
                      {img ? (
                        <>
                          <img src={img.front} alt="Front of report" className="w-full rounded-lg border border-gray-100" />
                          <img src={img.back} alt="Back of report" className="w-full rounded-lg border border-gray-100" />
                        </>
                      ) : (
                        <p className="text-sm text-gray-400">Loading photos…</p>
                      )}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => review(r, true)}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 text-white font-medium rounded-lg py-2.5 disabled:opacity-60"
                        >
                          <Check size={16} /> Approve
                        </button>
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => review(r, false)}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-red-50 text-red-600 font-medium rounded-lg py-2.5 disabled:opacity-60"
                        >
                          <X size={16} /> Send back
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </>
        ) : null}
      </div>
    </div>
  )
         }
