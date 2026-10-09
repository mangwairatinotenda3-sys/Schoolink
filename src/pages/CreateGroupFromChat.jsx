import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Camera, X } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

function generateInviteCode() {
  return Math.random().toString(36).slice(2, 10).toUpperCase()
}

export default function CreateGroupFromChat() {
  const { userId: partnerId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const avatarInputRef = useRef(null)

  const [partner, setPartner] = useState(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [selectedMembers, setSelectedMembers] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('profiles').select('id, full_name, role').eq('id', partnerId).maybeSingle().then(({ data }) => {
      setPartner(data)
      if (data) setSelectedMembers([data])
    })
  }, [partnerId])

  async function handleSearch(value) {
    setQuery(value)
    if (!value.trim()) { setResults([]); return }
    const { data } = await supabase.from('profiles').select('id, full_name, role').ilike('full_name', `%${value}%`).limit(8)
    setResults((data ?? []).filter((p) => p.id !== user.id && !selectedMembers.some((m) => m.id === p.id)))
  }

  function addMember(person) {
    setSelectedMembers((prev) => [...prev, person])
    setResults((prev) => prev.filter((p) => p.id !== person.id))
    setQuery('')
  }

  function removeMember(id) {
    setSelectedMembers((prev) => prev.filter((m) => m.id !== id))
  }

  function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

   async function handleCreate() {
    if (!name.trim() || saving) return
    setSaving(true)
    setError('')

    // One database call creates the group, makes you its admin and adds the
    // selected people as members.
    const { data: communityId, error: createError } = await supabase.rpc('create_community_with_admin', {
      p_name: name.trim(),
      p_description: description,
      p_is_private: true,
      p_posting_mode: 'everyone',
      p_invite_code: generateInviteCode(),
      p_member_ids: selectedMembers.map((m) => m.id),
    })

    if (createError || !communityId) {
      setError(createError?.message || 'Could not create the group. Please try again.')
      setSaving(false)
      return
    }

    if (avatarFile) {
      const ext = avatarFile.name.split('.').pop()
      const path = `${communityId}/avatar.${ext}`
      const { error: uploadError } = await supabase.storage.from('community-media').upload(path, avatarFile, { upsert: true })
      if (!uploadError) {
        const { data } = supabase.storage.from('community-media').getPublicUrl(path)
        await supabase.from('communities').update({ avatar_url: data.publicUrl }).eq('id', communityId)
      }
    }

    setSaving(false)
    navigate(`/communities/${communityId}`)
  } 

  return (
    <div className="app-shell">
      <BackHeader title="Create Group" />
      <div className="screen-scroll px-6 pt-4">
        <div className="flex justify-center mb-4">
          <div className="relative">
            {avatarPreview ? (
              <img src={avatarPreview} alt="" className="w-20 h-20 rounded-full object-cover" />
            ) : (
              <span className="w-20 h-20 rounded-full bg-brand-light flex items-center justify-center text-2xl">🏘️</span>
            )}
            <button onClick={() => avatarInputRef.current?.click()} className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-brand-purple flex items-center justify-center border-2 border-white">
              <Camera size={13} className="text-white" />
            </button>
            <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
          </div>
        </div>

        <label className="text-sm font-medium mb-2">Group Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={partner ? `e.g. Me & ${partner.full_name}'s Group` : 'Group name'} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-brand-purple" />

        <label className="text-sm font-medium mt-4 mb-2">Description (optional)</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-brand-purple resize-none" />

        <label className="text-sm font-medium mt-4 mb-2">Members</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedMembers.map((m) => (
            <span key={m.id} className="flex items-center gap-1 bg-brand-light text-brand-purple text-xs font-medium px-2 py-1 rounded-full">
              {m.full_name || 'Member'}
              <button onClick={() => removeMember(m.id)}><X size={11} /></button>
            </span>
          ))}
        </div>
        <input value={query} onChange={(e) => handleSearch(e.target.value)} placeholder="Search to add more members…" className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-brand-purple" />
        {results.length > 0 ? (
          <div className="mt-2 divide-y divide-gray-100">
            {results.map((r) => (
              <button key={r.id} onClick={() => addMember(r)} className="w-full flex items-center justify-between py-2 text-left">
                <span className="text-sm">{r.full_name || 'Schoolink member'}</span>
                <span className="text-xs text-brand-purple">Add</span>
              </button>
            ))}
          </div>
        ) : null}

        {error ? <p className="text-red-500 text-sm mt-3">{error}</p> : null}

        <button onClick={handleCreate} disabled={saving} className="mt-6 w-full bg-brand-purple text-white font-medium py-3.5 rounded-xl mb-6 disabled:opacity-60">
          {saving ? 'Creating…' : 'Create Group'}
        </button>
      </div>
    </div>
  )
}
