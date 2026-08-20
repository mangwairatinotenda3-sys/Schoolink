import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackHeader from '../components/BackHeader.jsx'
import { useAuth } from '../context/AuthContext.jsx'

export default function AccountSettings() {
  const navigate = useNavigate()
  const { user, profile, saveProfileDetails, signOut } = useAuth()
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true)
    await saveProfileDetails({ full_name: fullName })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader title="Account" />
      <div className="flex-1 flex flex-col px-6 pt-4">
        <label className="text-sm font-medium mb-2">Full Name</label>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="border border-gray-200 rounded-xl px-4 py-3 outline-brand-purple"
        />

        <label className="text-sm font-medium mt-4 mb-2">Email</label>
        <p className="text-sm text-gray-500 border border-gray-100 rounded-xl px-4 py-3 bg-gray-50">{user?.email}</p>

        {saved ? <p className="text-green-600 text-sm mt-3">Saved!</p> : null}

        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-6 w-full bg-brand-purple text-white font-medium py-3 rounded-xl disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>

        <div className="h-px bg-gray-100 my-6" />

        <button
          onClick={() => {
            signOut()
            navigate('/')
          }}
          className="text-red-500 font-medium text-sm text-left"
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}
