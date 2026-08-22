import { useState } from 'react'
import BackHeader from '../components/BackHeader.jsx'

const languages = ['English (United States)', 'Shona', 'Ndebele', 'French', 'Portuguese']

export default function LanguageSettings() {
  const [selected, setSelected] = useState('English (United States)')

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader title="App Language" />
      <div className="flex-1 flex flex-col px-6 pt-4">
        {languages.map((lang) => (
          <button
            key={lang}
            onClick={() => setSelected(lang)}
            className="w-full flex items-center justify-between py-3.5 border-b border-gray-100"
          >
            <span className="text-sm">{lang}</span>
            <span
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                selected === lang ? 'border-brand-purple' : 'border-gray-300'
              }`}
            >
              {selected === lang ? <span className="w-2.5 h-2.5 rounded-full bg-brand-purple" /> : null}
            </span>
          </button>
        ))}
        <p className="text-xs text-gray-400 mt-4">
          Full translations are still in progress — the app will remain in English for now.
        </p>
      </div>
    </div>
  )
}
