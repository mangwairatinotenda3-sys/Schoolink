import { useEffect, useState } from 'react'
import { Flag, Check } from 'lucide-react'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { reportReasons } from '../lib/moderation.js'

// Reusable report button. contentType must be a key from contentTypeLabels
// in src/lib/moderation.js (post, comment, message, status, ...).
// onOpenChange(true/false) lets a parent pause things while the sheet is open.
export default function ReportButton({ contentType, contentId, size = 18, className = '', onOpenChange }) {
  const { user, profile } = useAuth()
  const [open, setOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (onOpenChange) onOpenChange(open)
  }, [open])

  if (!user) return null

  async function submit(reasonKey) {
    if (sending) return
    setSending(true)
    setError('')
    const { error: insertError } = await supabase.from('content_reports').insert({
      content_type: contentType,
      content_id: String(contentId),
      reason: reasonKey,
      reported_by: user.id,
      school_id: profile?.school_id ?? null,
    })
    setSending(false)
    if (insertError) {
      setError('Could not send the report. Please try again.')
      return
    }
    setOpen(false)
    setDone(true)
    setTimeout(() => setDone(false), 2500)
  }

  function stop(e) {
    e.stopPropagation()
  }

  return (
    <span onClick={stop} className="inline-flex">
      <button
        onClick={() => { setError(''); setOpen(true) }}
        aria-label="Report"
        className={`flex items-center ${className}`}
      >
        <Flag size={size} className={done ? 'text-red-500' : ''} fill={done ? 'currentColor' : 'none'} />
      </button>

      {open ? (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={() => setOpen(false)}>
          <div className="bg-white text-gray-800 w-full max-w-md rounded-t-2xl p-4" onClick={stop}>
            <p className="font-semibold text-sm mb-1 text-gray-800">Report this {contentType.replace(/_/g, ' ')}</p>
            <p className="text-xs text-gray-400 mb-2">Why are you reporting it? School staff will review it.</p>
            {reportReasons.map((r) => (
              <button
                key={r.key}
                onClick={() => submit(r.key)}
                disabled={sending}
                className="w-full text-left py-3 border-b border-gray-100 text-sm text-gray-700 disabled:opacity-60"
              >
                {r.label}
              </button>
            ))}
            {error ? <p className="text-red-500 text-xs mt-2">{error}</p> : null}
            <button onClick={() => setOpen(false)} className="w-full text-center py-3 mt-1 text-sm text-gray-400">
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {done ? (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-white text-gray-800 border border-gray-100 rounded-full px-4 py-2 text-sm shadow-lg flex items-center gap-2">
          <Check size={14} className="text-green-500" /> Report submitted
        </div>
      ) : null}
    </span>
  )
  }
