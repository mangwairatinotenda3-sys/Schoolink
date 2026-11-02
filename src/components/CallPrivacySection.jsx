import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import PersonAvatar from './PersonAvatar.jsx'

const OPTIONS = [
  { id: 'ask', label: 'Anyone, with my approval', sub: 'People outside my school send a call request. I decide.' },
  { id: 'school', label: 'Only my school', sub: 'Only people in my school, or people I approved, can call me.' },
]

// Who can call me, and the people I approved. Shown inside Privacy settings.
export default function CallPrivacySection() {
  const { user, profile, saveProfileDetails } = useAuth()
  const current = profile?.call_privacy === 'school' ? 'school' : 'ask'
  const [saving, setSaving] = useState(false)
  const [approved, setApproved] = useState(null)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!user?.id) return undefined
    let live = true
    ;(async () => {
      const { data, error } = await supabase.from('call_allowed').select('allowed_id').eq('allower_id', user.id)
      if (!live) return
      if (error) { setApproved([]); setMsg('Could not load your list.'); return }
      const ids = (data ?? []).map((r) => r.allowed_id)
      let people = []
      if (ids.length) {
        const { data: ps } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', ids)
        people = ps ?? []
      }
      if (live) setApproved(people)
    })()
    return () => { live = false }
  }, [user?.id])

  async function choose(id) {
    if (id === current || saving) return
    setSaving(true)
    setMsg('')
    const { error } = await saveProfileDetails({ call_privacy: id })
    if (error) setMsg('Could not save. Try again.')
    setSaving(false)
  }

  async function remove(id) {
    setMsg('')
    const { error } = await supabase.from('call_allowed').delete().eq('allower_id', user.id).eq('allowed_id', id)
    if (error) { setMsg('Could not remove them. Try again.'); return }
    setApproved((list) => (list ?? []).filter((p) => p.id !== id))
  }

  return (
    <section className="py-3 border-b border-gray-100">
      <p className="font-medium text-sm mb-1">Who can call me</p>
      <p className="text-xs text-gray-400 mb-3">Calls are always between you and the person you accept.</p>

      <div className="flex flex-col gap-2">
        {OPTIONS.map((o) => (
          <button
            key={o.id}
            onClick={() => choose(o.id)}
            disabled={saving}
            aria-pressed={current === o.id}
            className={`w-full text-left rounded-2xl border px-4 py-3 ${current === o.id ? 'border-brand-purple bg-brand-light' : 'border-gray-200'}`}
          >
            <span className="block font-medium text-[15px]">{o.label}</span>
            <span className="block text-xs text-gray-500 mt-0.5">{o.sub}</span>
          </button>
        ))}
      </div>

      <p className="font-medium text-sm mt-5 mb-2">People who can call me</p>
      {approved === null ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : approved.length === 0 ? (
        <p className="text-sm text-gray-500">No one outside your school yet. You approve people when they send a call request.</p>
      ) : (
        <div className="flex flex-col">
          {approved.map((p) => (
            <div key={p.id} className="flex items-center gap-3 py-2">
              <PersonAvatar p={p} size={36} />
              <span className="flex-1 min-w-0 truncate text-[15px]">{p.full_name || 'Schoolink member'}</span>
              <button
                onClick={() => remove(p.id)}
                aria-label={`Remove ${p.full_name || 'person'}`}
                className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 active:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>
          ))}
        </div>
      )}
      {msg ? <p role="alert" className="text-sm text-red-500 mt-2">{msg}</p> : null}
    </section>
  )
    }
