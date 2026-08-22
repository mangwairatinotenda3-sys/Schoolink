import { useState } from 'react'
import BackHeader from '../components/BackHeader.jsx'

const sizes = ['Small', 'Default', 'Large', 'Extra Large']

export default function AccessibilitySettings() {
  const [textSize, setTextSize] = useState('Default')

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader title="Accessibility" />
      <div className="flex-1 flex flex-col px-6 pt-4">
        <p className="font-medium text-sm mb-2">Text Size</p>
        <div className="grid grid-cols-2 gap-3">
          {sizes.map((s) => (
            <button
              key={s}
              onClick={() => setTextSize(s)}
              className={`py-3 rounded-xl border text-sm font-medium ${
                textSize === s ? 'border-brand-purple text-brand-purple bg-brand-light' : 'border-gray-200 text-gray-600'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-4">
          Preview: <span
            className={
              textSize === 'Small' ? 'text-xs' : textSize === 'Large' ? 'text-lg' : textSize === 'Extra Large' ? 'text-xl' : 'text-sm'
            }
          >
            This is how text will look
          </span>
        </p>
      </div>
    </div>
  )
}
