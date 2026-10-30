import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'

// Paid School Plus is still read here, for features only.
// The gold badge is retired: verified schools show the blue badge from VerifiedBadge.
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

// Kept so old imports don't break. Renders nothing: the blue badge replaces the gold seal.
export function PlusSeal() {
  return null
}

export default function SchoolPlusBadge() {
  return null
  }
