import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'

export default function ThemeProvider({ children }) {
  const { profile } = useAuth()

  useEffect(() => {
    const color = profile?.theme_color || '#6C4CE0'
    document.documentElement.style.setProperty('--brand-purple', color)
  }, [profile?.theme_color])

  return children
      }
