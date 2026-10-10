import { useEffect, useState } from 'react'
import { Check, X as XIcon, Eye, Flag, ShieldCheck } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import VerifiedBadge, { refreshVerifiedIds } from '../components/VerifiedBadge.jsx'
import { supabase } from '../lib/supabaseClient.js'

const BUCKET = 'id-verification'

function norm(s) {
  return String(s || '').toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim()
}

export default function AdminVerification() {
  const [allowed, setAllowed] = useState(null)
  const [tab, setTab] = useState('pending')
  const [requests, setRequests] = useState([])
  const [verifiedUsers, setVerifiedUsers] = useState([])
  const [verifiedSchools, setVerifiedSchools] = useState([])
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
  }, [allowed, tab])

  async function load() {
    setLoading(true)
    if (tab === 'pending') {
      const { data } = await supabase
        .from('verification_requests')
        .select('*, profiles!inner(full_name, username, avatar_url), schools(name, location)')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
      setRequests(data ?? [])
    } else {
      const [{ data: users }, { data: schools }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, username, avatar_url').eq('is_verified', true).order('full_name', { ascending: true }).limit(200),
        supabase.from('schools').select('id, name, location').eq('verified', true).order('name', { ascending: true }).limit(200),
      ])
      setVerifiedUsers(users ?? [])
      setVerifiedSchools(schools ?? [])
    }
    setLoading(false)
  }

  async function toggleReview(r) {
    if (openId === r.id) { setOpenId(null); return }
    setOpenId(r.id)
    if (images[r.id]) return
    // Short-lived links (5 minutes) — the files themselves stay private.
    const paths = [r.id_path, r.selfie_path].filter(Boolean)
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 300)
    if (error || !data) { setMessage('Could not load the documents.'); return }
    setImages((prev) => ({ ...prev, [r.id]: { doc: data[0]?.signedUrl, selfie: r.selfie_path ? data[1]?.signedUrl : null } }))
  }

  // Once decided, the photos are deleted — we keep the decision, not the documents.
  async function deleteDocuments(r) {
    const paths = [r.id_path, r.selfie_path].filter(Boolean)
    if (!paths.length) return
    const { error } = await supabase.storage.from(BUCKET).remove(paths)
    if (error) { setMessage('Decision saved, but the photos could not be deleted. Remove them in Supabase Storage.'); return }
    await supabase.rpc('clear_verification_documents', { p_request_id: r.id })
  }

  async function decide(r, approve) {
    const isSchool = r.subject_type === 'school'
    const label = isSchool ? r.schools?.name || r.legal_name : r.legal_name
    let reason = null
    if (approve) {
      const check = isSchool ? 'the school name and document' : 'the name, face and document'
      if (!window.confirm(`Approve ${label}? Check that ${check} all match.`)) return
    } else {
      reason = window.prompt('Reason shown to the user (e.g. "Photo unclear", "Name does not match", "Document expired"):')
      if (!reason || !reason.trim()) return
    }
    setBusyId(r.id)
    setMessage('')
    const { error } = await supabase.rpc('review_verification', { p_request_id: r.id, p_approve: approve, p_reason: reason })
    if (error) {
      setBusyId(null)
      setMessage(error.message)
      return
    }
    await deleteDocuments(r)
    await refreshVerifiedIds(true)
    setRequests((prev) => prev.filter((x) => x.id !== r.id))
    setOpenId(null)
    setBusyId(null)
  }

  async function removeUserTick(person) {
    if (!window.confirm(`Remove the verified badge from ${person.full_name || 'this user'}?`)) return
    setBusyId(person.id)
    const { error } = await supabase.rpc('revoke_verification', { p_user_id: person.id })
    setBusyId(null)
    if (error) { setMessage(error.message); return }
    await refreshVerifiedIds(true)
    setVerifiedUsers((prev) => prev.filter((p) => p.id !== person.id))
  }

  async function removeSchoolTick(school) {
    if (!window.confirm(`Remove the verified badge from ${school.name}?`)) return
    setBusyId(school.id)
    const { error } = await supabase.rpc('revoke_school_verification', { p_school_id: school.id })
    setBusyId(null)
    if (error) { setMessage(error.message); return }
    await refreshVerifiedIds(true)
    setVerifiedSchools((prev) => prev.filter((s) => s.id !== school.id))
  }

  if (allowed === null) {
    return (
      <div className="app-shell">
        <BackHeader title="Verification" />
        <div className="screen-scroll flex items-center justify-center text-gray-400">Loading…</div>
      </div>
    )
  }

  if (!allowed) {
    return (
      <div className="app-shell">
        <BackHeader title="Verification" />
        <div className="screen-scroll px-6 flex items-center justify-center text-center text-gray-400">
          This page is for Schoolink administrators only.
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <BackHeader title="Verification" />
      <div className="flex gap-5 px-4 border-b border-gray-100">
        {[['pending', 'Pending'], ['verified', 'Verified']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => { setTab(key); setOpenId(null) }}
            className={`pb-2 text-sm font-medium border-b-2 ${tab === key ? 'border-brand-purple text-brand-purple' : 'border-transparent text-gray-400'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="screen-scroll px-4 pt-3">
        {message ? <p className="text-sm text-red-500 mb-3">{message}</p> : null}

        {loading ? (
          <p className="text-center text-gray-400 mt-8">Loading…</p>
        ) : tab === 'pending' ? (
          requests.length === 0 ? (
            <p className="text-center text-gray-400 mt-8">No requests waiting.</p>
          ) : (
            <div className="space-y-3">
              {requests.map((r) => {
                const isSchool = r.subject_type === 'school'
                const comparedName = isSchool ? r.schools?.name : r.profiles?.full_name
                const nameMatches = norm(r.legal_name) === norm(comparedName)
                const imgs = images[r.id]
                return (
                  <div key={r.id} className="border border-gray-100 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      {r.profiles?.avatar_url ? (
                        <img src={r.profiles.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <span className="w-10 h-10 rounded-full bg-brand-light flex items-center justify-center">{isSchool ? '🏫' : '🙂'}</span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">
                          {isSchool ? `🏫 ${r.schools?.name || 'School'}` : r.profiles?.full_name || 'No profile name'}
                        </p>
                        <p className="text-xs text-gray-400">
                          {isSchool ? `School registration · by ${r.profiles?.full_name || 'Headteacher'}` : r.doc_type === 'passport' ? 'Passport' : 'National ID'} · {new Date(r.created_at).toLocaleString()}
                        </p>
                      </div>
                      <button onClick={() => toggleReview(r)} className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-2 text-sm">
                        <Eye size={14} /> {openId === r.id ? 'Hide' : 'Review'}
                      </button>
                    </div>

                    <p className={`text-xs mt-3 flex items-center gap-1.5 ${nameMatches ? 'text-green-600' : 'text-amber-600'}`}>
                      {nameMatches ? <Check size={13} /> : <Flag size={13} />}
                      {isSchool ? 'School name on application' : 'Name on application'}: <span className="font-medium">{r.legal_name}</span>
                      {nameMatches ? (isSchool ? ' (matches school profile)' : ' (matches profile)') : (isSchool ? ' (differs from school profile)' : ' (differs from profile name)')}
                    </p>

                    {openId === r.id ? (
                      <div className="mt-3 space-y-3">
                        {imgs ? (
                          <>
                            <div>
                              <p className="text-xs font-semibold text-gray-400 uppercase mb-1">{isSchool ? 'Registration document' : 'ID document'}</p>
                              <img src={imgs.doc} alt="Document" className="w-full max-h-80 object-contain rounded-lg border border-gray-100" />
                            </div>
                            {imgs.selfie ? (
                              <div>
                                <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Selfie</p>
                                <img src={imgs.selfie} alt="Selfie" className="w-full max-h-80 object-contain rounded-lg border border-gray-100" />
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <p className="text-sm text-gray-400">Loading documents…</p>
                        )}
                        <ul className="text-xs text-gray-400 list-disc pl-4 space-y-0.5">
                          {isSchool ? (
                            <>
                              <li>School name on the document matches the name above</li>
                              <li>Official stamp or signature is present and looks genuine</li>
                              <li>The requester is the school's Headteacher</li>
                            </>
                          ) : (
                            <>
                              <li>Name on the ID matches the name above</li>
                              <li>Face on the ID matches the selfie</li>
                              <li>Document looks genuine, unaltered and not expired</li>
                            </>
                          )}
                        </ul>
                        <div className="flex gap-2">
                          <button
                            onClick={() => decide(r, false)}
                            disabled={busyId === r.id}
                            className="flex-1 flex items-center justify-center gap-1.5 border border-red-200 text-red-500 rounded-lg py-2.5 text-sm disabled:opacity-60"
                          >
                            <XIcon size={14} /> Reject
                          </button>
                          <button
                            onClick={() => decide(r, true)}
                            disabled={busyId === r.id}
                            className="flex-1 flex items-center justify-center gap-1.5 bg-brand-purple text-white rounded-lg py-2.5 text-sm disabled:opacity-60"
                          >
                            <Check size={14} /> Approve
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )
        ) : verifiedUsers.length === 0 && verifiedSchools.length === 0 ? (
          <p className="text-center text-gray-400 mt-8">Nobody is verified yet.</p>
        ) : (
          <>
            {verifiedSchools.length > 0 ? (
              <>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Schools</p>
                <div className="divide-y divide-gray-100 mb-4">
                  {verifiedSchools.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 py-3">
                      <span className="w-10 h-10 rounded-full bg-brand-light flex items-center justify-center">🏫</span>
                      <p className="flex-1 min-w-0 text-sm font-medium truncate flex items-center gap-1.5">
                        {s.name} <VerifiedBadge schoolId={s.id} size={15} />
                      </p>
                      <button
                        onClick={() => removeSchoolTick(s)}
                        disabled={busyId === s.id}
                        className="flex items-center gap-1 border border-gray-200 text-gray-500 rounded-lg px-3 py-1.5 text-xs disabled:opacity-60"
                      >
                        <ShieldCheck size={13} /> Remove tick
                      </button>
                    </div>
                  ))}
                </div>
              </>
            ) : null}

            {verifiedUsers.length > 0 ? (
              <>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-1">People</p>
                <div className="divide-y divide-gray-100">
                  {verifiedUsers.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 py-3">
                      {p.avatar_url ? (
                        <img src={p.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <span className="w-10 h-10 rounded-full bg-brand-light flex items-center justify-center">🙂</span>
                      )}
                      <p className="flex-1 min-w-0 text-sm font-medium truncate flex items-center gap-1.5">
                        {p.full_name || 'Schoolink member'} <VerifiedBadge userId={p.id} size={15} />
                      </p>
                      <button
                        onClick={() => removeUserTick(p)}
                        disabled={busyId === p.id}
                        className="flex items-center gap-1 border border-gray-200 text-gray-500 rounded-lg px-3 py-1.5 text-xs disabled:opacity-60"
                      >
                        <ShieldCheck size={13} /> Remove tick
                      </button>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
