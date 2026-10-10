import { useEffect, useState } from 'react'
import { Mail } from 'lucide-react'
import ControllerShell, { ctl } from '../components/ControllerShell.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { timeAgo } from '../lib/team.js'

export default function ControllerComplaints() {
  const [tab, setTab] = useState('open')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [tab])

  async function load() {
    setLoading(true)
    const { data, error: err } = await supabase.rpc('team_feedback', { p_status: tab })
    if (err) setError(err.message)
    setItems(data ?? [])
    setLoading(false)
  }

  async function setStatus(id, status) {
    setError('')
    const { error: err } = await supabase.rpc('team_resolve_feedback', { p_id: id, p_status: status })
    if (err) { setError(err.message); return }
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  const btn = { background: '#0F1526', border: `1px solid ${ctl.border}`, color: ctl.text }

  return (
    <ControllerShell title="Complaints" allow={['owner', 'support', 'moderator']}>
      <div className="flex gap-2 mb-4">
        {['open', 'resolved'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 rounded-xl py-2 text-xs font-medium capitalize"
            style={tab === t ? { background: ctl.accent, color: '#fff' } : { ...btn, color: ctl.muted }}
          >
            {t}
          </button>
        ))}
      </div>

      {error ? <p className="text-xs mb-3" style={{ color: ctl.bad }}>{error}</p> : null}

      {loading ? (
        <p className="text-center mt-8 text-sm" style={{ color: ctl.muted }}>Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-center mt-8 text-sm" style={{ color: ctl.muted }}>Nothing here.</p>
      ) : (
        <div className="space-y-3">
          {items.map((i) => (
            <div key={i.id} className="rounded-2xl p-4" style={{ background: ctl.card, border: `1px solid ${ctl.border}` }}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium truncate">{i.full_name || 'Schoolink member'}</span>
                <span className="text-[11px] shrink-0 ml-2" style={{ color: ctl.muted }}>{timeAgo(i.created_at)}</span>
              </div>
              <p className="text-sm mt-2 break-words whitespace-pre-wrap">{i.message}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                {i.contact_email ? (
                  <a
                    href={`mailto:${i.contact_email}?subject=${encodeURIComponent('Your message to Schoolink')}`}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs"
                    style={{ background: ctl.accent, color: '#fff' }}
                  >
                    <Mail size={13} /> Reply by email
                  </a>
                ) : null}
                <button
                  onClick={() => setStatus(i.id, tab === 'open' ? 'resolved' : 'open')}
                  className="rounded-lg px-3 py-1.5 text-xs"
                  style={btn}
                >
                  {tab === 'open' ? 'Mark resolved' : 'Reopen'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </ControllerShell>
  )
}
