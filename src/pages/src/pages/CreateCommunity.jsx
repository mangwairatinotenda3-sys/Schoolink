import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function CreateCommunity() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    if (!name.trim()) return
    setSaving(true)
    setError('')

    const { data: community, error: insertError } = await supabase
      .from('communities')
      .insert({ name, description, category, created_by: user.id })
      .select()
      .maybeSingle()

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    await supabase.from('community_members').insert({ community_id: community.id, user_id: user.id })

    setSaving(false)
    navigate(`/communities/${community.id}`)
  }

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader title="Create a Community" />
      <div className="flex-1 flex flex-col px-6 pt-4">
        <label className="text-sm font-medium mb-2">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Science Teachers"
          className="border border-gray-200 rounded-xl px-4 py-3 outline-brand-purple"
        />

        <label className="text-sm font-medium mt-4 mb-2">Category (optional)</label>
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="e.g. Subject, Role, Region"
          className="border border-gray-200 rounded-xl px-4 py-3 outline-brand-purple"
        />

        <label className="text-sm font-medium mt-4 mb-2">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="What's this community about?"
          className="border border-gray-200 rounded-xl px-4 py-3 outline-brand-purple resize-none"
        />

        {error ? <p className="text-red-500 text-sm mt-3">{error}</p> : null}

        <div className="flex-1" />
        <button
          onClick={handleCreate}
          disabled={saving}
          className="w-full bg-brand-purple text-white font-medium py-3.5 rounded-xl mb-6 disabled:opacity-60"
        >
          {saving ? 'Creating…' : 'Create Community'}
        </button>
      </div>
    </div>
  )
}
