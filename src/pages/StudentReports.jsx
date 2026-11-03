import { useEffect, useState } from 'react'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'

const BUCKET = 'id-verification'

// Schoolink team: check student school reports, then approve them or send them back with a reason.
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
    supabase.rpc('is_platform_admin').then(({ data }) => setAllowed(!!data))
  }, [])

  useEffect(() => {
    if (allowed) load()
  }, [allowed])

  async function load() {
    setLoading(true)
    const { data: reports, error } = await supabase
      .from('student_report_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
    if (error) {
      setMessage("Couldn't load reports. Try again.")
      setLoading(false)
      return
    }
    const list = reports ?? []
    setRows(list)

    const userIds = [...new Set(list.map((r) => r.user_id))]
    const schoolIds = [...new Set(list.map((r) => r.school_id).filter(Boolean))]
    const [{ data: profiles }, { data: schools }] = await Promise.all([
      userIds.length ? supabase.from('profiles').select('id, full_name, username').in('id', userIds) : Promise.resolve({ data: [] }),
      schoolIds.length ? supabase.from('schools').select('id, name').in('id', schoolIds) : Promise.resolve({ data: [] }),
    ])
    setPeople(Object.fromEntries((profiles ?? []).map((p) => [p.id, p])))
    setSchoolNames(Object.fromEntries((schools ?? []).map((s) => [s.id, s.name])))
    setLoading(false)
  }

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
      <div className="screen-scroll px-4 pt-3 pb-8 space-y-3">
        {allowed === null ? <p className="text-sm text-gray-400 text-center py-8">Checking access…</p> : null}
        {allowed === false ? <p className="text-sm text-gray-500 text-center py-8">This page is for the Schoolink team.</p> : null}

        {allowed ? (
          <>
            {message ? <p className="text-sm text-brand-purple text-center">{message}</p> : null}
            {loading ? <p className="text-sm text-gray-400 text-center py-8">Loading…</p> : null}
            {!loading && rows.length === 0 ? <p className="text-sm text-gray-400 text-center py-8">No student reports waiting.</p> : null}

            {rows.map((r) => {
              const person = people[r.user_id]
              const open = openId === r.id
              const img = images[r.id]
              return (
                <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-3">
                  <button type="button" onClick={() => toggle(r)} className="w-full text-left">
                    <p className="font-semibold text-sm">{person?.full_name || 'Student'}{person?.username ? ` (@${person.username})` : ''}</p>
                    <p className="text-xs text-gray-500">
                      {schoolNames[r.school_id] || 'No school chosen'} · sent {new Date(r.created_at).toLocaleDateString()}
                    </p>
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
                          className="flex-1 bg-green-600 text-white font-medium rounded-lg py-2.5 disabled:opacity-60"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => review(r, false)}
                          className="flex-1 bg-red-50 text-red-600 font-medium rounded-lg py-2.5 disabled:opacity-60"
                        >
                          Send back
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
