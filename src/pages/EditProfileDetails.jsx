import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackHeader from '../components/BackHeader.jsx'
import { useAuth } from '../context/AuthContext.jsx'

export default function EditProfileDetails() {
  const navigate = useNavigate()
  const { profile, saveProfileDetails } = useAuth()
  const [username, setUsername] = useState(profile?.username || '')
  const [usernameError, setUsernameError] = useState('')
  const [bio, setBio] = useState(profile?.bio || '')
  const [location, setLocation] = useState(profile?.location || '')
  const [links, setLinks] = useState(profile?.links || '')
  const [saving, setSaving] = useState(false)

 async function handleSave() {
    setSaving(true)
    setUsernameError('')
    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
    const { error } = await saveProfileDetails({ bio, location, links, username: cleanUsername || null })
    setSaving(false)
    if (error) {
      if (error.message?.includes('duplicate')) {
        setUsernameError('That username is already taken.')
      } else {
        setUsernameError(error.message)
      }
      return
    }
    navigate('/profile')
 }
  

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader title="Edit Profile Details" />
      <div className="flex-1 flex flex-col px-6 pt-2">
        <label className="text-sm font-medium mb-2">Bio</label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          placeholder="Tell people a bit about yourself…"
          className="border border-gray-200 rounded-xl px-4 py-3 outline-brand-purple resize-none"
        />

        <label className="text-sm font-medium mb-2">Username</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="e.g. tinomangwaira"
          className="border border-gray-200 rounded-xl px-4 py-3 outline-brand-purple"
        />
        {usernameError ? <p className="text-red-500 text-xs mt-1">{usernameError}</p> : null}

        <label className="text-sm font-medium mt-4 mb-2">Bio</label>
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Harare, Zimbabwe"
          className="border border-gray-200 rounded-xl px-4 py-3 outline-brand-purple"
        />

        <label className="text-sm font-medium mt-4 mb-2">Links</label>
        <textarea
          value={links}
          onChange={(e) => setLinks(e.target.value)}
          rows={3}
          placeholder={'One link per line, e.g.\nhttps://example.com'}
          className="border border-gray-200 rounded-xl px-4 py-3 outline-brand-purple resize-none"
        />

        <div className="flex-1" />
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-brand-purple text-white font-medium py-3.5 rounded-xl mb-6 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
    }
