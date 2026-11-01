import { useState } from 'react'
import { Check } from 'lucide-react'
import BottomSheet from './BottomSheet.jsx'
import PersonAvatar from './PersonAvatar.jsx'
import { useCalls } from '../context/CallContext.jsx'

const MAX = 11

// Group call with community members. Uses the same call system as the Calls page.
export default function CommunityCallSheet({ members, onClose }) {
  const { startCall } = useCalls()
  const [picked, setPicked] = useState([])
  const [kind, setKind] = useState('video')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function toggle(id) {
    setError('')
    if (picked.includes(id)) { setPicked(picked.filter((x) => x !== id)); return }
    if (picked.length >= MAX) { setError(`You can call up to ${MAX} people at once.`); return }
    setPicked([...picked, id])
  }

  async function start() {
    if (!picked.length || busy) return
    setBusy(true)
    const ok = await startCall({ inviteeIds: picked, kind })
    setBusy(false)
    if (ok) onClose()
  }

  return (
    <BottomSheet onClose={onClose}>
      <div className="px-3">
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold text-base">Group call</p>
          <div className="inline-flex bg-gray-100 rounded-full p-1">
            {[['video', 'Video'], ['voice', 'Voice']].map(([id, label]) => (
              <button key={id} onClick={() => setKind(id)} className={`px-3 py-1 rounded-full text-sm font-medium ${kind === id ? 'bg-white shadow-sm text-brand-navy' : 'text-gray-500'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {error ? <p role="alert" className="text-sm text-red-500 mb-2">{error}</p> : null}
        <div className="max-h-[50dvh] overflow-y-auto -mx-1">
          {members.length === 0 ? <p className="text-sm text-gray-500 py-6 text-center">No one else is in this community yet.</p> : null}
          {members.map((m) => {
            const on = picked.includes(m.user_id)
            return (
              <button key={m.user_id} onClick={() => toggle(m.user_id)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left active:bg-gray-100">
                <PersonAvatar p={m.profiles} size={40} />
                <span className="flex-1 min-w-0 truncate font-medium">{m.profiles?.full_name || 'Schoolink member'}</span>
                <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${on ? 'bg-brand-purple border-brand-purple text-white' : 'border-gray-300'}`}>
                  {on ? <Check size={14} /> : null}
                </span>
              </button>
            )
          })}
        </div>
        <button
          onClick={start}
          disabled={!picked.length || busy}
          className="w-full mt-3 bg-brand-purple text-white font-semibold rounded-full py-3 disabled:opacity-40"
        >
          {busy ? 'Starting…' : picked.length ? `Start call (${picked.length})` : 'Choose people'}
        </button>
      </div>
    </BottomSheet>
  )
  }
