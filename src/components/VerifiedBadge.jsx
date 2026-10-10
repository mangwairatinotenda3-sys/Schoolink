import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'

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
  ]).then(([users, schools]) => {
    if (!users.error) verifiedUserIds = new Set((users.data ?? []).map(r => r.id))
    if (!schools.error) verifiedSchoolIds = new Set((schools.data ?? []).map(r => r.id))
    loadedAt = Date.now()
    listeners.forEach(fn => fn())
  }).finally(() => { inflight = null })
  return inflight
}

function useVerifiedData() {
  const [, rerender] = useState(0)
  useEffect(() => {
    const fn = () => rerender(n => n + 1)
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

// REAL Meta starburst seal - with star around it + theme legible
export default function VerifiedBadge({ userId, schoolId, size = 18, className = '' }) {
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
      className={`inline-block shrink-0 align-middle ${className}`}
    >
      <title>Verified</title>
      
      {/* 1. White outer star - makes it pop on dark theme */}
      <g>
        <rect x="1.8" y="1.8" width="20.4" height="20.4" rx="6.8" fill="white" />
        <rect x="1.8" y="1.8" width="20.4" height="20.4" rx="6.8" fill="white" transform="rotate(45 12 12)" />
      </g>

      {/* 2. Blue starburst - the real Meta seal */}
      <g>
        <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5.5" fill="#1D9BF0" />
        <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5.5" fill="#1D9BF0" transform="rotate(45 12 12)" />
      </g>

      {/* 3. White tick */}
      <path
        d="M8 12.6L10.8 15.4L16.2 8.8"
        fill="none"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
  }
