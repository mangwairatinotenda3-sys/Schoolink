import { useEffect, useRef, useState } from 'react'
import { BadgeCheck, Search, X, RefreshCw } from 'lucide-react'
import ControllerShell, { ctl, CtlSkeletonRows } from '../components/ControllerShell.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { refreshVerifiedIds } from '../components/VerifiedBadge.jsx'

const FILTERS = [
  { key: 'all', label: 'All', value: null },
  { key: 'verified', label: 'Verified', value: true },
  { key: 'open', label: 'Not verified', value: false },
]

function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

const chipStyle = (on) => ({
  padding: '7px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
  background: on ? ctl.accent : ctl.card, color: on ? '#fff' : ctl.muted,
  border: `1px solid ${on ? ctl.accent : ctl.border}`,
})

const actionStyle = (kind) => ({
  padding: '8px 12px', borderRadius: 10, fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap',
  ...(kind === 'primary'
    ? { background: ctl.accent, color: '#fff', border: `1px solid ${ctl.accent}` }
    : kind === 'danger'
      ? { background: 'transparent', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.45)' }
      : { background: 'transparent', color: ctl.muted, border: `1px solid ${ctl.border}` }),
})

function IconBtn({ label, onClick, children }) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      style={{
        width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: ctl.muted, background: ctl.card, border: `1px solid ${ctl.border}`,
      }}
    >
      {children}
    </button>
  )
}

