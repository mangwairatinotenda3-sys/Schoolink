import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, FileText, Inbox, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabaseClient.js'

const C = {
  bg: '#0B1020', card: '#131A2C', raised: '#1B2338', border: '#222D45',
  accent: '#5B5BD6', accentText: '#A5B4FC', text: '#E8ECF8', muted: '#8A94B0',
  ok: '#34D399', bad: '#F87171',
}

const DOC_LABELS = {
  registration_certificate: 'Ministry of Education certificate',
  head_id: 'ID of person responsible',
  proof_of_address: 'Proof of address',
  school_logo: 'School logo',
}

const when = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '')

function Skeleton() {
  return (
    <div aria-busy="true" className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-32 rounded-2xl" style={{ background: C.raised }} />
      ))}
    </div>
  )
}

export default function ControllerSchoolReviews() {
  const navigate = useNavigate()
  const [items, setItems] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [rejectFor, setRejectFor] = useState(null)
  const [picked, setPicked] = useState([])
  const [note, setNote] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [msg, setMsg] = useState(null)

  const load = useCallback(async () => {
    setRefreshing(true)
    setLoadError('')
    const { data, error } = await supabase.rpc('team_verification_queue')
    setRefreshing(false)
    if (error || !data?.ok) {
      setLoadError(error?.message || data?.error || 'Could not load reviews.')
      setItems((prev) => prev ?? [])
      return
    }
    setItems(data.items || [])
  }, [])

  useEffect(() => { load() }, [load])

  async function openFile(path) {
    const { data, error } = await supabase.storage.from('verification-docs').createSignedUrl(path, 300)
    if (error || !data?.signedUrl) {
      setMsg({ tone: 'error', text: error?.message || 'Could not open the file.' })
      return
    }
    const a = document.createElement('a')
    a.href = data.signedUrl
    a.target = '_blank'
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  async function decide(item, args, okText) {
    setBusyId(item.id)
    setMsg(null)
    const { data, error } = await supabase.rpc('team_review_verification', args)
    setBusyId(null)
    if (error || !data?.ok) {
      setMsg({ tone: 'error', text: data?.error || error?.message || 'Could not save. Try again.' })
      return
    }
    setMsg({ tone: 'ok', text: okText })
    setRejectFor(null)
    setPicked([])
    setNote('')
    load()
  }

  function approve(item) {
    if (!window.confirm(`Approve ${item.name}? The school can then pay for the blue badge.`)) return
    decide(item, { p_school: item.id, p_decision: 'approve', p_rejected: [], p_note: null }, `${item.name} approved. The school can now pay.`)
  }

  function sendBack(item) {
    if (!picked.length || !note.trim()) return
    decide(item, { p_school: item.id, p_decision: 'reject', p_rejected: picked, p_note: note.trim() }, `Sent back to ${item.name}.`)
  }

  function togglePick(type) {
    setPicked((p) => (p.includes(type) ? p.filter((x) => x !== type) : [...p, type]))
  }

  return (
    <div className="min-h-screen" style={{ background: C.bg, color: C.text }}>
      <div className="mx-auto max-w-[560px] px-4 pb-16" style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
        <div className="flex items-center gap-3 py-3">
          <button onClick={() => navigate(-1)} aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: C.card }}>
            <ArrowLeft size={18} />
          </button>
          <h1 className="flex-1 text-lg font-bold">School reviews</h1>
          <button onClick={load} disabled={refreshing} aria-label="Refresh" className="flex h-10 w-10 items-center justify-center rounded-full disabled:opacity-50" style={{ background: C.card }}>
            <RefreshCw size={16} />
          </button>
        </div>

        {msg ? (
          <div role="alert" className="mb-4 rounded-2xl px-4 py-3 text-sm" style={{ background: C.card, color: msg.tone === 'ok' ? C.ok : C.bad, border: `1px solid ${C.border}` }}>
            {msg.text}
          </div>
        ) : null}

        {loadError ? (
          <div className="mt-6 text-center">
            <p className="text-sm" style={{ color: C.muted }}>{loadError}</p>
            <button onClick={load} className="mt-4 rounded-xl px-5 py-2.5 text-sm font-semibold text-white" style={{ background: C.accent }}>Try again</button>
          </div>
        ) : items === null ? (
          <Skeleton />
        ) : items.length === 0 ? (
          <div className="mt-16 flex flex-col items-center text-center">
            <Inbox size={36} style={{ color: C.muted }} />
            <p className="mt-3 font-semibold">Nothing waiting</p>
            <p className="mt-1 text-sm" style={{ color: C.muted }}>New school documents will show up here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const docs = item.docs || []
              const rejecting = rejectFor === item.id
              const busy = busyId === item.id
              return (
                <div key={item.id} className="rounded-2xl p-4" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                  <p className="font-bold">{item.name}</p>
                  <p className="mt-0.5 text-xs" style={{ color: C.muted }}>
                    {[item.location, item.school_type].filter(Boolean).join(' · ') || 'No location'} · Sent {when(item.submitted_at)}
                  </p>

                  <div className="mt-3">
                    {docs.map((d) => (
                      <div key={d.type} className="flex items-center justify-between py-2.5" style={{ borderTop: `1px solid ${C.border}` }}>
                        <span className="flex min-w-0 items-center gap-2 text-sm">
                          <FileText size={15} style={{ color: C.muted }} />
                          <span className="truncate">{DOC_LABELS[d.type] || d.type}</span>
                        </span>
                        <button onClick={() => openFile(d.path)} className="text-sm font-semibold" style={{ color: C.accentText }}>View</button>
                      </div>
                    ))}
                  </div>

                  {!rejecting ? (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        onClick={() => approve(item)}
                        disabled={busy}
                        className="flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-50"
                        style={{ background: C.accent }}
                      >
                        <Check size={15} /> Approve
                      </button>
                      <button
                        onClick={() => { setRejectFor(item.id); setPicked([]); setNote('') }}
                        disabled={busy}
                        className="rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
                        style={{ border: `1px solid ${C.border}`, color: C.text }}
                      >
                        Send back
                      </button>
                    </div>
                  ) : (
                    <div className="mt-3">
                      <p className="text-xs font-semibold" style={{ color: C.muted }}>Which documents need a new file?</p>
                      <div className="mt-2 space-y-2">
                        {docs.map((d) => {
                          const on = picked.includes(d.type)
                          return (
                            <button
                              key={d.type}
                              onClick={() => togglePick(d.type)}
                              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm"
                              style={{ background: C.raised, border: `1px solid ${on ? C.accent : C.border}` }}
                            >
                              <span className="flex h-5 w-5 items-center justify-center rounded" style={{ background: on ? C.accent : 'transparent', border: `1px solid ${on ? C.accent : C.muted}` }}>
                                {on ? <Check size={12} /> : null}
                              </span>
                              {DOC_LABELS[d.type] || d.type}
                            </button>
                          )
                        })}
                      </div>
                      <label htmlFor={`note-${item.id}`} className="mt-3 block text-xs font-semibold" style={{ color: C.muted }}>Reason the school will see</label>
                      <textarea
                        id={`note-${item.id}`}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={3}
                        placeholder="For example: the ID photo is blurry. Please upload a clear photo of the front."
                        className="mt-1.5 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                        style={{ background: C.raised, border: `1px solid ${C.border}`, color: C.text }}
                      />
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button onClick={() => setRejectFor(null)} className="rounded-xl py-3 text-sm font-semibold" style={{ border: `1px solid ${C.border}` }}>Cancel</button>
                        <button
                          onClick={() => sendBack(item)}
                          disabled={busy || !picked.length || !note.trim()}
                          className="rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-40"
                          style={{ background: C.bad }}
                        >
                          Send back
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
  }
