import { useState } from 'react'
import BackHeader from '../components/BackHeader.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const sizes = ['Small', 'Default', 'Large', 'Extra Large']

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

export default function AccessibilitySettings() {
  const { profile, saveProfileDetails } = useAuth()
  const [textSize, setTextSize] = useState(profile?.text_size || 'default')
  const [darkMode, setDarkMode] = useState(profile?.dark_mode ?? false)
  const [highContrast, setHighContrast] = useState(profile?.high_contrast ?? false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleTextSize(size) {
    setTextSize(size)
    await saveProfileDetails({ text_size: size.toLowerCase() })
  }

  async function handleDarkMode(value) {
    setDarkMode(value)
    await saveProfileDetails({ dark_mode: value })
  }

  async function handleHighContrast(value) {
    setHighContrast(value)
    await saveProfileDetails({ high_contrast: value })
  }

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader title="Accessibility" />
      <div className="flex-1 flex flex-col px-6 pt-4">
        <p className="font-medium text-sm mb-2">Text Size</p>
        <div className="grid grid-cols-2 gap-3">
          {sizes.map((s) => (
            <button
              key={s}
              onClick={() => handleTextSize(s)}
              className={`py-3 rounded-xl border text-sm font-medium ${
                textSize === s.toLowerCase() ? 'border-brand-purple text-brand-purple bg-brand-light' : 'border-gray-200 text-gray-600'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between py-4 mt-4 border-t border-gray-100">
          <div>
            <p className="font-medium text-sm">Dark Mode</p>
            <p className="text-xs text-gray-400">Switch the whole app to a dark theme</p>
          </div>
          <Toggle checked={darkMode} onChange={handleDarkMode} />
        </div>

        <div className="flex items-center justify-between py-4 border-t border-gray-100">
          <div>
            <p className="font-medium text-sm">High Contrast</p>
            <p className="text-xs text-gray-400">Increase contrast for better readability</p>
          </div>
          <Toggle checked={highContrast} onChange={handleHighContrast} />
        </div>
      </div>
    </div>
  )
      }
