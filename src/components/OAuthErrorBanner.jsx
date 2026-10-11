import { useEffect, useState } from 'react'

export const OAUTH_ERROR_KEY = 'schoolink_oauth_error'

// If Google sign-in comes back with an error, say so instead of silently
// landing on the Welcome screen with no explanation.
export default function OAuthErrorBanner() {
  const [message, setMessage] = useState('')

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(OAUTH_ERROR_KEY)
      if (saved) {
        sessionStorage.removeItem(OAUTH_ERROR_KEY)
        setMessage(saved)
      }
    } catch {
      // storage can be unavailable; nothing to show then
    }
  }, [])

  if (!message) return null

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, padding: '12px 16px',
        background: '#FEE2E2', color: '#991B1B', fontSize: 13, display: 'flex', gap: 12, alignItems: 'flex-start',
      }}
    >
      <span style={{ flex: 1 }}>Google sign-in didn't finish: {message}</span>
      <button onClick={() => setMessage('')} aria-label="Dismiss" style={{ fontWeight: 700 }}>✕</button>
    </div>
  )
        }
