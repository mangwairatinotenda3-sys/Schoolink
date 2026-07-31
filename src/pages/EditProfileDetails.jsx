import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackHeader from '../components/BackHeader.jsx'
import { useAuth } from '../context/AuthContext.jsx'

export default function EditProfileDetails() {
  const navigate = useNavigate()
  const { profile, saveProfileDetails } = useAuth()
  const [bio, setBio] = useState(profile?.bio || '')
  const [location, setLocation] = useState(profile?.location || '')
  const [links, setLinks] = useState(profile?.links || '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    await saveProfileDetails({ bio, location, links })
    setSaving(false)
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

        <label className="text-sm font-medium mt-4 mb-2">Location</label>
        <input
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
