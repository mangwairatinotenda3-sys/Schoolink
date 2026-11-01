import { useState } from 'react'

// A community picture, or WhatsApp's grey group icon when there is none (or it fails to load).
export default function CommunityAvatar({ url, size = 40, className = '' }) {
  const [broken, setBroken] = useState(false)
  const box = { width: size, height: size }

  if (url && !broken) {
    return (
      <img
        src={url}
        alt=""
        onError={() => setBroken(true)}
        style={box}
        className={`rounded-full object-cover shrink-0 ${className}`}
      />
    )
  }

  return (
    <span
      style={{ ...box, background: 'var(--avatar-fallback-bg)' }}
      className={`rounded-full flex items-center justify-center shrink-0 overflow-hidden ${className}`}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" style={{ width: size * 0.7, height: size * 0.7, fill: 'var(--avatar-fallback-fg)' }}>
        <circle cx="8.6" cy="8.6" r="3.4" />
        <path d="M2.6 19.2c.6-3.3 2.9-5.4 6-5.4s5.4 2.1 6 5.4c-.1.5-.5.8-1 .8H3.6c-.5 0-.9-.3-1-.8z" />
        <circle cx="15.8" cy="8.6" r="3.4" />
        <path d="M13.4 13.9c.5-.1 1-.1 1.5-.1 2.8 0 4.8 1.9 5.3 4.6.1.5-.2.8-.7.8h-4.4c.2-1.7-.3-3.4-1.7-5.3z" />
      </svg>
    </span>
  )
}
