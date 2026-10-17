import { useState } from 'react'
import { X, Loader2, Shield } from 'lucide-react'
import PeoplePicker from './PeoplePicker.jsx'
import { supabase } from '../lib/supabaseClient.js'

// Full-screen "add participants" for a community that already exists. Only admins can open it.
export default function CommunityAddPeople({ communityId, meId, schoolId, memberIds, onClose, onAdded }) {
  const [selected, setSelected] = useState([])
  const [asAdmins, setAsAdmins] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function add() {
    if (!selected.length || busy) return
    setBusy(true)
    setError('')
    const ids = selected.map((p) => p.id)
    const { data, error: err } = await supabase.rpc('community_add_members', { p_community: String(communityId), p_users: ids, p_admins: asAdmins ? ids : [] })
    setBusy(false)
    if (err || !data?.ok) { setError(err?.message || data?.error || 'Could not add them. Try again.'); return }
    onAdded(data.added ?? ids.length)
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col max-w-[480px] mx-auto">
      <div className="flex items-center gap-1 px-3 shrink-0 border-b border-gray-100" style={{ height: 56 }}>
        <button onClick={onClose} disabled={busy} aria-label="Close" className="w-10 h-10 rounded-full flex items-center justify-center"><X size={22} /></button>
        <div>
          <h1 className="font-semibold text-lg leading-tight">Add participants</h1>
          {selected.length ? <p className="text-[11px] text-gray-400 leading-tight">{selected.length} selected</p> : null}
        </div>
      </div>

      <PeoplePicker meId={meId} schoolId={schoolId} excludeIds={memberIds} selected={selected} setSelected={setSelected} />

      {selected.length > 0 ? (
        <div className="absolute inset-x-0 bottom-0 bg-white border-t border-gray-100 px-4 pt-3" style={{ paddingBottom: 'max(14px, env(safe-area-inset-bottom))' }}>
          {error ? <p className="text-sm text-red-500 mb-2 text-center">{error}</p> : null}
          <button onClick={() => setAsAdmins((v) => !v)} aria-pressed={asAdmins} className="flex items-center gap-2 mb-3 text-sm font-medium text-gray-700">
            <span className={`w-5 h-5 rounded-md flex items-center justify-center ${asAdmins ? 'bg-brand-purple text-white' : 'border-2 border-gray-300'}`}>{asAdmins ? <Shield size={12} /> : null}</span>
            Add them as admins
          </button>
          <button onClick={add} disabled={busy} className="w-full bg-brand-purple text-white font-semibold py-3.5 rounded-full disabled:opacity-40 flex items-center justify-center">
            {busy ? <Loader2 size={18} className="animate-spin" /> : `Add ${selected.length} ${selected.length === 1 ? 'person' : 'people'}`}
          </button>
        </div>
      ) : null}
    </div>
  )
  }
