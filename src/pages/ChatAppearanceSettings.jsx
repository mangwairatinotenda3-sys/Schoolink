import { useState } from 'react'
import BackHeader from '../components/BackHeader.jsx'

const themes = [
  { name: 'Default Purple', color: '#6C4CE0' },
  { name: 'Ocean Blue', color: '#2563EB' },
  { name: 'Forest Green', color: '#059669' },
  { name: 'Sunset Orange', color: '#EA580C' },
]

export default function ChatAppearanceSettings() {
  const [selected, setSelected] = useState('Default Purple')

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader title="Chat Appearance" />
      <div className="flex-1 flex flex-col px-6 pt-4">
        <p className="font-medium text-sm mb-2">Bubble Color</p>
        <div className="space-y-2">
          {themes.map((t) => (
            <button
              key={t.name}
              onClick={() => setSelected(t.name)}
              className="w-full flex items-center justify-between py-3 border-b border-gray-100"
            >
              <span className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full" style={{ backgroundColor: t.color }} />
                <span className="text-sm">{t.name}</span>
              </span>
              <span
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  selected === t.name ? 'border-brand-purple' : 'border-gray-300'
                }`}
              >
                {selected === t.name ? <span className="w-2.5 h-2.5 rounded-full bg-brand-purple" /> : null}
              </span>
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-4">More themes and wallpapers coming soon.</p>
      </div>
    </div>
  )
}
