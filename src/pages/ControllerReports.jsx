import { useEffect, useState } from 'react'
import ControllerShell, { ctl } from '../components/ControllerShell.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { reportReasons, contentTypeLabels } from '../lib/moderation.js'
import { timeAgo } from '../lib/team.js'

const tabs = ['pending', 'reviewed', 'dismissed']
const noRemove = ['user', 'community']

function reasonLabel(key) {
  return reportReasons.find((r) => r.key === key)?.label || key
}

function authorOf(report, row) {
  if (report.content_type === 'user') return report.content_id
  return row?.author_id || row?.user_id || row?.sender_id || row?.uploaded_by || null
}

export default function ControllerReports() {
  const [tab, setTab] = useState('pending')
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [previews, setPreviews] = useState({})
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [tab])

  async function load() {
    setLoading(true)
    const { data, error: err } = await supabase.rpc('team_reports', { p_status: tab })
    if (err) setError(err.message)
    setReports(data ?? [])
    setLoading(false)
  }

  async function showContent(report) {
    const id = String(report.id)
    setPreviews((p) => ({ ...p, [id]: { loading: true } }))
    const { data, error: err } = await supabase.rpc('team_report_content', { p_report_id: id })
    setPreviews((p) => ({ ...p, [id]: { loading: false, row: err ? null : data } }))
  }

  function drop(report) {
    setReports((prev) => prev.filter((r) => r.id !== report.id))
  }

  async function review(report, status) {
    setBusyId(report.id)
    setError('')
    const { error: err } = await supabase.rpc('team_review_report', { p_report_id: String(report.id), p_status: status })
    setBusyId(null)
    if (err) { setError(err.message); return }
    drop(report)
  }

  async function removeContent(report) {
    if (!window.confirm('Remove this content for good?')) return
    setBusyId(report.id)
    setError('')
    const { error: err } = await supabase.rpc('team_remove_content', { p_report_id: String(report.id) })
    setBusyId(null)
    if (err) { setError(err.message); return }
    drop(report)
  }

  async function banAuthor(report, authorId) {
    const reason = window.prompt('Reason for the ban (shown only to the team):', reportReasons.find((r) => r.key === report.reason)?.label || '')
    if (reason === null) return
    setBusyId(report.id)
    setError('')
    const { error: err } = await supabase.rpc('set_user_banned', { p_user_id: authorId, p_banned: true, p_reason: reason })
    if (err) { setBusyId(null); setError(err.message); return }
    await supabase.rpc('team_review_report', { p_report_id: String(report.id), p_status: 'reviewed' })
    setBusyId(null)
    drop(report)
  }

  const btn = { background: '#0F1526', border: `1px solid ${ctl.border}`, color: ctl.text }

  return (
    <ControllerShell title="User Reports" allow={['owner', 'moderator']}>
      <div className="flex gap-2 mb-4">
        {tabs.map((t) => (
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
      ) : reports.length === 0 ? (
        <p className="text-center mt-8 text-sm" style={{ color: ctl.muted }}>Nothing here.</p>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => {
            const pv = previews[String(r.id)]
            const row = pv?.row
            const authorId = authorOf(r, row)
            const text = row?.content || row?.text || row?.title || row?.message || row?.description || (r.content_type === 'user' ? `${row?.full_name || ''} ${row?.username ? '@' + row.username : ''}`.trim() : '')
            const image = row?.image_url || row?.media_url || row?.file_url || row?.avatar_url || null
            return (
              <div key={r.id} className="rounded-2xl p-4" style={{ background: ctl.card, border: `1px solid ${ctl.border}` }}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{contentTypeLabels[r.content_type] || r.content_type}</span>
                  <span className="text-[11px]" style={{ color: ctl.muted }}>{timeAgo(r.created_at)}</span>
                </div>
                <p className="text-xs mt-1" style={{ color: ctl.warn }}>{reasonLabel(r.reason)}</p>

                {!pv ? (
                  <button onClick={() => showContent(r)} className="mt-3 text-xs underline" style={{ color: ctl.accent }}>Show the reported content</button>
                ) : pv.loading ? (
                  <p className="text-xs mt-3" style={{ color: ctl.muted }}>Loading…</p>
                ) : !row ? (
                  <p className="text-xs mt-3" style={{ color: ctl.muted }}>This content no longer exists.</p>
                ) : (
                  <div className="mt-3 rounded-xl p-3" style={{ background: '#0F1526', border: `1px solid ${ctl.border}` }}>
                    {text ? <p className="text-sm break-words">{text}</p> : null}
                    {image ? <img src={image} alt="" className="mt-2 rounded-lg max-h-48 object-cover" /> : null}
                    {!text && !image ? <p className="text-xs" style={{ color: ctl.muted }}>No preview available for this item.</p> : null}
                  </div>
                )}

                {tab === 'pending' ? (
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button disabled={busyId === r.id} onClick={() => review(r, 'dismissed')} className="rounded-lg px-3 py-1.5 text-xs disabled:opacity-60" style={btn}>Dismiss</button>
                    <button disabled={busyId === r.id} onClick={() => review(r, 'reviewed')} className="rounded-lg px-3 py-1.5 text-xs disabled:opacity-60" style={btn}>Mark reviewed</button>
                    {!noRemove.includes(r.content_type) ? (
                      <button disabled={busyId === r.id} onClick={() => removeContent(r)} className="rounded-lg px-3 py-1.5 text-xs disabled:opacity-60" style={{ background: ctl.bad, color: '#fff' }}>Remove content</button>
                    ) : null}
                    {authorId ? (
                      <button disabled={busyId === r.id} onClick={() => banAuthor(r, authorId)} className="rounded-lg px-3 py-1.5 text-xs disabled:opacity-60" style={{ background: '#7F1D1D', color: '#fff' }}>Ban user</button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </ControllerShell>
  )
}
