import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { GraduationCap, Home, MessageCircle, User } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'

// A short welcome tour, shown once to each new person the first time they reach Home.
// Colours are inline so it looks the same in every theme.
const steps = [
  {
    icon: GraduationCap,
    title: 'Welcome to Schoolink',
    text: 'One app for your school: your feed, your chats, your communities and your school tools. Here is a quick look around.',
  },
  {
    icon: Home,
    title: 'Your feed',
    text: 'Home shows posts and updates. Statuses on top disappear after 24 hours. Look out for announcements from Schoolink at the very top.',
  },
  {
    icon: MessageCircle,
    title: 'Chats and communities',
    text: 'Message people directly from Chats, or join communities for classes, clubs and teams. The Alerts tab tells you when something happens.',
  },
  {
    icon: User,
    title: 'Make it yours',
    text: 'Add a profile photo, apply to get verified, and pick your language in Settings. Open the menu at the top left any time to find everything.',
  },
]

function seenKey(userId) {
  return `schoolink_tour_seen_${userId}`
}

export default function OnboardingTour() {
  const { user, profile, isGuest, teamRole } = useAuth()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)

  const eligible = !!user && !!profile && !isGuest && !teamRole && pathname === '/home'

  useEffect(() => {
    if (!eligible) return
    let seen = true
    try {
      seen = !!localStorage.getItem(seenKey(user.id))
    } catch {
      seen = true // if storage is blocked, do not nag on every visit
    }
    if (!seen) setOpen(true)
  }, [eligible, user?.id])

  function finish() {
    try {
      localStorage.setItem(seenKey(user.id), '1')
    } catch {
      // ignore
    }
    setOpen(false)
  }

  if (!open || !eligible) return null

  const step = steps[index]
  const Icon = step.icon
  const last = index === steps.length - 1

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(5,3,25,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div
        style={{
          width: '100%', maxWidth: 360, borderRadius: 28, padding: '28px 22px 20px', textAlign: 'center', color: '#fff',
          background: 'linear-gradient(180deg, #2A1F7A 0%, #150F45 100%)',
          border: '1px solid rgba(139,92,246,0.5)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        <span
          style={{
            width: 72, height: 72, borderRadius: 22, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #8B5CF6, #4F46E5)', boxShadow: '0 0 28px rgba(124,92,255,0.6)',
          }}
        >
          <Icon size={36} color="#fff" />
        </span>
        <p style={{ fontSize: 21, fontWeight: 700, marginTop: 18 }}>{step.title}</p>
        <p style={{ fontSize: 14, lineHeight: 1.5, color: '#C7D2FE', marginTop: 8, minHeight: 84 }}>{step.text}</p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, margin: '10px 0 18px' }}>
          {steps.map((s, i) => (
            <span
              key={s.title}
              style={{
                width: i === index ? 20 : 7, height: 7, borderRadius: 999, transition: 'width 0.2s',
                background: i === index ? '#A78BFA' : 'rgba(199,210,254,0.35)',
              }}
            />
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={finish}
            style={{ flex: 1, padding: '12px 0', borderRadius: 16, fontSize: 14, color: '#C7D2FE' }}
          >
            {last ? '' : 'Skip'}
          </button>
          <button
            onClick={() => (last ? finish() : setIndex(index + 1))}
            style={{
              flex: 2, padding: '12px 0', borderRadius: 16, fontSize: 15, fontWeight: 600, color: '#fff',
              background: 'linear-gradient(90deg, #5B4BFF, #7C3AED)', boxShadow: '0 6px 20px rgba(91,75,255,0.45)',
            }}
          >
            {last ? 'Get started' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
    }
