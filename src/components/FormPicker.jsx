import { useMemo } from 'react'
import { levelsFor, parseForm, joinForm } from '../lib/forms.js'

// Pick a level (Form 2, Lower 6 ...) and type the class name (Orange, A ...).
export default function FormPicker({ value, onChange, schoolType }) {
  const levels = useMemo(() => levelsFor(schoolType), [schoolType])
  const { level, stream } = parseForm(value, levels)

  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Your form</p>
      <div className="flex flex-wrap gap-2">
        {levels.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => onChange(joinForm(l, stream))}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium border transition-colors ${
              level === l ? 'bg-brand-purple border-brand-purple text-white' : 'border-gray-200 text-gray-600 bg-white'
            }`}
          >
            {l}
          </button>
        ))}
      </div>
      <input
        value={stream}
        onChange={(e) => onChange(joinForm(level, e.target.value))}
        maxLength={30}
        placeholder="Class name, e.g. Orange, A, Blue (optional)"
        className="mt-3 w-full border border-gray-200 rounded-xl px-4 py-3 text-[15px] outline-none focus:border-brand-purple"
      />
      {value ? (
        <p className="text-sm text-gray-500 mt-2">
          You will show as <span className="font-semibold text-brand-navy">{value}</span>
        </p>
      ) : null}
    </div>
  )
}
