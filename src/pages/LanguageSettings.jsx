import { useState } from 'react'
import { AlertTriangle, Search } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const languages = [
  { code: 'en', label: 'English', verified: true },
  // African languages
  { code: 'sn', label: 'Shona' },
  { code: 'nd', label: 'Ndebele' },
  { code: 'zu', label: 'Zulu' },
  { code: 'xh', label: 'Xhosa' },
  { code: 'af', label: 'Afrikaans' },
  { code: 'ny', label: 'Chichewa / Nyanja' },
  { code: 'bem', label: 'Bemba' },
  { code: 'sw', label: 'Swahili' },
  { code: 'yo', label: 'Yoruba' },
  { code: 'ig', label: 'Igbo' },
  { code: 'ha', label: 'Hausa' },
  { code: 'am', label: 'Amharic' },
  { code: 'so', label: 'Somali' },
  { code: 'rw', label: 'Kinyarwanda' },
  { code: 'st', label: 'Sesotho' },
  { code: 'tn', label: 'Setswana' },
  // European languages
  { code: 'fr', label: 'French' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'es', label: 'Spanish' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'nl', label: 'Dutch' },
  { code: 'ru', label: 'Russian' },
  { code: 'pl', label: 'Polish' },
  { code: 'uk', label: 'Ukrainian' },
  { code: 'ro', label: 'Romanian' },
  { code: 'el', label: 'Greek' },
  { code: 'sv', label: 'Swedish' },
  { code: 'tr', label: 'Turkish' },
  // Asian languages
  { code: 'zh', label: 'Chinese (Mandarin)' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'hi', label: 'Hindi' },
  { code: 'bn', label: 'Bengali' },
  { code: 'ur', label: 'Urdu' },
  { code: 'pa', label: 'Punjabi' },
  { code: 'ta', label: 'Tamil' },
  { code: 'te', label: 'Telugu' },
  { code: 'vi', label: 'Vietnamese' },
  { code: 'th', label: 'Thai' },
  { code: 'id', label: 'Indonesian' },
  { code: 'ms', label: 'Malay' },
  { code: 'fil', label: 'Filipino (Tagalog)' },
  // Middle Eastern
  { code: 'ar', label: 'Arabic' },
  { code: 'he', label: 'Hebrew' },
  { code: 'fa', label: 'Persian (Farsi)' },
]

export default function LanguageSettings() {
  const { profile, saveProfileDetails } = useAuth()
  const [selected, setSelected] = useState(profile?.language || 'en')
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')

  const [saveError, setSaveError] = useState('')

  async function handleSelect(code) {
    setSaving(true)
    setSaveError('')
    const { error } = await saveProfileDetails({ language: code })
    setSaving(false)
    if (error) {
      setSaveError(`Couldn't save: ${error.message}`)
      return
    }
    setSelected(code)
  }

  const filtered = languages.filter((l) => l.label.toLowerCase().includes(query.toLowerCase().trim()))
  const currentLabel = languages.find((l) => l.code === selected)?.label || 'English'

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
          ⚠️ Only English is fully verified right now. Other languages show English text until reviewed by a fluent speaker — selecting one just sets your preference for when translations are added.
        </p>

        {filtered.length === 0 ? (
          <p className="text-center text-gray-400 py-8">No languages match "{query}".</p>
        ) : (
          filtered.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleSelect(lang.code)}
              className="w-full flex items-center justify-between py-3.5 border-b border-gray-100"
            >
              <span className="flex items-center gap-2 text-sm">
                {lang.label}
                {!lang.verified ? <AlertTriangle size={13} className="text-amber-500" /> : null}
              </span>
              <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selected === lang.code ? 'border-brand-purple' : 'border-gray-300'}`}>
                {selected === lang.code ? <span className="w-2.5 h-2.5 rounded-full bg-brand-purple" /> : null}
              </span>
            </button>
          ))
        )}

        {saving ? <p className="text-xs text-brand-purple mt-3">Saving…</p> : null}
        {saveError ? <p className="text-xs text-red-500 mt-3">{saveError}</p> : null}
      </div>
    </div>
  )
   }