export default function ControllerVerifySchool() {
  const { teamRole } = useAuth()
  const allowed = teamRole === 'owner' || teamRole === 'verifier'

  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [rows, setRows] = useState(null)         // null = loading, shows the skeleton
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(null)     // { tone, text }
  const [confirm, setConfirm] = useState(null)   // { id, verify }
  const [busyId, setBusyId] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const reqId = useRef(0)

  const term = q.trim()
  const value = FILTERS.find((f) => f.key === filter)?.value ?? null

  // Every search, filter change and refresh shows the skeleton first.
  useEffect(() => {
    if (!allowed) return undefined
    const id = ++reqId.current
    const t = setTimeout(async () => {
      setRows(null)
      setError('')
      setConfirm(null)
      const { data, error: e } = await supabase.rpc('team_search_schools', { p_query: term, p_verified: value, p_limit: 40 })
      if (id !== reqId.current) return
      if (e) {
        setError(e.message)
        setRows([])
        return
      }
      setRows(Array.isArray(data) ? data : [])
    }, term ? 300 : 0)
    return () => clearTimeout(t)
  }, [term, filter, reloadKey, allowed])

  async function act(school, verify) {
    setBusyId(school.id)
    setNotice(null)
    const { data, error: e } = await supabase.rpc('team_set_school_verified', { p_school_id: school.id, p_verified: verify })
    setBusyId(null)
    setConfirm(null)
    if (e || !data?.ok) {
      setNotice({ tone: 'error', text: data?.error || e?.message || 'Could not update the school. Try again.' })
      return
    }
    setRows((prev) => (prev || [])
      .map((r) => (r.id === school.id ? { ...r, verified: verify } : r))
      .filter((r) => value === null || r.verified === value))
    setNotice({ tone: 'ok', text: verify ? `${school.name} is now verified.` : `Tick removed from ${school.name}.` })
    refreshVerifiedIds(true)
  }

  const noticeStyle = notice?.tone === 'ok'
    ? { background: 'rgba(34,197,94,0.12)', color: '#86EFAC', border: '1px solid rgba(34,197,94,0.35)' }
    : { background: 'rgba(239,68,68,0.12)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.35)' }

  const countText = rows && !error && rows.length
    ? `${rows.length} ${rows.length === 1 ? 'school' : 'schools'}${term ? ` matching "${term}"` : ''}`
    : ''

  return (
    <ControllerShell
      title="Verify a School"
      allow={['owner', 'verifier']}
      right={<IconBtn label="Refresh" onClick={() => setReloadKey((k) => k + 1)}><RefreshCw size={16} /></IconBtn>}
    >
      {/* search */}
      <div style={{ position: 'relative' }}>
        <Search size={17} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: ctl.faint }} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by school name"
          aria-label="Search by school name"
          style={{
            width: '100%', height: 48, borderRadius: 14, background: ctl.card, border: `1px solid ${ctl.border}`,
            color: ctl.text, paddingLeft: 42, paddingRight: 44, fontSize: 15, outline: 'none',
          }}
        />
        {q ? (
          <button
            aria-label="Clear search"
            onClick={() => setQ('')}
            style={{
              position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', width: 30, height: 30,
              borderRadius: 999, color: ctl.muted, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>
        ) : null}
      </div>

      {/* filters */}
      <div className="flex gap-2 mt-3 overflow-x-auto">
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={chipStyle(filter === f.key)}>{f.label}</button>
        ))}
      </div>

      {notice ? (
        <div className="mt-3 rounded-xl px-4 py-3" style={{ ...noticeStyle, fontSize: 13 }}>{notice.text}</div>
      ) : null}

      <p style={{ fontSize: 12, color: ctl.muted, margin: '14px 4px 8px', minHeight: 16 }}>{countText}</p>

      {/* results */}
      {rows === null ? (
        <div aria-busy="true" aria-label="Searching schools"><CtlSkeletonRows rows={5} /></div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '32px 16px' }}>
          <p style={{ fontSize: 14, color: ctl.muted }}>{error}</p>
          <button onClick={() => setReloadKey((k) => k + 1)} style={{ ...actionStyle('primary'), marginTop: 14 }}>Try again</button>
        </div>
      ) : rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 16px' }}>
          <p style={{ fontSize: 14, color: ctl.muted }}>
            {term ? `No school matches "${term}".` : 'No schools found.'}
          </p>
          <p style={{ fontSize: 12, color: ctl.faint, marginTop: 6 }}>Try part of the name, such as "Primary" or "High".</p>
        </div>
      ) : (
        <div style={{ background: ctl.card, border: `1px solid ${ctl.border}`, borderRadius: 16, overflow: 'hidden' }}>
          {rows.map((s, i) => {
            const busy = busyId === s.id
            const asking = confirm?.id === s.id
            return (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3.5" style={{ borderTop: i ? `1px solid ${ctl.border}` : 'none' }}>
                <span
                  style={{
                    width: 40, height: 40, borderRadius: 12, flexShrink: 0, fontSize: 13, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: s.verified ? 'rgba(14,165,233,0.15)' : ctl.raised,
                    color: s.verified ? '#38BDF8' : ctl.muted,
                  }}
                >
                  {initials(s.name)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="flex items-center gap-1.5" style={{ fontSize: 14.5, fontWeight: 600, color: ctl.text }}>
                    <span className="truncate">{s.name}</span>
                    {s.verified ? <BadgeCheck size={15} style={{ color: '#38BDF8', flexShrink: 0 }} /> : null}
                  </p>
                  <p className="truncate" style={{ fontSize: 12, color: ctl.muted, marginTop: 2 }}>
                    {s.location || 'No location added'} · {s.verified ? 'Verified' : 'Not verified'}
                  </p>
                </div>

                {asking ? (
                  <div className="flex gap-2">
                    <button onClick={() => setConfirm(null)} disabled={busy} style={actionStyle('ghost')}>Cancel</button>
                    <button
                      onClick={() => act(s, confirm.verify)}
                      disabled={busy}
                      style={actionStyle(confirm.verify ? 'primary' : 'danger')}
                    >
                      {busy ? 'Saving' : confirm.verify ? 'Verify' : 'Remove'}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirm({ id: s.id, verify: !s.verified })}
                    disabled={busy}
                    style={actionStyle(s.verified ? 'ghost' : 'primary')}
                  >
                    {busy ? 'Saving' : s.verified ? 'Remove tick' : 'Verify'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      <p style={{ fontSize: 11.5, color: ctl.faint, marginTop: 18, lineHeight: 1.5 }}>
        Verified schools show the blue tick across Schoolink. Only the owner and verifiers can change it.
      </p>
    </ControllerShell>
  )
  }
