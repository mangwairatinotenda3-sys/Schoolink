import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase env vars are missing. Copy .env.example to .env and fill in ' +
      'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  )
}

// When the database says "slow down" (too many posts or messages) or "this account is suspended",
// tell the rest of the app so it can show a friendly message, whichever screen sent the request.
async function watchedFetch(input, init) {
  const res = await fetch(input, init)
  try {
    const url = typeof input === 'string' ? input : input?.url || ''
    if ((res.status === 429 || res.status === 403) && url.includes('/rest/v1/')) {
      const body = await res.clone().json().catch(() => null)
      const message = String(body?.message || '')
      if (res.status === 429 && /too fast|few times/i.test(message)) {
        window.dispatchEvent(new CustomEvent('schoolink:limit', { detail: { message } }))
      } else if (res.status === 403 && /suspended/i.test(message)) {
        window.dispatchEvent(new CustomEvent('schoolink:suspended'))
      }
    }
  } catch {
    // never let this get in the way of the real request
  }
  return res
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  global: { fetch: watchedFetch },
})
