import { createContext, useContext } from 'react'
import { useAuth } from '../context/AuthContext.jsx'

// English is fully accurate. The other languages are placeholders that
// currently fall back to English — do NOT treat them as real translations
// until a fluent speaker has reviewed and corrected the strings below.
const translations = {
  en: {
    home: 'Home', chats: 'Chats', post: 'Post', alerts: 'Alerts', profile: 'Profile',
    signInWithEmail: 'Sign in with Email', continueWithGoogle: 'Continue with Google', continueAsGuest: 'Continue as Guest',
  },
}

const LanguageContext = createContext({ lang: 'en', t: (key) => translations.en[key] || key })

export function LanguageProvider({ children }) {
  const { profile } = useAuth()
  const lang = profile?.language || 'en'

  function t(key) {
    return translations[lang]?.[key] || translations.en[key] || key
  }

  return <LanguageContext.Provider value={{ lang, t }}>{children}</LanguageContext.Provider>
}

export function useTranslation() {
  return useContext(LanguageContext)
}
