import { useState } from 'react'
import { Search, Check } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { translatePageTo, resetToOriginalLanguage, isCurrentlyTranslated } from '../lib/googleTranslate.js'

const languages = [
  { code: 'en', label: 'English' },
  { code: 'sn', label: 'Shona' }, { code: 'nd', label: 'Ndebele' }, { code: 'zu', label: 'Zulu' },
  { code: 'xh', label: 'Xhosa' }, { code: 'af', label: 'Afrikaans' }, { code: 'ny', label: 'Chichewa / Nyanja' },
  { code: 'sw', label: 'Swahili' }, { code: 'yo', label: 'Yoruba' }, { code: 'ig', label: 'Igbo' },
  { code: 'ha', label: 'Hausa' }, { code: 'am', label: 'Amharic' }, { code: 'so', label: 'Somali' },
  { code: 'rw', label: 'Kinyarwanda' }, { code: 'st', label: 'Sesotho' }, { code: 'tn', label: 'Setswana' },
  { code: 'fr', label: 'French' }, { code: 'pt', label: 'Portuguese' }, { code: 'es', label: 'Spanish' },
  { code: 'de', label: 'German' }, { code: 'it', label: 'Italian' }, { code: 'nl', label: 'Dutch' },
  { code: 'ru', label: 'Russian' }, { code: 'pl', label: 'Polish' }, { code: 'uk', label: 'Ukrainian' },
  { code: 'ro', label: 'Romanian' }, { code: 'el', label: 'Greek' }, { code: 'sv', label: 'Swedish' },
  { code: 'tr', label: 'Turkish' }, { code: 'zh-CN', label: 'Chinese (Mandarin)' }, { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' }, { code: 'hi', label: 'Hindi' }, { code: 'bn', label: 'Bengali' },
  { code: 'ur', label: 'Urdu' }, { code: 'pa', label: 'Punjabi' }, { code: 'ta', label: 'Tamil' },
  { code: 'te', label: 'Telugu' }, { code: 'vi', label: 'Vietnamese' }, { code: 'th', label: 'Thai' },
  { code: 'id', label: 'Indonesian' }, { code: 'ms', label: 'Malay' }, { code: 'fil', label: 'Filipino (Tagalog)' },
  { code: 'ar', label: 'Arabic' }, { code: 'he', label: 'Hebrew' }, { code: 'fa', label: 'Persian (Farsi)' },
]

export default function LanguageSettings() {
  const [query, setQuery] = useState('')
  const currentlyTranslated = isCurrentlyTranslated()

  function handleSelect(code) {
    if (code === 'en') {
      resetToOriginalLanguage()
    } else {
      translatePageTo(code)
    }
  }

  const filtered = languages.filter((l) => l.label.toLowerCase().includes(query.toLowerCase().trim()))

  return (
    <div className="app-shell">
      <BackHeader title="App Language" />
      <div className="screen-scroll px-6 pt-4">
        <div className="relative mb-3">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search languages…"
            className="w-full border border-gray-200 rounded-full pl-9 pr-4 py-2.5 text-sm outline-brand-purple"
          />
        </div>

        <p className="text-xs text-gray-400 mb-3">
          Translation is powered by Google Translate — real, live translation of the whole app, not something we've hand-written. Quality can vary by language.
        </p>

        {filtered.length === 0 ? (
          <p className="text-center text-gray-400 py-8">No languages match "{query}".</p>
        ) : (
          filtered.map((lang) => {
            const isActive = lang.code === 'en' ? !currentlyTranslated : false
            return (
              <button
                key={lang.code}
                onClick={() => handleSelect(lang.code)}
                className="w-full flex items-center justify-between py-3.5 border-b border-gray-100"
              >
                <span className="text-sm">{lang.label}</span>
                {isActive ? <Check size={16} className="text-brand-purple" /> : null}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
                                     }
