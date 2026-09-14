import { useState } from 'react'
import { Sun, Moon, Eye } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const sizes = ['Small', 'Default', 'Large', 'Extra Large']

function ModeSwitch({ darkMode, onChange }) {
  return (
    <div className="flex bg-gray-100 rounded-full p-1 relative">
      <div
        className={`absolute top-1 bottom-1 w-1/2 rounded-full bg-white shadow transition-transform duration-200 ${darkMode ? 'translate-x-full' : 'translate-x-0'}`}
      />
      <button
        onClick={() => onChange(false)}
        className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full text-sm font-medium ${!darkMode ? 'text-brand-purple' : 'text-gray-400'}`}
      >
        <Sun size={15} /> Light
      </button>
      <button
        onClick={() => onChange(true)}
        className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full text-sm font-medium ${darkMode ? 'text-brand-purple' : 'text-gray-400'}`}
      >
        <Moon size={15} /> Dark
      </button>
    </div>
  )
}

function Toggle({ checked, onChange }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-11 h-6 rounded-full relative transition-colors ${checked ? 'bg-brand-purple' : 'bg-gray-200'}`}
    >
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  )
}

export default function AccessibilitySettings() {
  const { profile, saveProfileDetails } = useAuth()
  const [textSize, setTextSize] = useState(profile?.text_size || 'default')
  const [darkMode, setDarkMode] = useState(profile?.dark_mode ?? false)
  const [highContrast, setHighContrast] = useState(profile?.high_contrast ?? false)

  async function handleTextSize(size) {
    setTextSize(size.toLowerCase())
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
    <div className="app-shell">
      <BackHeader title="Accessibility" />
      <div className="screen-scroll px-6 pt-4">
        <p className="font-medium text-sm mb-2">Appearance</p>
        <ModeSwitch darkMode={darkMode} onChange={handleDarkMode} />

        <p className="font-medium text-sm mt-6 mb-2">Text Size</p>
        <div className="grid grid-cols-2 gap-3">
          {sizes.map((s) => (
            <button
              key={s}
              onClick={() => handleTextSize(s)}
              className={`py-3 rounded-xl border text-sm font-medium ${textSize === s.toLowerCase() ? 'border-brand-purple text-brand-purple bg-brand-light' : 'border-gray-200 text-gray-600'}`}
            >
              {s}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">Preview: <span>This is how text will look</span></p>

        <div className="flex items-center justify-between py-4 mt-4 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <Eye size={16} className="text-brand-purple" />
            <div>
              <p className="font-medium text-sm">High Contrast</p>
              <p className="text-xs text-gray-400">Increase contrast for better readability</p>
            </div>
          </div>
          <Toggle checked={highContrast} onChange={handleHighContrast} />
        </div>
      </div>
    </div>
  )
    }
