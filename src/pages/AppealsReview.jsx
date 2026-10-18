import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, X, Loader2, Inbox, ShieldCheck } from 'lucide-react'
import ScreenHeader from '../components/ScreenHeader.jsx'
import PersonAvatar from '../components/PersonAvatar.jsx'
import BottomSheet from '../components/BottomSheet.jsx'
import { supabase } from '../lib/supabaseClient.js'

const TABS = [['pending', 'Waiting'], ['approved', 'Approved'], ['rejected', 'Turned down']]

function ago(iso) {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 60) return `${mins} min ago`
  if (mins < 1440) return `${Math.round(mins / 60)} h ago`
  return `${Math.round(mins / 1440)} d ago`
}

// Owner and moderators decide ban appeals here.
export default function AppealsReview() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('pending')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [decide, setDecide] = useState(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(''), 2500)
    return () => clearTimeout(t)
  }, [toast])

  async function load() {
    setLoading(true)
    const { data } = await supabase.rpc('list_appeals', { p_status: tab })
    if (!data?.ok) { setDenied(true); setItems([]) } else { setDenied(false); setItems(data.items ?? []) }
    setLoading(false)
  }

  useEffect(() => { load() }, [tab])

  async function submit() {
    setBusy(true)
    setError('')
    const { data, error: err } = await supabase.rpc('review_appeal', { p_appeal: decide.item.id, p_decision: decide.kind, p_note: note.trim() })
    setBusy(false)
    if (err || !data?.ok) { setError(err?.message || data?.error || 'Could not save. Try again.'); return }
    setToast(decide.kind === 'approved' ? 'Ban lifted' : 'Appeal turned down')
    setDecide(null)
    setNote('')
    load()
  }

  return (
    <div className="app-shell relative">
      <ScreenHeader title="Ban appeals" onBack={() => navigate(-1)} />
      {denied ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-10 text-gray-400">
          <ShieldCheck size={34} />
          <p className="font-semibold text-gray-700 mt-3">Moderators only</p>
          <p className="text-sm mt-1">Ask the Schoolink owner to add you as an appeal reviewer.</p>
        </div>
      ) : (
        <>
          <div className="flex bg-gray-100 rounded-full p-1 mx-4 mt-3 shrink-0">
            {TABS.map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)} className={`flex-1 py-2 text-sm font-semibold rounded-full ${tab === k ? 'bg-white shadow-sm text-brand-purple' : 'text-gray-500'}`}>{label}</button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto px-4 pt-3 pb-10 space-y-3">
            {loading ? <div className="flex justify-center pt-10 text-gray-400"><Loader2 className="animate-spin" /></div> : null}
            {!loading && items.length === 0 ? (
              <div className="flex flex-col items-center text-center pt-16 text-gray-400"><Inbox size={32} /><p className="text-sm mt-3">{tab === 'pending' ? 'No appeals waiting.' : 'Nothing here yet.'}</p></div>
            ) : null}
            {items.map((a) => (
              <div key={a.id} className="rounded-2xl border border-gray-100 p-4">
                <div className="flex items-center gap-3">
                  <PersonAvatar p={a} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{a.full_name || a.email || 'Schoolink member'}</p>
                    <p className="text-xs text-gray-400 truncate">{[a.role, a.email && a.full_name ? a.email : null, ago(a.created_at)].filter(Boolean).join(' · ')}</p>
                  </div>
                  {a.source === 'public' ? <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 rounded-full px-2 py-1 shrink-0">Locked out</span> : null}
                </div>
                {a.ban_reason ? <p className="text-xs text-gray-500 mt-3"><span className="font-semibold">Banned for:</span> {a.ban_reason}</p> : null}
                <p className="text-[15px] mt-2 whitespace-pre-wrap break-words bg-gray-50 rounded-xl p-3">{a.message}</p>
                {a.earlier > 0 ? <p className="text-xs text-amber-600 mt-2">{a.earlier} earlier appeal{a.earlier > 1 ? 's' : ''} from this person</p> : null}
                {a.status !== 'pending' ? (
                  <p className={`text-xs mt-3 ${a.status === 'approved' ? 'text-emerald-600' : 'text-red-500'}`}>
                    {a.status === 'approved' ? 'Approved' : 'Turned down'}{a.decision_note ? `: ${a.decision_note}` : ''}
                  </p>
                ) : (
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => { setDecide({ item: a, kind: 'rejected' }); setNote(''); setError('') }} className="flex-1 rounded-full bg-red-50 text-red-600 font-semibold py-2.5 text-sm flex items-center justify-center gap-1.5"><X size={15} /> Turn down</button>
                    <button onClick={() => { setDecide({ item: a, kind: 'approved' }); setNote(''); setError('') }} className="flex-1 rounded-full bg-brand-purple text-white font-semibold py-2.5 text-sm flex items-center justify-center gap-1.5"><Check size={15} /> Lift ban</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {decide ? (
        <BottomSheet onClose={() => !busy && setDecide(null)}>
          <div className="px-3">
            <p className="font-semibold text-lg">{decide.kind === 'approved' ? 'Lift this ban?' : 'Turn down this appeal?'}</p>
            <p className="text-sm text-gray-500 mt-1">{decide.kind === 'approved' ? 'Their account works again straight away and they are told.' : 'They are told, and can appeal again after 7 days.'}</p>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder={decide.kind === 'approved' ? 'Add a note (optional)' : 'Tell them why (optional)'} className="w-full mt-4 bg-gray-100 rounded-xl px-4 py-3 text-[15px] outline-none" />
            {error ? <p className="text-sm text-red-500 mt-2">{error}</p> : null}
            <button onClick={submit} disabled={busy} className={`w-full mt-4 text-white font-semibold py-3.5 rounded-full disabled:opacity-40 flex items-center justify-center ${decide.kind === 'approved' ? 'bg-brand-purple' : 'bg-red-500'}`}>
              {busy ? <Loader2 size={18} className="animate-spin" /> : decide.kind === 'approved' ? 'Lift ban' : 'Turn down'}
            </button>
            <button onClick={() => setDecide(null)} disabled={busy} className="w-full mt-1 py-3.5 text-gray-500 font-medium">Cancel</button>
          </div>
        </BottomSheet>
      ) : null}

      {toast ? <div className="absolute left-1/2 -translate-x-1/2 z-[70] bg-gray-900 text-white text-sm rounded-full px-4 py-2 shadow-lg" style={{ bottom: 30 }}>{toast}</div> : null}
    </div>
  )
}
