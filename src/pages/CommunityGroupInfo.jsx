import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Camera, Copy, Share2, UserX, UserPlus, LogOut, Trash2, X } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function CommunityGroupInfo() {
  const { communityId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const fileInputRef = useRef(null)

  const [community, setCommunity] = useState(null)
  const [members, setMembers] = useState([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  const [showAddMember, setShowAddMember] = useState(false)
  const [addByEmail, setAddByEmail] = useState('')
  const [addByName, setAddByName] = useState('')
  const [nameResults, setNameResults] = useState([])
  const [addBusy, setAddBusy] = useState(false)
  const [addError, setAddError] = useState('')
  const [addSuccess, setAddSuccess] = useState('')

  useEffect(() => {
    loadAll()
  }, [communityId])

  async function loadAll() {
    setLoading(true)
    const { data: comm } = await supabase.from('communities').select('*').eq('id', communityId).maybeSingle()
    setCommunity(comm)

    const { data: memberRows } = await supabase
      .from('community_members')
      .select('user_id, role, profiles(full_name, role, avatar_url)')
      .eq('community_id', communityId)
    setMembers(memberRows ?? [])
    setIsAdmin((memberRows ?? []).some((m) => m.user_id === user.id && m.role === 'admin'))
    setLoading(false)
  }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${communityId}/avatar.${ext}`
    const { error: uploadError } = await supabase.storage.from('community-media').upload(path, file, { upsert: true })
    if (!uploadError) {
      const { data } = supabase.storage.from('community-media').getPublicUrl(path)
      const avatarUrl = `${data.publicUrl}?t=${Date.now()}`
      await supabase.from('communities').update({ avatar_url: avatarUrl }).eq('id', communityId)
      setCommunity((c) => ({ ...c, avatar_url: avatarUrl }))
    }
    setUploading(false)
  }

  function inviteLink() {
    return `${window.location.origin}${window.location.pathname}#/communities/join/${community?.invite_code}`
  }

  function copyInvite() {
    navigator.clipboard?.writeText(inviteLink())
    setAddSuccess('Invite link copied!')
    setTimeout(() => setAddSuccess(''), 2000)
  }

  function shareInvite() {
    if (navigator.share) {
      navigator.share({ title: community.name, text: `Join ${community.name} on Schoolink`, url: inviteLink() })
    } else {
      copyInvite()
    }
  }

  async function searchByName(query) {
    setAddByName(query)
    if (!query.trim()) {
      setNameResults([])
      return
    }
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .ilike('full_name', `%${query}%`)
      .limit(8)
    setNameResults(data ?? [])
  }

  async function addMemberById(id, label) {
    setAddBusy(true)
    setAddError('')
    const { error } = await supabase.from('community_members').insert({ community_id: communityId, user_id: id })
    setAddBusy(false)
    if (error) {
      setAddError(error.message.includes('duplicate') ? `${label} is already a member.` : error.message)
      return
    }
    setAddSuccess(`${label} added!`)
    setAddByEmail('')
    setAddByName('')
    setNameResults([])
    loadAll()
    setTimeout(() => setAddSuccess(''), 2000)
  }

  async function addByEmailSubmit() {
    if (!addByEmail.trim()) return
    setAddBusy(true)
    setAddError('')
    const { data, error } = await supabase.rpc('find_profile_by_email', { lookup_email: addByEmail.trim() })
    setAddBusy(false)
    if (error || !data || data.length === 0) {
      setAddError('No Schoolink account found with that email.')
      return
    }
    addMemberById(data[0].id, data[0].full_name || addByEmail)
  }

  async function handleRemove(memberId) {
    if (!window.confirm('Remove this member from the community?')) return
    await supabase.from('community_members').delete().eq('community_id', communityId).eq('user_id', memberId)
    loadAll()
  }

  async function handleLeave() {
    if (!window.confirm('Leave this community?')) return
    await supabase.from('community_members').delete().eq('community_id', communityId).eq('user_id', user.id)
    navigate('/communities')
  }

  async function handleDeleteCommunity() {
    if (!window.confirm('Delete this community for everyone? This cannot be undone.')) return
    await supabase.from('communities').delete().eq('id', communityId)
    navigate('/communities')
  }

  if (loading || !community) {
    return (
      <div className="app-shell">
        <BackHeader title="Group Info" />
        <div className="screen-scroll flex items-center justify-center text-gray-400">Loading…</div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <BackHeader title="Group Info" />
      <div className="screen-scroll px-4 pt-2">
        <div className="flex flex-col items-center py-4">
          <div className="relative">
            {community.avatar_url ? (
              <img src={community.avatar_url} alt="" className="w-24 h-24 rounded-full object-cover" />
            ) : (
              <span className="w-24 h-24 rounded-full bg-brand-light flex items-center justify-center text-3xl">🏘️</span>
            )}
            {isAdmin ? (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-brand-purple flex items-center justify-center border-2 border-white"
              >
                <Camera size={14} className="text-white" />
              </button>
            ) : null}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
          </div>
          <p className="font-semibold text-lg mt-3">{community.name}</p>
          <p className="text-sm text-gray-400">{members.length} members</p>
          {community.description ? <p className="text-sm text-gray-600 text-center mt-2">{community.description}</p> : null}
        </div>

        <div className="border border-gray-100 rounded-xl p-4 mt-2">
          <p className="font-medium text-sm mb-2">Invite Link</p>
          <p className="text-xs text-gray-400 truncate mb-3">{inviteLink()}</p>
          <div className="flex gap-2">
            <button onClick={copyInvite} className="flex-1 flex items-center justify-center gap-1 border border-gray-200 rounded-lg py-2 text-sm">
              <Copy size={14} /> Copy
            </button>
            <button onClick={shareInvite} className="flex-1 flex items-center justify-center gap-1 bg-brand-purple text-white rounded-lg py-2 text-sm">
              <Share2 size={14} /> Share
            </button>
          </div>
        </div>

        {addSuccess ? <p className="text-green-600 text-sm text-center mt-3">{addSuccess}</p> : null}

        {isAdmin ? (
          <div className="mt-4">
            {showAddMember ? (
              <div className="border border-gray-100 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-sm">Add Member</p>
                  <button onClick={() => setShowAddMember(false)}>
                    <X size={16} className="text-gray-400" />
                  </button>
                </div>
                <p className="text-xs text-gray-400 mb-1">By email</p>
                <div className="flex gap-2 mb-3">
                  <input
                    value={addByEmail}
                    onChange={(e) => setAddByEmail(e.target.value)}
                    placeholder="name@school.com"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
                  />
                  <button onClick={addByEmailSubmit} disabled={addBusy} className="bg-brand-purple text-white px-3 rounded-lg text-sm disabled:opacity-60">
                    Add
                  </button>
                </div>
                <p className="text-xs text-gray-400 mb-1">Or search by name</p>
                <input
                  value={addByName}
                  onChange={(e) => searchByName(e.target.value)}
                  placeholder="Search Schoolink members…"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
                />
                {nameResults.length > 0 ? (
                  <div className="mt-2 divide-y divide-gray-100">
                    {nameResults.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => addMemberById(r.id, r.full_name)}
                        className="w-full flex items-center justify-between py-2 text-left"
                      >
                        <span className="text-sm">{r.full_name || 'Schoolink member'}</span>
                        <span className="text-xs text-brand-purple">Add</span>
                      </button>
                    ))}
                  </div>
                ) : null}
                {addError ? <p className="text-red-500 text-xs mt-2">{addError}</p> : null}
              </div>
            ) : (
              <button
                onClick={() => setShowAddMember(true)}
                className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500"
              >
                <UserPlus size={16} /> Add Member
              </button>
            )}
          </div>
        ) : null}

        <p className="font-medium text-sm mt-5 mb-2">{members.length} Members</p>
        <div className="divide-y divide-gray-100">
          {members.map((m) => (
            <div key={m.user_id} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3 min-w-0">
                {m.profiles?.avatar_url ? (
                  <img src={m.profiles.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                ) : (
                  <span className="w-9 h-9 rounded-full bg-brand-light flex items-center justify-center text-sm shrink-0">🙂</span>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{m.profiles?.full_name || 'Schoolink member'}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {m.role === 'admin' ? 'Admin · ' : ''}{m.profiles?.role || ''}
                  </p>
                </div>
              </div>
              {isAdmin && m.user_id !== user.id ? (
                <button onClick={() => handleRemove(m.user_id)} className="text-red-500 shrink-0">
                  <UserX size={16} />
                </button>
              ) : null}
            </div>
          ))}
        </div>

        <div className="h-px bg-gray-100 my-5" />

        <button onClick={handleLeave} className="w-full flex items-center gap-2 text-red-500 py-3 text-sm font-medium">
          <LogOut size={16} /> Leave Community
        </button>
        {isAdmin ? (
          <button onClick={handleDeleteCommunity} className="w-full flex items-center gap-2 text-red-600 py-3 text-sm font-medium mb-6">
            <Trash2 size={16} /> Delete Community
          </button>
        ) : null}
      </div>
    </div>
  )
}
