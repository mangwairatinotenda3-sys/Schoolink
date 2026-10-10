import { useEffect, useState } from 'react'
import { Search, ShieldCheck } from 'lucide-react'
import ControllerShell, { ctl } from '../components/ControllerShell.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function ControllerUsers() {
  const { teamRole } = useAuth()
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [searched, setSearched] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')

  const canVerify = teamRole === 'owner' || teamRole === 'verifier'
  const canBan = teamRole === 'owner' || teamRole === 'moderator'

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) { setResults([]); setSearched(false); return }
    const t = setTimeout(async () => {
      const { data, error: err } = await supabase.rpc('search_users_for_team', { p_query: term })
      if (err) setError(err.message)
      setResults(data ?? [])
      setSearched(true)
    }, 350)
    return () => clearTimeout(t)
  }, [q])

  function patch(id, changes) {
    setResults((prev) => prev.map((u) => (u.id === id ? { ...u, ...changes } : u)))
  }

  async function toggleVerified(u) {
    setBusyId(u.id)
    setError('')
    const { error: err } = await supabase.rpc('set_user_verified', { p_user_id: u.id, p_verified: !u.is_verified })
    setBusyId(null)
    if (err) { setError(err.message); return }
    patch(u.id, { is_verified: !u.is_verified })
  }

  async function toggleBan(u) {
    let reason = null
    if (!u.is_banned) {
      reason = window.prompt(`Ban ${u.full_name || 'this user'}? Add a reason (only the team sees it):`, '')
      if (reason === null) return
    }
    setBusyId(u.id)
    setError('')
    const { error: err } = await supabase.rpc('set_user_banned', { p_user_id: u.id, p_banned: !u.is_banned, p_reason: reason })
    setBusyId(null)
    if (err) { setError(err.message); return }
    patch(u.id, { is_banned: !u.is_banned })
  }

  return (
    <ControllerShell title="Find a User">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: ctl.muted }} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Name, @username or email"
          className="w-full rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none"
          style={{ background: ctl.card, border: `1px solid ${ctl.border}`, color: ctl.text }}
        />
      </div>

      {error ? <p className="text-xs mt-3" style={{ color: ctl.bad }}>{error}</p> : null}

      <div className="space-y-2 mt-4">
        {searched && results.length === 0 ? (
          <p className="text-center text-sm mt-6" style={{ color: ctl.muted }}>No one found.</p>
        ) : null}

        {results.map((u) => (
          <div key={u.id} className="rounded-2xl p-4" style={{ background: ctl.card, border: `1px solid ${ctl.border}` }}>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium truncate">{u.full_name || 'No name'}</p>
              {u.is_verified ? <ShieldCheck size={14} style={{ color: '#1D9BF0' }} /> : null}
              {u.is_team ? <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: ctl.accent, color: '#fff' }}>Team</span> : null}
              {u.is_banned ? <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: ctl.bad, color: '#fff' }}>Banned</span> : null}
            </div>
            <p className="text-xs" style={{ color: ctl.muted }}>
              {u.username ? `@${u.username} · ` : ''}{u.role || 'No role'}
            </p>
            <p className="text-xs truncate" style={{ color: ctl.muted }}>{u.email}</p>

            {!u.is_team && (canVerify || canBan) ? (
              <div className="flex gap-2 mt-3">
                {canVerify ? (
                  <button
                    disabled={busyId === u.id}
                    onClick={() => toggleVerified(u)}
                    className="rounded-lg px-3 py-1.5 text-xs disabled:opacity-60"
                    style={{ background: '#0F1526', border: `1px solid ${ctl.border}`, color: ctl.text }}
                  >
                    {u.is_verified ? 'Remove blue tick' : 'Give blue tick'}
                  </button>
                ) : null}
                {canBan ? (
                  <button
                    disabled={busyId === u.id}
                    onClick={() => toggleBan(u)}
                    className="rounded-lg px-3 py-1.5 text-xs disabled:opacity-60"
                    style={u.is_banned ? { background: ctl.good, color: '#fff' } : { background: ctl.bad, color: '#fff' }}
                  >
                    {u.is_banned ? 'Unban' : 'Ban'}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </ControllerShell>
  )
}
