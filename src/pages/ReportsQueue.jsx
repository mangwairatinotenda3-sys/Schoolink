import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Flag, Check, X as XIcon, ExternalLink, Trash2 } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import BottomNav from '../components/BottomNav.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { isStaffMember } from '../lib/permissions.js'
import { reportReasons, contentTypeLabels } from '../lib/moderation.js'

const statusTabs = ['pending', 'reviewed', 'dismissed']

const contentTables = {
  post: 'posts',
  comment: 'comments',
  message: 'messages',
  community_message: 'community_messages',
  library_resource: 'library_resources',
  school_gallery: 'school_gallery',
  school_document: 'school_documents',
}

function reasonLabel(key) {
  return reportReasons.find((r) => r.key === key)?.label || key
}

function viewPath(report) {
  switch (report.content_type) {
    case 'post': return `/post/${report.content_id}`
    case 'community': return `/communities/${report.content_id}`
    case 'user': return `/users/${report.content_id}`
    case 'library_resource': return '/library'
    default: return null
  }
}

export default function ReportsQueue() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('pending')
  const [busyId, setBusyId] = useState(null)

  useEffect(() => {
    loadReports()
  }, [tab])

  async function loadReports() {
    setLoading(true)
    const { data } = await supabase
      .from('content_reports')
      .select('*')
      .eq('status', tab)
      .order('created_at', { ascending: false })
    setReports(data ?? [])
    setLoading(false)
  }

  async function updateStatus(id, status) {
    setBusyId(id)
    await supabase.from('content_reports').update({ status, reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq('id', id)
    setBusyId(null)
    setReports((prev) => prev.filter((r) => r.id !== id))
  }

  async function removeContent(report) {
    if (!window.confirm('Remove this content? This cannot be undone.')) return
    setBusyId(report.id)
    const table = contentTables[report.content_type]
    if (table) await supabase.from(table).delete().eq('id', report.content_id)
    await supabase
      .from('content_reports')
      .update({ status: 'reviewed', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
      .eq('id', report.id)
    setBusyId(null)
    setReports((prev) => prev.filter((r) => r.id !== report.id))
  }

  if (!isStaffMember(profile)) {
    return (
      <div className="flex-1 flex flex-col">
        <BackHeader title="Reports" />
        <div className="screen-scroll px-6 flex items-center justify-center text-center text-gray-400">
          Only school staff can review reports.
        </div>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader title="Reports" />
      <div className="flex gap-5 px-4 border-b border-gray-100">
        {statusTabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2 text-sm font-medium border-b-2 capitalize ${tab === t ? 'border-brand-purple text-brand-purple' : 'border-transparent text-gray-400'}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="screen-scroll px-4 pt-3">
        {loading ? (
          <p className="text-center text-gray-400 mt-8">Loading…</p>
        ) : reports.length === 0 ? (
          <p className="text-center text-gray-400 mt-8">No {tab} reports.</p>
        ) : (
          <div className="space-y-3">
            {reports.map((r) => (
              <div key={r.id} className="border border-gray-100 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <span className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                    <Flag size={16} className="text-red-500" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">
                      {contentTypeLabels[r.content_type] || r.content_type} · {reasonLabel(r.reason)}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Reported {new Date(r.created_at).toLocaleString()}
                    </p>
                    {r.details ? <p className="text-sm text-gray-600 mt-2">{r.details}</p> : null}
                  </div>
                </div>

                <div className="flex gap-2 mt-3">
                  {viewPath(r) ? (
                    <button
                      onClick={() => navigate(viewPath(r))}
                      className="flex items-center justify-center gap-1.5 border border-gray-200 rounded-lg py-2 px-3 text-sm"
                    >
                      <ExternalLink size={14} />
                    </button>
                  ) : null}
                  {tab === 'pending' ? (
                    <>
                      {contentTables[r.content_type] ? (
                        <button
                          onClick={() => removeContent(r)}
                          disabled={busyId === r.id}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-red-500 text-white rounded-lg py-2 text-sm disabled:opacity-60"
                        >
                          <Trash2 size={14} /> Remove
                        </button>
                      ) : null}
                      <button
                        onClick={() => updateStatus(r.id, 'dismissed')}
                        disabled={busyId === r.id}
                        className="flex-1 flex items-center justify-center gap-1.5 border border-gray-200 rounded-lg py-2 text-sm disabled:opacity-60"
                      >
                        <XIcon size={14} /> Dismiss
                      </button>
                      <button
                        onClick={() => updateStatus(r.id, 'reviewed')}
                        disabled={busyId === r.id}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-brand-purple text-white rounded-lg py-2 text-sm disabled:opacity-60"
                      >
                        <Check size={14} /> Reviewed
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  )
}
