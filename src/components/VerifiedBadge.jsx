import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import MetaBadge from './MetaBadge.jsx'

// Verified people come from one shared list, cached for 5 minutes.
// Verified schools are checked one at a time from the school itself,
// so a school that was just verified shows its badge straight away.
let verifiedUserIds = new Set()
let verifiedSchoolIds = new Set()
const schoolChecks = new Map() // schoolId -> { v: boolean, at: number }
const pendingChecks = new Set()
let loadedAt = 0
let inflight = null
const listeners = new Set()
const TTL_MS = 5 * 60 * 1000

function notify() {
  listeners.forEach((fn) => fn())
}

function checkSchool(schoolId, force = false) {
  if (!schoolId || pendingChecks.has(schoolId)) return
  const known = schoolChecks.get(schoolId)
  if (!force && known && Date.now() - known.at < TTL_MS) return
  pendingChecks.add(schoolId)
  supabase.from('schools').select('id, verified').eq('id', schoolId).maybeSingle()
    .then(({ data, error }) => {
      if (!error && data) schoolChecks.set(schoolId, { v: !!data.verified, at: Date.now() })
      notify()
    })
    .catch(() => {})
    .finally(() => pendingChecks.delete(schoolId))
}

export function refreshVerifiedIds(force = false) {
  if (inflight) return inflight
  if (!force && loadedAt && Date.now() - loadedAt < TTL_MS) return Promise.resolve()
  schoolChecks.forEach((_, id) => checkSchool(id, true))
  inflight = Promise.all([
    supabase.from('profiles').select('id').eq('is_verified', true).limit(5000),
    supabase.from('schools').select('id').eq('verified', true).limit(5000),
  ])
    .then(([users, schools]) => {
      if (!users.error) verifiedUserIds = new Set((users.data ?? []).map((r) => r.id))
      if (!schools.error) verifiedSchoolIds = new Set((schools.data ?? []).map((r) => r.id))
      loadedAt = Date.now()
      notify()
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
  useEffect(() => { checkSchool(schoolId) }, [schoolId])
  if (!schoolId) return false
  const known = schoolChecks.get(schoolId)
  if (known) return known.v
  return verifiedSchoolIds.has(schoolId)
}

// Meta-style blue badge (like Facebook, Instagram and WhatsApp). Pass userId
// for a person or schoolId for a school. Renders nothing when they aren't verified.
export default function VerifiedBadge({ userId, schoolId, size = 16, className = '' }) {
  const userVerified = useIsVerified(userId)
  const schoolVerified = useIsVerifiedSchool(schoolId)
  if (!(userVerified || schoolVerified)) return null
  return <MetaBadge size={size} className={className} />
    }
