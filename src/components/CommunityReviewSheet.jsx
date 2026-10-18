import { Check, X, Loader2, CheckCheck } from 'lucide-react'
import BottomSheet from './BottomSheet.jsx'
import { previewOf } from './CommunityPinned.jsx'

// Messages waiting for an admin to approve (community set to "admins approve messages")
export default function CommunityReviewSheet({ items, busy, onApprove, onReject, onClose }) {
  return (
    <BottomSheet onClose={onClose}>
      <div className="px-3">
        <p className="font-semibold text-lg">Waiting for approval</p>
        <p className="text-sm text-gray-500 mt-0.5">{items.length ? `${items.length} message${items.length === 1 ? '' : 's'} nobody else can see yet` : 'Nothing is waiting.'}</p>

        {items.length > 1 ? (
          <div className="flex gap-2 mt-4">
            <button onClick={() => onReject(items.map((m) => String(m.id)))} disabled={busy} className="flex-1 rounded-full bg-red-50 text-red-600 font-semibold py-2.5 text-sm disabled:opacity-40">Turn down all</button>
            <button onClick={() => onApprove(items.map((m) => String(m.id)))} disabled={busy} className="flex-1 rounded-full bg-brand-purple text-white font-semibold py-2.5 text-sm flex items-center justify-center gap-1.5 disabled:opacity-40">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <><CheckCheck size={16} /> Approve all</>}
            </button>
          </div>
        ) : null}

        <div className="mt-3 divide-y divide-gray-50">
          {items.map((m) => (
            <div key={m.id} className="flex items-center gap-3 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-500 truncate">{m.sender_name || 'Member'}</p>
                <p className="text-[15px] break-words line-clamp-3">{previewOf(m)}</p>
              </div>
              <button onClick={() => onReject([String(m.id)])} disabled={busy} aria-label="Turn down" className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center disabled:opacity-40"><X size={18} /></button>
              <button onClick={() => onApprove([String(m.id)])} disabled={busy} aria-label="Approve" className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center disabled:opacity-40"><Check size={18} /></button>
            </div>
          ))}
        </div>
        <button onClick={onClose} className="w-full mt-2 py-3.5 text-gray-500 font-medium">Close</button>
      </div>
    </BottomSheet>
  )
}
