import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

function generateInviteCode() {
  return Math.random().toString(36).slice(2, 10).toUpperCase()
}

export default function CreateCommunity() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [postingMode, setPostingMode] = useState('everyone')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    if (!name.trim()) return
    setSaving(true)
    setError('')

    const { data: community, error: insertError } = await supabase
      .from('communities')
      .insert({
        name, description, category, created_by: user.id,
        invite_code: generateInviteCode(), is_private: isPrivate, posting_mode: postingMode,
      })
      .select()
      .maybeSingle()

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    const { error: memberError } = await supabase
      .from('community_members')
      .insert({ community_id: community.id, user_id: user.id, role: 'admin' })

    setSaving(false)

    if (memberError) {
      setError(`Community was created, but making you admin failed: ${memberError.message}. Please contact support.`)
      return
    }

    navigate(`/communities/${community.id}`)
  }

  return (
    <div className="app-shell">
      <BackHeader title="Create a Community" />
      <div className="screen-scroll px-6 pt-4">
        <label className="text-sm font-medium mb-2">Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mathematics Teachers" className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-brand-purple" />

        <label className="text-sm font-medium mt-4 mb-2">Category</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-brand-purple">
          <option value="">Select a category</option>
          <option value="School">School</option>
          <option value="Subject">Subject</option>
          <option value="Role">Role</option>
        </select>

        <label className="text-sm font-medium mt-4 mb-2">Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What's this community about?" className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-brand-purple resize-none" />

        <label className="flex items-center gap-2 text-sm text-gray-600 mt-4">
          <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
          Private community (requests need admin approval)
        </label>

        <label className="text-sm font-medium mt-4 mb-2">Who can post?</label>
        <select value={postingMode} onChange={(e) => setPostingMode(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-brand-purple">
          <option value="everyone">Everyone</option>
          <option value="admins_only">Admins only</option>
        </select>

        {error ? <p className="text-red-500 text-sm mt-3">{error}</p> : null}

        <button onClick={handleCreate} disabled={saving} className="mt-6 w-full bg-brand-purple text-white font-medium py-3.5 rounded-xl mb-6 disabled:opacity-60">
          {saving ? 'Creating…' : 'Create Community'}
        </button>
      </div>
    </div>
  )
    }
