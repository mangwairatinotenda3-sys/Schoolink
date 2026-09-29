import { useState } from 'react'
import { Play } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { tones, playTone } from '../lib/chatPrefs.js'

function Toggle({ checked, onChange }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${checked ? 'bg-brand-purple' : 'bg-gray-200'}`}
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

function ToneRow({ label, sub, value, onChange }) {
  return (
    <div className="py-3.5 border-b border-gray-100">
      <p className="font-medium text-sm">{label}</p>
      <p className="text-xs text-gray-400 mb-2">{sub}</p>
      <div className="flex gap-2">
        <select
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            playTone(e.target.value)
          }}
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
        >
          {tones.map((t) => (
            <option key={t.key} value={t.key}>{t.name}</option>
          ))}
        </select>
        <button
          onClick={() => playTone(value)}
          className="w-10 h-10 rounded-lg border border-gray-200 flex items-center justify-center"
          title="Preview"
        >
          <Play size={14} className="text-brand-purple" />
        </button>
      </div>
    </div>
  )
}

export default function NotificationSettings() {
  const { profile, saveProfileDetails } = useAuth()
  const [prefs, setPrefs] = useState({
    notify_likes: profile?.notify_likes ?? true,
    notify_comments: profile?.notify_comments ?? true,
    notify_follows: profile?.notify_follows ?? true,
    notify_messages: profile?.notify_messages ?? true,
    notify_message_tone: profile?.notify_message_tone || 'default',
    notify_group_tone: profile?.notify_group_tone || 'chime',
  })

  async function updatePref(key, value) {
    setPrefs((p) => ({ ...p, [key]: value }))
    await saveProfileDetails({ [key]: value })
  }

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader title="Notifications" />
      <div className="flex-1 flex flex-col px-6 pt-4 pb-8">
        <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Alerts</p>
        {options.map(({ key, label, sub }) => (
          <div key={key} className="flex items-center justify-between py-3.5 border-b border-gray-100">
            <div className="pr-4">
              <p className="font-medium text-sm">{label}</p>
              <p className="text-xs text-gray-400">{sub}</p>
            </div>
            <Toggle checked={prefs[key]} onChange={(v) => updatePref(key, v)} />
          </div>
        ))}

        <p className="text-xs font-semibold text-gray-400 uppercase mt-6 mb-1">Tones</p>
        <ToneRow
          label="Message tone"
          sub="Plays when a new chat message arrives while you're in that chat"
          value={prefs.notify_message_tone}
          onChange={(v) => updatePref('notify_message_tone', v)}
        />
        <ToneRow
          label="Group tone"
          sub="Plays when a new message arrives in a community you have open"
          value={prefs.notify_group_tone}
          onChange={(v) => updatePref('notify_group_tone', v)}
        />
        <p className="text-xs text-gray-400 mt-4">
          Schoolink doesn't have voice or video calling, so there's no call tone to set. Muted chats stay silent.
        </p>
      </div>
    </div>
  )
   }
