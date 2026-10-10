import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'

// One shared lookup of verified people and schools for the whole app. It is
// fetched once, cached for 5 minutes, and every badge on screen reads from it —
// so adding a badge next to a name costs no extra request.
let verifiedUserIds = new Set()
let verifiedSchoolIds = new Set()
let loadedAt = 0
let inflight = null
const listeners = new Set()
const TTL_MS = 5 * 60 * 1000

export function refreshVerifiedIds(force = false) {
  if (inflight) return inflight
  if (!force && loadedAt && Date.now() - loadedAt < TTL_MS) return Promise.resolve()
  inflight = Promise.all([
    supabase.from('profiles').select('id').eq('is_verified', true).limit(5000),
    supabase.from('schools').select('id').eq('verified', true).limit(5000),
  ])
    .then(([users, schools]) => {
      if (!users.error) verifiedUserIds = new Set((users.data ?? []).map((r) => r.id))
      if (!schools.error) verifiedSchoolIds = new Set((schools.data ?? []).map((r) => r.id))
      loadedAt = Date.now()
      listeners.forEach((fn) => fn())
    })
    .finally(() => { inflight = null })
  return inflight
}

function useVerifiedData() {
  const [, rerender] = useState(0)
  useEffect(() => {
    const fn = () => rerender((n) => n + 1)
    listeners.add(fn)
    refreshVerifiedIds()
    return () => listeners.delete(fn)
  }, [])
}

export function useIsVerified(userId) {
  useVerifiedData()
  return !!userId && verifiedUserIds.has(userId)
}

export function useIsVerifiedSchool(schoolId) {
  useVerifiedData()
  return !!schoolId && verifiedSchoolIds.has(schoolId)
}

// Blue seal with a white tick. Pass userId for a person or schoolId for a
// school. Renders nothing when they aren't verified.
export default function VerifiedBadge({ userId, schoolId, size = 16, className = '' }) {
  const userVerified = useIsVerified(userId)
  const schoolVerified = useIsVerifiedSchool(schoolId)
  if (!(userVerified || schoolVerified)) return null
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label="Verified"
      className={`inline-block shrink-0 ${className}`}
    >
      <title>Verified</title>
      <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5.5" fill="#1D9BF0" />
      <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5.5" fill="#1D9BF0" transform="rotate(45 12 12)" />
      <path d="M8 12.4l2.7 2.7 5.3-5.6" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
  }
