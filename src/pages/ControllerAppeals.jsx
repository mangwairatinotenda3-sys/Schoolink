import { useEffect, useState } from 'react'
import { Check, X, Loader2 } from 'lucide-react'
import ControllerShell, { ctl } from '../components/ControllerShell.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { timeAgo } from '../lib/team.js'

const TABS = [['pending', 'Waiting'], ['approved', 'Approved'], ['rejected', 'Turned down']]
const field = { background: '#0F1526', border: `1px solid ${ctl.border}`, color: ctl.text }

function Face({ a }) {
  const name = a.full_name || a.email || '?'
  return a.avatar_url ? (
    <img src={a.avatar_url} alt="" style={{ width: 42, height: 42, borderRadius: 999, objectFit: 'cover', flexShrink: 0 }} />
  ) : (
    <span style={{ width: 42, height: 42, borderRadius: 999, background: ctl.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>
      {name.trim().charAt(0).toUpperCase()}
    </span>
  )
}

// Owners and moderators decide ban appeals here.
export default function ControllerAppeals() {
  const [tab, setTab] = useState('pending')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [open, setOpen] = useState(null) // { id, kind }
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    const { data } = await supabase.rpc('list_appeals', { p_status: tab })
    if (!data?.ok) { setDenied(true); setItems([]) } else { setDenied(false); setItems(data.items ?? []) }
    setLoading(false)
  }

  useEffect(() => { setOpen(null); load() }, [tab])

  async function submit(a) {
    setBusy(true)
    setError('')
    const { data, error: err } = await supabase.rpc('review_appeal', { p_appeal: a.id, p_decision: open.kind, p_note: note.trim() })
    setBusy(false)
    if (err || !data?.ok) { setError(err?.message || data?.error || 'Could not save. Try again.'); return }
    setItems((prev) => prev.filter((x) => x.id !== a.id))
    setOpen(null)
    setNote('')
  }

  return (
    <ControllerShell title="Ban Appeals" allow={['owner', 'moderator']}>
      <div className="flex gap-2 mb-4">
        {TABS.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className="flex-1 rounded-xl py-2 text-xs font-medium"
            style={tab === k ? { background: ctl.accent, color: '#fff' } : { ...field, color: ctl.muted }}
          >
            {label}
          </button>
        ))}
      </div>

      {denied ? (
        <p className="text-center mt-8 text-sm" style={{ color: ctl.muted }}>Only the owner and moderators can review appeals.</p>
      ) : loading ? (
        <div className="flex justify-center mt-8" style={{ color: ctl.muted }}><Loader2 className="animate-spin" /></div>
      ) : items.length === 0 ? (
        <p className="text-center mt-8 text-sm" style={{ color: ctl.muted }}>{tab === 'pending' ? 'No appeals waiting.' : 'Nothing here yet.'}</p>
      ) : (
        <div className="space-y-3">
          {items.map((a) => (
            <div key={a.id} className="rounded-2xl p-4" style={{ background: ctl.card, border: `1px solid ${ctl.border}` }}>
              <div className="flex items-center gap-3">
                <Face a={a} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{a.full_name || a.email || 'Schoolink member'}</p>
                  <p className="text-[11px] truncate" style={{ color: ctl.muted }}>
                    {[a.role, a.email && a.full_name ? a.email : null, timeAgo(a.created_at)].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {a.source === 'public' ? <span className="text-[10px] font-semibold rounded-full px-2 py-1 shrink-0" style={{ background: 'rgba(245,158,11,0.15)', color: ctl.warn }}>Locked out</span> : null}
              </div>

              {a.ban_reason ? <p className="text-xs mt-3" style={{ color: ctl.muted }}><span className="font-semibold" style={{ color: ctl.text }}>Banned for:</span> {a.ban_reason}</p> : null}
              <p className="text-sm mt-2 whitespace-pre-wrap break-words rounded-xl p-3" style={{ background: '#0F1526', border: `1px solid ${ctl.border}` }}>{a.message}</p>
              {a.earlier > 0 ? <p className="text-xs mt-2" style={{ color: ctl.warn }}>{a.earlier} earlier appeal{a.earlier > 1 ? 's' : ''} from this person</p> : null}

              {a.status !== 'pending' ? (
                <p className="text-xs mt-3" style={{ color: a.status === 'approved' ? ctl.good : ctl.bad }}>
                  {a.status === 'approved' ? 'Ban lifted' : 'Turned down'}{a.decision_note ? `: ${a.decision_note}` : ''}
                </p>
              ) : open?.id === a.id ? (
                <div className="mt-3">
                  <p className="text-xs font-semibold" style={{ color: open.kind === 'approved' ? ctl.good : ctl.bad }}>
                    {open.kind === 'approved' ? 'Lift this ban? Their account works again straight away and they are told.' : 'Turn this down? They are told, and can appeal again after 7 days.'}
                  </p>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={500}
                    placeholder={open.kind === 'approved' ? 'Add a note (optional)' : 'Tell them why (optional)'}
                    className="w-full mt-2 rounded-xl px-3 py-2.5 text-sm outline-none"
                    style={field}
                  />
                  {error ? <p className="text-xs mt-2" style={{ color: ctl.bad }}>{error}</p> : null}
                  <div className="flex gap-2 mt-3">
                    <button disabled={busy} onClick={() => { setOpen(null); setError('') }} className="flex-1 rounded-xl py-2.5 text-sm font-medium disabled:opacity-60" style={{ ...field, color: ctl.muted }}>Cancel</button>
                    <button disabled={busy} onClick={() => submit(a)} className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-60 flex items-center justify-center" style={{ background: open.kind === 'approved' ? ctl.accent : ctl.bad }}>
                      {busy ? <Loader2 size={16} className="animate-spin" /> : open.kind === 'approved' ? 'Lift ban' : 'Turn down'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 mt-3">
                  <button onClick={() => { setOpen({ id: a.id, kind: 'rejected' }); setNote(''); setError('') }} className="flex-1 rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5" style={{ background: 'rgba(239,68,68,0.15)', color: '#FCA5A5' }}><X size={15} /> Turn down</button>
                  <button onClick={() => { setOpen({ id: a.id, kind: 'approved' }); setNote(''); setError('') }} className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white flex items-center justify-center gap-1.5" style={{ background: ctl.accent }}><Check size={15} /> Lift ban</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </ControllerShell>
  )
}
