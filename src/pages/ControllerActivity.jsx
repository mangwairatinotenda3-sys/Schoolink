import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import ControllerShell, { ctl } from '../components/ControllerShell.jsx'
import { supabase } from '../lib/supabaseClient.js'

const groups = [
  {
    title: 'People',
    items: [
      ['users', 'Total users'],
      ['new_users_7d', 'New this week'],
      ['active_7d', 'Active this week'],
      ['verified_users', 'Verified people'],
      ['banned', 'Banned'],
    ],
  },
  {
    title: 'Schools and posts',
    items: [
      ['schools', 'Schools'],
      ['verified_schools', 'Verified schools'],
      ['posts', 'Posts'],
      ['posts_7d', 'Posts this week'],
    ],
  },
  {
    title: 'Needs attention',
    items: [
      ['pending_verifications', 'Verification requests'],
      ['pending_reports', 'Open reports'],
      ['open_feedback', 'Open complaints'],
      ['team', 'Team members'],
    ],
  },
]

export default function ControllerActivity() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.rpc('site_stats')
    setStats(data || null)
    setLoading(false)
  }

  return (
    <ControllerShell
      title="Site Activity"
      allow={['owner']}
      right={<button onClick={load} style={{ color: ctl.muted }}><RefreshCw size={16} /></button>}
    >
      {loading ? (
        <p className="text-center mt-8 text-sm" style={{ color: ctl.muted }}>Loading…</p>
      ) : !stats ? (
        <p className="text-center mt-8 text-sm" style={{ color: ctl.muted }}>Could not load the numbers.</p>
      ) : (
        groups.map((g) => (
          <div key={g.title} className="mb-5">
            <p className="text-xs uppercase mb-2" style={{ color: ctl.muted }}>{g.title}</p>
            <div className="grid grid-cols-2 gap-2">
              {g.items.map(([key, label]) => (
                <div key={key} className="rounded-2xl p-4" style={{ background: ctl.card, border: `1px solid ${ctl.border}` }}>
                  <p className="text-2xl font-semibold">{Number(stats[key] ?? 0).toLocaleString()}</p>
                  <p className="text-xs mt-1" style={{ color: ctl.muted }}>{label}</p>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </ControllerShell>
  )
}
