import { createClient } from '@supabase/supabase-js'
import { isGuestMode, askToSignIn } from './guestShield.js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase env vars are missing. Copy .env.example to .env and fill in ' +
      'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  )
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '')

// Guests can look but not change anything — except send help and feedback.
// (The database blocks it too; this just gives a friendly "sign in" box
// instead of an error, and stops screens from showing a fake "liked" state.)
const GUEST_CAN_WRITE = new Set(['app_feedback', 'login_history', 'profiles'])
const WRITE_METHODS = ['insert', 'upsert', 'update', 'delete']
const realFrom = supabase.from.bind(supabase)

function blockedQuery() {
  const error = { message: 'Create an account to do this.', code: 'guest_blocked' }
  const failed = Promise.reject(error)
  failed.catch(() => {})
  const proxy = new Proxy(function () {}, {
    get(_target, key) {
      if (key === 'then' || key === 'catch' || key === 'finally') return failed[key].bind(failed)
      return () => proxy
    },
  })
  return proxy
}

supabase.from = (table) => {
  const query = realFrom(table)
  if (!isGuestMode() || GUEST_CAN_WRITE.has(table)) return query
  for (const method of WRITE_METHODS) {
    query[method] = () => {
      askToSignIn('action')
      return blockedQuery()
    }
  }
  return query
}
