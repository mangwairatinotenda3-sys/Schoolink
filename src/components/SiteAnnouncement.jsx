import { useEffect, useState } from 'react'
import { GraduationCap } from 'lucide-react'
import { supabase } from '../lib/supabaseClient.js'
import MetaBadge from './MetaBadge.jsx'

function timeLeft(expiresAt) {
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return 'Ended'
  const hours = Math.floor(ms / 3600000)
  if (hours >= 1) return `Ends in ${hours}h`
  return `Ends in ${Math.max(1, Math.floor(ms / 60000))}m`
}

// One update from the Schoolink team. The name is NOT clickable on purpose:
// nobody can open a profile from it. Inline colours keep it the same in every theme.
export function AnnouncementCard({ body, expiresAt, className = '' }) {
  return (
    <div
      className={`rounded-2xl p-4 ${className}`}
      style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', color: '#fff' }}
    >
      <div className="flex items-center gap-3 select-none" style={{ pointerEvents: 'none' }}>
        <span
          className="flex items-center justify-center shrink-0"
          style={{ width: 40, height: 40, borderRadius: 999, background: 'rgba(255,255,255,0.2)' }}
        >
          <GraduationCap size={22} color="#fff" />
        </span>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-semibold" style={{ color: '#fff' }}>
            Schoolink <MetaBadge size={17} />
          </p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>
            Update{expiresAt ? ` · ${timeLeft(expiresAt)}` : ''}
          </p>
        </div>
      </div>
      <p className="mt-3 text-sm whitespace-pre-wrap break-words" style={{ color: '#fff' }}>{body}</p>
    </div>
  )
}

// Shown at the very top of Home, for everybody, while an update is still live (48 hours).
export default function SiteAnnouncements() {
  const [items, setItems] = useState([])

  useEffect(() => {
    supabase
      .from('site_announcements')
      .select('id, body, expires_at')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(3)
      .then(({ data }) => setItems(data ?? []))
  }, [])

  if (items.length === 0) return null

  return (
    <div className="px-4 pt-4 space-y-3">
      {items.map((a) => (
        <AnnouncementCard key={a.id} body={a.body} expiresAt={a.expires_at} />
      ))}
    </div>
  )
}
