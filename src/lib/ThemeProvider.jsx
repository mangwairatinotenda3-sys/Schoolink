import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'

const textScales = { small: '0.875', default: '1', large: '1.15', 'extra large': '1.3' }

export default function ThemeProvider({ children }) {
  const { profile } = useAuth()

  useEffect(() => {
    const color = profile?.theme_color || '#6C4CE0'
    document.documentElement.style.setProperty('--brand-purple', color)
  }, [profile?.theme_color])

  useEffect(() => {
    const key = (profile?.text_size || 'default').toLowerCase()
    document.documentElement.style.setProperty('--text-scale', textScales[key] || '1')
  }, [profile?.text_size])

  return children
}
