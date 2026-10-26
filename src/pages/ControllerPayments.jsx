import { useEffect, useState } from 'react'
import { Check, X, Loader2 } from 'lucide-react'
import ControllerShell, { ctl } from '../components/ControllerShell.jsx'
import { supabase } from '../lib/supabaseClient.js'

const FIELDS = [
  ['paynow_enabled', 'Paynow on? (type yes to turn on)', 'yes'],
  ['price_usd', 'Price per month (USD)', '2.99'],
  ['paypal_link', 'PayPal link', 'https://paypal.me/yourname/2.99'],
  ['stripe_link', 'Stripe Payment Link', 'https://buy.stripe.com/…'],
  ['note', 'Note shown to schools', ''],
]

function ago(iso) {
  const m = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
  if (m < 60) return `${m}m ago`
  if (m < 1440) return `${Math.floor(m / 60)}h ago`
  return `${Math.floor(m / 1440)}d ago`
}

export default function ControllerPayments() {
  const [tab, setTab] = useState('pending')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState({})
  const [savingKey, setSavingKey] = useState('')
  const [savedKey, setSavedKey] = useState('')

  async function load() {
    setLoading(true)
    const [p, s] = await Promise.all([
      supabase.rpc('team_pending_payments'),
      supabase.from('payment_settings').select('key, value'),
    ])
    setRows(p.data ?? [])
    const map = {}
    ;(s.data ?? []).forEach((r) => { map[r.key] = r.value })
    setSettings(map)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function review(row, approve) {
    let reason = ''
    if (!approve) {
      const r = window.prompt('Why was it not found? (the school will see this)', 'We could not find this payment.')
      if (r === null) return
      reason = r
    }
    setRows((prev) => prev.filter((x) => x.id !== row.id))
    await supabase.rpc('team_review_payment', { p_id: row.id, p_approve: approve, p_reason: reason })
  }

  async function saveSetting(key) {
    setSavingKey(key)
    await supabase.rpc('team_set_payment_setting', { p_key: key, p_value: (settings[key] || '').trim() })
    setSavingKey('')
    setSavedKey(key)
    setTimeout(() => setSavedKey(''), 1500)
  }

  const card = { background: ctl.card, border: `1px solid ${ctl.border}` }
  const input = { background: '#0F1526', border: `1px solid ${ctl.border}`, color: ctl.text }

  return (
    <ControllerShell title="School payments" allow={['owner']}>
      <div className="flex gap-2 mb-4">
        {[['pending', `To check${rows.length ? ` (${rows.length})` : ''}`], ['settings', 'Payment details']].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className="rounded-full px-4 py-1.5 text-sm font-medium" style={tab === k ? { background: '#7C3AED', color: '#fff' } : { ...card, color: ctl.muted }}>{label}</button>
        ))}
      </div>

      {loading ? <p className="text-center mt-10" style={{ color: ctl.muted }}><Loader2 className="animate-spin inline" /></p> : null}

      {!loading && tab === 'pending' ? (
        rows.length === 0 ? (
          <p className="text-center mt-12 text-sm" style={{ color: ctl.muted }}>No payments waiting.</p>
        ) : rows.map((r) => (
          <div key={r.id} className="rounded-2xl p-4 mb-3" style={card}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold truncate">{r.school_name}</p>
                <p className="text-xs mt-0.5" style={{ color: ctl.muted }}>{r.method} · {r.months} month{r.months > 1 ? 's' : ''} · {ago(r.created_at)}</p>
              </div>
              <p className="text-lg font-bold">${Number(r.amount).toFixed(2)}</p>
            </div>
            <div className="rounded-xl px-3 py-2 mt-3 text-sm" style={{ background: '#0F1526' }}>
              <p>Reference: <span className="font-mono font-semibold">{r.reference}</span></p>
              {r.payer_name ? <p className="text-xs mt-0.5" style={{ color: ctl.muted }}>From: {r.payer_name}</p> : null}
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={() => review(r, false)} className="flex-1 rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5" style={{ border: '1px solid #7f1d1d', color: '#f87171' }}><X size={15} /> Not found</button>
              <button onClick={() => review(r, true)} className="flex-1 rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5 text-white" style={{ background: '#059669' }}><Check size={15} /> Payment received</button>
            </div>
          </div>
        ))
      ) : null}

      {!loading && tab === 'settings' ? (
        <div className="space-y-3">
          <p className="text-xs" style={{ color: ctl.muted }}>Schools only see the methods you fill in. Leave one empty to hide it.</p>
          {FIELDS.map(([key, label, ph]) => (
            <div key={key} className="rounded-2xl p-3" style={card}>
              <p className="text-[11px] uppercase mb-1.5" style={{ color: ctl.muted }}>{label}</p>
              <div className="flex gap-2">
                <input value={settings[key] || ''} onChange={(e) => setSettings((p) => ({ ...p, [key]: e.target.value }))} placeholder={ph} className="flex-1 min-w-0 rounded-xl px-3 py-2.5 text-sm outline-none" style={input} />
                <button onClick={() => saveSetting(key)} className="px-4 rounded-xl text-sm font-semibold text-white" style={{ background: '#7C3AED' }}>
                  {savingKey === key ? <Loader2 size={15} className="animate-spin" /> : savedKey === key ? <Check size={15} /> : 'Save'}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </ControllerShell>
  )
}
