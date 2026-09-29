import { useState } from 'react'
import { Check } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { wallpapers } from '../lib/chatPrefs.js'

const themes = [
  { name: 'Default Purple', color: '#6C4CE0' },
  { name: 'Ocean Blue', color: '#2563EB' },
  { name: 'Forest Green', color: '#059669' },
  { name: 'Sunset Orange', color: '#EA580C' },
  { name: 'Rose Pink', color: '#DB2777' },
]

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

export default function ChatAppearanceSettings() {
  const { profile, saveProfileDetails } = useAuth()
  const [selectedColor, setSelectedColor] = useState(profile?.theme_color || '#6C4CE0')
  const [wallpaper, setWallpaper] = useState(profile?.chat_wallpaper || 'default')
  const [enterToSend, setEnterToSend] = useState(profile?.chat_enter_to_send ?? true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSaveTheme() {
    setSaving(true)
    await saveProfileDetails({ theme_color: selectedColor })
    document.documentElement.style.setProperty('--brand-purple', selectedColor)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function pickWallpaper(key) {
    setWallpaper(key)
    await saveProfileDetails({ chat_wallpaper: key })
  }

  async function changeEnterToSend(value) {
    setEnterToSend(value)
    await saveProfileDetails({ chat_enter_to_send: value })
  }

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader title="Chat Appearance" />
      <div className="flex-1 flex flex-col px-6 pt-4 pb-8">
        <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Theme</p>
        <div className="space-y-1">
          {themes.map((t) => (
            <button
              key={t.name}
              onClick={() => setSelectedColor(t.color)}
              className="w-full flex items-center justify-between py-3 border-b border-gray-100"
            >
              <span className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full" style={{ backgroundColor: t.color }} />
                <span className="text-sm">{t.name}</span>
              </span>
              <span
                className="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                style={{ borderColor: selectedColor === t.color ? t.color : '#D1D5DB' }}
              >
                {selectedColor === t.color ? (
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                ) : null}
              </span>
            </button>
          ))}
        </div>

        {saved ? <p className="text-green-600 text-sm mt-3">Theme updated!</p> : null}

        <button
          onClick={handleSaveTheme}
          disabled={saving}
          className="mt-4 w-full text-white font-medium py-3 rounded-xl disabled:opacity-60"
          style={{ backgroundColor: selectedColor }}
        >
          {saving ? 'Saving…' : 'Save Theme'}
        </button>

        <div className="h-px bg-gray-100 my-6" />

        <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Chat Wallpaper</p>
        <p className="text-xs text-gray-400 mb-3">Shows behind messages in your chats and groups. Saves as soon as you tap one.</p>
        <div className="grid grid-cols-4 gap-3">
          {wallpapers.map((w) => (
            <button key={w.key} onClick={() => pickWallpaper(w.key)} className="flex flex-col items-center gap-1">
              <span
                className={`relative w-full aspect-square rounded-xl border-2 flex items-center justify-center ${
                  wallpaper === w.key ? 'border-brand-purple' : 'border-gray-200'
                }`}
                style={w.key === 'default' ? { background: 'transparent' } : w.style}
              >
                {w.key === 'default' ? <span className="text-[10px] text-gray-400">None</span> : null}
                {wallpaper === w.key ? (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-brand-purple flex items-center justify-center">
                    <Check size={12} className="text-white" />
                  </span>
                ) : null}
              </span>
              <span className="text-[11px] text-gray-500">{w.name}</span>
            </button>
          ))}
        </div>

        <div className="h-px bg-gray-100 my-6" />

        <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Chat Settings</p>
        <div className="flex items-center justify-between py-3.5 border-b border-gray-100">
          <div className="pr-4">
            <p className="font-medium text-sm">Enter is send</p>
            <p className="text-xs text-gray-400">Pressing Enter sends your message. Turn off to send only with the send button.</p>
          </div>
          <Toggle checked={enterToSend} onChange={changeEnterToSend} />
        </div>
      </div>
    </div>
  )
      }
