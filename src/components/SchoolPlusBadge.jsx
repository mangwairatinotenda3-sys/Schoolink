import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'

// "School Plus" is the paid verification. It is shown only on the school's own
// profile and school settings, and it looks different from the free blue tick.
let plusIds = new Set()
let loadedAt = 0
let inflight = null
const listeners = new Set()
const TTL_MS = 2 * 60 * 1000

export function refreshPlusSchools(force = false) {
  if (inflight) return inflight
  if (!force && loadedAt && Date.now() - loadedAt < TTL_MS) return Promise.resolve()
  inflight = supabase
    .from('school_subscriptions')
    .select('school_id')
    .gt('expires_at', new Date().toISOString())
    .limit(5000)
    .then(({ data, error }) => {
      if (!error) plusIds = new Set((data ?? []).map((r) => r.school_id))
      loadedAt = Date.now()
      listeners.forEach((fn) => fn())
    })
    .finally(() => { inflight = null })
  return inflight
}

export function useIsPlusSchool(schoolId) {
  const [, rerender] = useState(0)
  useEffect(() => {
    const fn = () => rerender((n) => n + 1)
    listeners.add(fn)
    refreshPlusSchools()
    return () => listeners.delete(fn)
  }, [])
  return !!schoolId && plusIds.has(schoolId)
}

// A gold shield with a tick: easy to tell apart from the blue profile tick.
export function PlusSeal({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="School Plus verified" className={`inline-block shrink-0 ${className}`}>
      <title>School Plus verified</title>
      <defs>
        <linearGradient id="plus-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FCD34D" />
          <stop offset="1" stopColor="#D97706" />
        </linearGradient>
      </defs>
      <path d="M12 1.8l8 3v6.3c0 5-3.3 9.2-8 11.1-4.7-1.9-8-6.1-8-11.1V4.8l8-3z" fill="url(#plus-gold)" stroke="#B45309" strokeWidth="0.8" strokeLinejoin="round" />
      <path d="M8 12.2l2.8 2.8 5.2-5.6" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function SchoolPlusBadge({ schoolId, size = 18, className = '' }) {
  const active = useIsPlusSchool(schoolId)
  if (!active) return null
  return <PlusSeal size={size} className={className} />
}
