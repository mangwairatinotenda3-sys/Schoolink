import { useState } from 'react'
import BackHeader from '../components/BackHeader.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const themes = [
  { name: 'Default Purple', color: '#6C4CE0' },
  { name: 'Ocean Blue', color: '#2563EB' },
  { name: 'Forest Green', color: '#059669' },
  { name: 'Sunset Orange', color: '#EA580C' },
  { name: 'Rose Pink', color: '#DB2777' },
]

export default function ChatAppearanceSettings() {
  const { profile, saveProfileDetails } = useAuth()
  const [selectedColor, setSelectedColor] = useState(profile?.theme_color || '#6C4CE0')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true)
    await saveProfileDetails({ theme_color: selectedColor })
    document.documentElement.style.setProperty('--brand-purple', selectedColor)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader title="Chat Appearance" />
      <div className="flex-1 flex flex-col px-6 pt-4">
        <p className="font-medium text-sm mb-2">App Color</p>
        <div className="space-y-2">
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

        {saved ? <p className="text-green-600 text-sm mt-4">Theme updated!</p> : null}

        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-6 w-full text-white font-medium py-3 rounded-xl disabled:opacity-60"
          style={{ backgroundColor: selectedColor }}
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}
