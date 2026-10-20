import { useEffect, useState } from 'react'
import { RefreshCw, Check, RotateCcw } from 'lucide-react'
import ControllerShell, { ctl } from '../components/ControllerShell.jsx'
import { supabase } from '../lib/supabaseClient.js'

function ago(iso) {
  const m = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
  if (m < 60) return `${m}m ago`
  if (m < 1440) return `${Math.floor(m / 60)}h ago`
  return `${Math.floor(m / 1440)}d ago`
}

export default function ControllerAppHealth() {
  const [tab, setTab] = useState('open')
  const [errors, setErrors] = useState([])
  const [usage, setUsage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(null)

  useEffect(() => { load() }, [tab])

  async function load() {
    setLoading(true)
    const [errRes, useRes] = await Promise.all([
      supabase.rpc('team_client_errors', { p_resolved: tab === 'resolved' }),
      supabase.rpc('team_usage_summary'),
    ])
    setErrors(errRes.data ?? [])
    setUsage(useRes.data || null)
    setLoading(false)
  }

  async function setResolved(id, value) {
    setErrors((prev) => prev.filter((e) => e.id !== id))
    await supabase.rpc('team_resolve_client_error', { p_id: id, p_resolved: value })
  }

  const btn = { background: '#0F1526', border: `1px solid ${ctl.border}`, color: ctl.text }

  return (
    <ControllerShell
      title="App health"
      allow={['owner']}
      right={<button onClick={load} aria-label="Refresh" style={{ color: ctl.muted }}><RefreshCw size={16} /></button>}
    >
      {usage ? (
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[['Phones (7d)', usage.installs_7d], ['Screen views', usage.views_7d], ['Crashes (7d)', usage.crashes_7d]].map(([l, v]) => (
            <div key={l} className="rounded-2xl p-3" style={{ background: ctl.card, border: `1px solid ${ctl.border}` }}>
              <p className="text-xl font-semibold">{Number(v ?? 0).toLocaleString()}</p>
              <p className="text-[11px] mt-0.5" style={{ color: ctl.muted }}>{l}</p>
            </div>
          ))}
        </div>
      ) : null}

      {usage?.top_screens?.length ? (
        <div className="rounded-2xl p-4 mb-5" style={{ background: ctl.card, border: `1px solid ${ctl.border}` }}>
          <p className="text-xs uppercase mb-2" style={{ color: ctl.muted }}>Most used screens (people who opted in)</p>
          {usage.top_screens.map((s) => (
            <div key={s.screen} className="flex justify-between text-sm py-1">
              <span className="truncate">{s.screen}</span>
              <span style={{ color: ctl.muted }}>{s.views}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex gap-2 mb-4">
        {['open', 'resolved'].map((t) => (
          <button key={t} onClick={() => setTab(t)} className="flex-1 rounded-xl py-2 text-xs font-medium capitalize" style={tab === t ? { background: ctl.accent, color: '#fff' } : { ...btn, color: ctl.muted }}>{t}</button>
        ))}
      </div>

      {loading ? (
        <p className="text-center mt-8 text-sm" style={{ color: ctl.muted }}>Loading…</p>
      ) : errors.length === 0 ? (
        <p className="text-center mt-8 text-sm" style={{ color: ctl.muted }}>{tab === 'open' ? 'No crashes reported. 🎉' : 'Nothing here.'}</p>
      ) : (
        <div className="space-y-3">
          {errors.map((e) => (
            <div key={e.id} className="rounded-2xl p-4" style={{ background: ctl.card, border: `1px solid ${ctl.border}` }}>
              <div className="flex justify-between gap-2 text-[11px]" style={{ color: ctl.muted }}>
                <span>{e.platform} · {e.app_version} · {e.route || '/'}</span>
                <span className="shrink-0">{ago(e.created_at)}</span>
              </div>
              <p className="text-sm mt-2 break-words font-medium">{e.message}</p>
              {open === e.id && e.stack ? <pre className="text-[11px] mt-2 whitespace-pre-wrap break-words" style={{ color: ctl.muted }}>{e.stack}</pre> : null}
              <div className="flex gap-2 mt-3">
                {e.stack ? <button onClick={() => setOpen(open === e.id ? null : e.id)} className="rounded-lg px-3 py-1.5 text-xs" style={btn}>{open === e.id ? 'Hide details' : 'Details'}</button> : null}
                <button onClick={() => setResolved(e.id, tab === 'open')} className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs" style={btn}>
                  {tab === 'open' ? <><Check size={13} /> Fixed</> : <><RotateCcw size={13} /> Reopen</>}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </ControllerShell>
  )
    }
