import { useEffect, useState } from 'react'
import { Flag, Check, Loader2, Ban } from 'lucide-react'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { reportReasons, contentTypeLabels } from '../lib/moderation.js'

// One report sheet for everything: posts, comments, chat messages, community
// messages, updates and people. Pick a reason, add details if you like, send.
// contentType must be a key from contentTypeLabels in src/lib/moderation.js.
// Pass blockUserId (and blockName) to offer "Also block" in the same step.
// onClose() closes the sheet. onDone(didBlock) runs after a report was sent.
export default function ReportSheet({ contentType, contentId, blockUserId = null, blockName = '', onClose, onDone }) {
  const { user, profile } = useAuth()
  const [reason, setReason] = useState(null)
  const [details, setDetails] = useState('')
  const [alsoBlock, setAlsoBlock] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const label = (contentTypeLabels[contentType] || 'content').toLowerCase()
  const canBlock = !!blockUserId && blockUserId !== user?.id

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !sending) onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, sending])

  if (!user) return null

  async function submit() {
    if (!reason || sending) return
    setSending(true)
    setError('')

    // Already reported by this person? Say thanks without sending it twice.
    const { data: existing } = await supabase
      .from('content_reports')
      .select('id')
      .eq('reported_by', user.id)
      .eq('content_type', contentType)
      .eq('content_id', String(contentId))
      .limit(1)

    if (!existing || existing.length === 0) {
      const { error: insertError } = await supabase.from('content_reports').insert({
        content_type: contentType,
        content_id: String(contentId),
        reason,
        details: details.trim() || null,
        reported_by: user.id,
        school_id: profile?.school_id ?? null,
      })
      if (insertError) {
        setSending(false)
        setError('Could not send the report. Please try again.')
        return
      }
    }

    let didBlock = false
    if (canBlock && alsoBlock) {
      const { error: blockError } = await supabase.from('blocked_users').insert({ blocker_id: user.id, blocked_id: blockUserId })
      didBlock = !blockError || blockError.code === '23505'
    }

    setSending(false)
    setSent(true)
    setTimeout(() => {
      onDone?.(didBlock)
      onClose()
    }, 1400)
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50"
      style={{ animation: 'sl-fade 160ms ease-out', WebkitTapHighlightColor: 'transparent' }}
      onClick={() => { if (!sending && !sent) onClose() }}
    >
      <style>{'@keyframes sl-fade{from{opacity:0}to{opacity:1}}@keyframes sl-report-up{from{transform:translateY(100%)}to{transform:none}}'}</style>
      <div
        className="bg-white w-full max-w-[480px] rounded-t-3xl px-4 pt-2 max-h-[88dvh] overflow-y-auto"
        style={{ animation: 'sl-report-up 220ms cubic-bezier(.2,.8,.2,1)', paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Report"
      >
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-3" />

        {sent ? (
          <div className="flex flex-col items-center text-center py-8">
            <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mb-3">
              <Check size={26} className="text-green-600" />
            </div>
            <p className="font-semibold text-base text-gray-900">Thank you for telling us</p>
            <p className="text-sm text-gray-500 mt-1 max-w-xs">
              School staff will look at this {label}. {alsoBlock && canBlock ? `${blockName || 'This person'} is now blocked.` : ''}
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-1">
              <Flag size={18} className="text-red-500" />
              <p className="font-semibold text-base text-gray-900">Report this {label}</p>
            </div>
            <p className="text-xs text-gray-400 mb-2">Why are you reporting it? Only school staff will see your report.</p>

            <div className="divide-y divide-gray-100">
              {reportReasons.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setReason(r.key)}
                  disabled={sending}
                  className="w-full flex items-center justify-between gap-3 py-3 text-left disabled:opacity-60"
                >
                  <span className="text-sm text-gray-800">{r.label}</span>
                  <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${reason === r.key ? 'border-brand-purple bg-brand-purple text-white' : 'border-gray-300'}`}>
                    {reason === r.key ? <Check size={12} /> : null}
                  </span>
                </button>
              ))}
            </div>

            {reason ? (
              <div className="mt-3">
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value.slice(0, 500))}
                  rows={3}
                  placeholder="Anything else staff should know? (optional)"
                  aria-label="Details"
                  className="w-full border border-gray-200 rounded-2xl px-3 py-2.5 text-sm outline-brand-purple resize-none"
                />
                {canBlock ? (
                  <button
                    onClick={() => setAlsoBlock((v) => !v)}
                    className="w-full flex items-center gap-3 mt-2 py-2 text-left"
                  >
                    <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${alsoBlock ? 'border-red-500 bg-red-500 text-white' : 'border-gray-300'}`}>
                      {alsoBlock ? <Check size={12} /> : null}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-1.5 text-sm text-gray-800"><Ban size={14} className="text-red-500" /> Also block {blockName || 'this person'}</span>
                      <span className="block text-xs text-gray-400">They won't be able to message or call you.</span>
                    </span>
                  </button>
                ) : null}
              </div>
            ) : null}

            {error ? <p role="alert" className="text-red-500 text-xs mt-2">{error}</p> : null}

            <button
              onClick={submit}
              disabled={!reason || sending}
              className="w-full mt-3 bg-red-500 text-white font-semibold rounded-full py-3 flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.98] transition-transform"
            >
              {sending ? <Loader2 size={17} className="animate-spin" /> : null}
              {sending ? 'Sending…' : 'Send report'}
            </button>
            <button onClick={onClose} disabled={sending} className="w-full text-center py-3 text-sm text-gray-500">Cancel</button>
          </>
        )}
      </div>
    </div>
  )
}
