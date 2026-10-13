import { useEffect, useMemo, useState } from 'react'
import { Copy, Check, RefreshCw, Trash2, UserPlus, Users, Share2 } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import BottomNav from '../components/BottomNav.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

function toDateString(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function prettyDate(value) {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

const DOT = { present: 'bg-green-500', absent: 'bg-red-500', late: 'bg-amber-500', excused: 'bg-sky-500' }

function Avatar({ url }) {
  return url ? (
    <img src={url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
  ) : (
    <span className="w-10 h-10 rounded-full bg-brand-light flex items-center justify-center shrink-0">🙂</span>
  )
}

// ---------------------------------------------------------------- Parent view
function ParentView({ user }) {
  const [links, setLinks] = useState([])
  const [kids, setKids] = useState({})
  const [records, setRecords] = useState([])
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  async function load() {
    const { data: linkRows } = await supabase.from('parent_links').select('*').eq('parent_id', user.id).order('created_at', { ascending: false })
    const list = linkRows ?? []
    setLinks(list)
    const ids = list.map((l) => l.student_id)
    if (ids.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', ids)
      setKids(Object.fromEntries((profiles ?? []).map((p) => [p.id, p])))
      const first = new Date()
      first.setDate(1)
      const { data: att } = await supabase
        .from('attendance_records')
        .select('*')
        .in('student_id', ids)
        .gte('attendance_date', toDateString(first))
        .order('attendance_date', { ascending: false })
      setRecords(att ?? [])
    } else {
      setKids({})
      setRecords([])
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [user.id])

  async function handleLink() {
    if (!code.trim() || busy) return
    setBusy(true)
    setError('')
    setMessage('')
    const { data, error: rpcError } = await supabase.rpc('link_child_by_code', { p_code: code.trim() })
    setBusy(false)
    if (rpcError) {
      setError(rpcError.message.replace(/^.*?:\s*/, '') || 'That code did not work.')
      return
    }
    setCode('')
    setMessage(`${data || 'Your child'} is now linked to your account.`)
    load()
  }

  async function handleRemove(linkId) {
    if (!window.confirm('Remove this child from your account?')) return
    await supabase.from('parent_links').delete().eq('id', linkId)
    load()
  }

  return (
    <div className="screen-scroll px-4 pt-3 pb-6">
      <div className="rounded-2xl border border-gray-100 p-4">
        <p className="font-semibold text-sm flex items-center gap-2"><UserPlus size={16} className="text-brand-purple" /> Add your child</p>
        <p className="text-xs text-gray-500 mt-1">Ask your child to open Schoolink → More → Family. They will see a family code. Type it here.</p>
        <div className="flex gap-2 mt-3">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleLink()}
            placeholder="Family code"
            maxLength={12}
            autoCapitalize="characters"
            className="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm tracking-widest outline-brand-purple"
          />
          <button onClick={handleLink} disabled={busy || !code.trim()} className="bg-brand-purple text-white text-sm font-medium px-4 rounded-lg disabled:opacity-60">{busy ? '…' : 'Link'}</button>
        </div>
        {error ? <p className="text-red-500 text-xs mt-2">{error}</p> : null}
        {message ? <p className="text-green-600 text-xs mt-2 flex items-center gap-1"><Check size={13} /> {message}</p> : null}
      </div>

      <p className="text-xs font-semibold text-gray-400 uppercase mt-5 mb-2">My children</p>
      {loading ? (
        <p className="text-center text-gray-400 mt-6">Loading…</p>
      ) : links.length === 0 ? (
        <div className="text-center text-gray-400 mt-6">
          <Users size={28} className="mx-auto mb-2" />
          <p className="text-sm">No children linked yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {links.map((l) => {
            const kid = kids[l.student_id]
            const mine = records.filter((r) => r.student_id === l.student_id)
            const counts = { present: 0, absent: 0, late: 0, excused: 0 }
            mine.forEach((r) => { if (counts[r.status] !== undefined) counts[r.status] += 1 })
            const total = mine.length
            const rate = total ? Math.round(((counts.present + counts.late) / total) * 100) : null
            return (
              <div key={l.id} className="rounded-2xl border border-gray-100 p-3">
                <div className="flex items-center gap-3">
                  <Avatar url={kid?.avatar_url} />
                  <p className="flex-1 min-w-0 font-medium text-sm truncate">{kid?.full_name || 'Student'}</p>
                  <button onClick={() => handleRemove(l.id)} aria-label="Remove"><Trash2 size={15} className="text-gray-300" /></button>
                </div>
                <div className="mt-3 rounded-xl bg-brand-light p-3">
                  <div className="flex items-baseline justify-between">
                    <p className="text-xs text-gray-500">Attendance this month</p>
                    <p className="text-lg font-bold text-brand-purple">{rate === null ? '—' : `${rate}%`}</p>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">{counts.present} present · {counts.absent} absent · {counts.late} late · {counts.excused} excused</p>
                </div>
                {mine.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    {mine.slice(0, 5).map((r) => (
                      <div key={r.id} className="flex items-center gap-2 text-xs">
                        <span className={`w-2 h-2 rounded-full ${DOT[r.status] || 'bg-gray-300'}`} />
                        <span className="w-24 shrink-0">{prettyDate(r.attendance_date)}</span>
                        <span className="capitalize text-gray-500">{r.status}</span>
                        {r.note ? <span className="text-gray-400 truncate">· {r.note}</span> : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 mt-2">No attendance recorded this month yet.</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- Student view
function StudentView({ user }) {
  const [code, setCode] = useState('')
  const [links, setLinks] = useState([])
  const [parents, setParents] = useState({})
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const { data: c, error: codeError } = await supabase.rpc('get_family_code')
    if (codeError) setError('Could not load your family code. Try again later.')
    else setCode(c || '')
    const { data: linkRows } = await supabase.from('parent_links').select('*').eq('student_id', user.id).order('created_at', { ascending: false })
    const list = linkRows ?? []
    setLinks(list)
    const ids = list.map((l) => l.parent_id)
    if (ids.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', ids)
      setParents(Object.fromEntries((profiles ?? []).map((p) => [p.id, p])))
    } else {
      setParents({})
    }
  }

  useEffect(() => {
    load()
  }, [user.id])

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  async function shareCode() {
    const text = `My Schoolink family code is ${code}. Open Schoolink → More → Family and enter it to see my attendance.`
    if (navigator.share) {
      try {
        await navigator.share({ text })
        return
      } catch {
        return
      }
    }
    copyCode()
  }

  async function newCode() {
    if (!window.confirm('Make a new code? The old code stops working. Parents who are already linked stay linked.')) return
    setBusy(true)
    const { data, error: rpcError } = await supabase.rpc('reset_family_code')
    setBusy(false)
    if (rpcError) {
      setError('Could not make a new code.')
      return
    }
    setCode(data || '')
  }

  async function handleRemove(linkId) {
    if (!window.confirm('Remove this parent from your account? They will stop seeing your attendance.')) return
    await supabase.from('parent_links').delete().eq('id', linkId)
    load()
  }

  return (
    <div className="screen-scroll px-4 pt-3 pb-6">
      <div className="rounded-2xl bg-brand-light p-5 text-center">
        <p className="text-xs text-gray-500">Your family code</p>
        <p className="text-3xl font-bold tracking-[0.25em] text-brand-purple mt-2 select-text">{code || '········'}</p>
        <p className="text-xs text-gray-500 mt-2">Give this code to your parent or guardian. They enter it in their Schoolink app to see your attendance.</p>
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={copyCode} disabled={!code} className="flex items-center gap-1.5 border border-brand-purple text-brand-purple text-xs font-medium px-3 py-2 rounded-full disabled:opacity-50">
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
          </button>
          <button onClick={shareCode} disabled={!code} className="flex items-center gap-1.5 border border-brand-purple text-brand-purple text-xs font-medium px-3 py-2 rounded-full disabled:opacity-50"><Share2 size={14} /> Share</button>
          <button onClick={newCode} disabled={busy || !code} className="flex items-center gap-1.5 border border-gray-200 text-gray-500 text-xs font-medium px-3 py-2 rounded-full disabled:opacity-50"><RefreshCw size={14} /> New code</button>
        </div>
        {error ? <p className="text-red-500 text-xs mt-3">{error}</p> : null}
      </div>

      <p className="text-xs font-semibold text-gray-400 uppercase mt-5 mb-1">Linked parents and guardians</p>
      {links.length === 0 ? (
        <p className="text-center text-gray-400 mt-6 text-sm">Nobody is linked yet.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {links.map((l) => {
            const p = parents[l.parent_id]
            return (
              <div key={l.id} className="flex items-center gap-3 py-3">
                <Avatar url={p?.avatar_url} />
                <p className="flex-1 min-w-0 text-sm font-medium truncate">{p?.full_name || 'Parent / Guardian'}</p>
                <button onClick={() => handleRemove(l.id)} aria-label="Remove"><Trash2 size={15} className="text-gray-300" /></button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- Page
export default function FamilyLinks() {
  const { user, profile } = useAuth()
  const isParent = profile?.account_type === 'parent'
  const isStudent = profile?.role === 'Student'

  const title = useMemo(() => (isParent ? 'My Children' : 'Family'), [isParent])

  return (
    <div className="app-shell">
      <BackHeader title={title} />
      {isParent ? (
        <ParentView user={user} />
      ) : isStudent ? (
        <StudentView user={user} />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 text-gray-400 gap-2">
          <Users size={32} />
          <p>Family links are for students and their parents or guardians.</p>
        </div>
      )}
      <BottomNav />
    </div>
  )
}
