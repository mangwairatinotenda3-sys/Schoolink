import { useState } from 'react'
import BackHeader from '../components/BackHeader.jsx'
import { useAuth } from '../context/AuthContext.jsx'

function Toggle({ checked, onChange }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-11 h-6 rounded-full relative transition-colors ${checked ? 'bg-brand-purple' : 'bg-gray-200'}`}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

const options = [
  { key: 'notify_likes', label: 'Likes', sub: 'When someone likes your post' },
  { key: 'notify_comments', label: 'Comments', sub: 'When someone comments on your post' },
  { key: 'notify_follows', label: 'Follows', sub: 'When someone follows you' },
  { key: 'notify_messages', label: 'Messages', sub: 'When you get a new chat message' },
]

export default function NotificationSettings() {
  const { profile, saveProfileDetails } = useAuth()
  const [prefs, setPrefs] = useState({
    notify_likes: profile?.notify_likes ?? true,
    notify_comments: profile?.notify_comments ?? true,
    notify_follows: profile?.notify_follows ?? true,
    notify_messages: profile?.notify_messages ?? true,
  })

  async function updatePref(key, value) {
    setPrefs((p) => ({ ...p, [key]: value }))
    await saveProfileDetails({ [key]: value })
  }

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader title="Notifications" />
      <div className="flex-1 flex flex-col px-6 pt-4">
        {options.map(({ key, label, sub }) => (
          <div key={key} className="flex items-center justify-between py-3.5 border-b border-gray-100">
            <div>
              <p className="font-medium text-sm">{label}</p>
              <p className="text-xs text-gray-400">{sub}</p>
            </div>
            <Toggle checked={prefs[key]} onChange={(v) => updatePref(key, v)} />
          </div>
        ))}
      </div>
    </div>
  )
}
