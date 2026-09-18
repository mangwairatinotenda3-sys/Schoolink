import { useEffect, useState } from 'react'
import { Languages, X } from 'lucide-react'
import { translatePageTo, isCurrentlyTranslated } from '../lib/googleTranslate.js'

const DISMISSED_KEY = 'schoolink_translate_dismissed'

// A rough map from browser language codes to friendly names for the prompt.
const languageNames = {
  fr: 'French', pt: 'Portuguese', es: 'Spanish', de: 'German', it: 'Italian',
  nl: 'Dutch', ru: 'Russian', zh: 'Chinese', ja: 'Japanese', ko: 'Korean',
  ar: 'Arabic', hi: 'Hindi', sw: 'Swahili', af: 'Afrikaans', zu: 'Zulu',
  xh: 'Xhosa', am: 'Amharic', ha: 'Hausa', yo: 'Yoruba', ig: 'Igbo',
  vi: 'Vietnamese', th: 'Thai', id: 'Indonesian', tr: 'Turkish', pl: 'Polish',
  uk: 'Ukrainian', ur: 'Urdu', bn: 'Bengali', ta: 'Tamil', te: 'Telugu',
}

export default function TranslateBanner() {
  const [detected, setDetected] = useState(null)

  useEffect(() => {
    if (isCurrentlyTranslated()) return
    if (localStorage.getItem(DISMISSED_KEY)) return

    const browserLang = (navigator.language || 'en').split('-')[0]
    if (browserLang !== 'en' && languageNames[browserLang]) {
      setDetected(browserLang)
    }
  }, [])

  function handleTranslate() {
    translatePageTo(detected)
  }

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, '1')
    setDetected(null)
  }

  if (!detected) return null

  return (
    <div className="fixed bottom-24 left-4 right-4 max-w-[448px] mx-auto bg-white border border-gray-200 shadow-lg rounded-xl p-4 z-40 flex items-start gap-3">
      <Languages size={20} className="text-brand-purple shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">Translate to {languageNames[detected]}?</p>
        <p className="text-xs text-gray-400 mt-0.5">We noticed your device is set to {languageNames[detected]}.</p>
        <div className="flex gap-2 mt-2">
          <button onClick={handleTranslate} className="text-xs font-medium bg-brand-purple text-white px-3 py-1.5 rounded-full">
            Translate
          </button>
          <button onClick={handleDismiss} className="text-xs font-medium text-gray-500 px-3 py-1.5">
            No thanks
          </button>
        </div>
      </div>
      <button onClick={handleDismiss} className="shrink-0"><X size={16} className="text-gray-300" /></button>
    </div>
  )
}
