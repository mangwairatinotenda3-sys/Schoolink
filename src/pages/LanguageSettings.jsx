import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const languages = [
  { code: 'en', label: 'English (United States)', verified: true },
  { code: 'sn', label: 'Shona', verified: false },
  { code: 'nd', label: 'Ndebele', verified: false },
  { code: 'fr', label: 'French', verified: false },
  { code: 'pt', label: 'Portuguese', verified: false },
]

export default function LanguageSettings() {
  const { profile, saveProfileDetails } = useAuth()
  const [selected, setSelected] = useState(profile?.language || 'en')
  const [saving, setSaving] = useState(false)

  async function handleSelect(code) {
    setSelected(code)
    setSaving(true)
    await saveProfileDetails({ language: code })
    setSaving(false)
  }

  return (
    <div className="app-shell">
      <BackHeader title="App Language" />
      <div className="screen-scroll px-6 pt-4">
        {languages.map((lang) => (
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
        ))}
        <p className="text-xs text-gray-400 mt-4">
          ⚠️ Languages other than English aren't fully translated yet — they'll show English text until reviewed by a fluent speaker.
        </p>
        {saving ? <p className="text-xs text-brand-purple mt-2">Saving…</p> : null}
      </div>
    </div>
  )
}
