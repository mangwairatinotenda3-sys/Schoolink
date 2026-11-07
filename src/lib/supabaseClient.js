import { ownerFromHeaders, cacheKey, readSaved, saveResponse } from './offlineCache.js'
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
  const method = (init?.method || (typeof input !== 'string' && input?.method) || 'GET').toUpperCase()
  const url = typeof input === 'string' ? input : input?.url || ''
  const headers = new Headers(init?.headers || (typeof input !== 'string' ? input?.headers : undefined) || {})
  const isRead = method === 'GET' && url.includes('/rest/v1/')
  const owner = isRead ? ownerFromHeaders(headers) : null
  const key = owner ? cacheKey(owner, url, headers) : null

  let res
  try {
    res = await fetch(input, init)
  } catch (networkError) {
    // No connection: show the last copy this phone saved for this person
    if (key) {
      const saved = await readSaved(key)
      if (saved) {
        return new Response(saved.body, {
          status: 200,
          headers: {
            'Content-Type': saved.contentType || 'application/json',
            ...(saved.contentRange ? { 'Content-Range': saved.contentRange } : {}),
            'X-Schoolink-Offline': '1',
          },
        })
      }
    }
    throw networkError
  }

  if (key && res.ok) {
    res.clone().text().then((body) => {
      saveResponse(key, body, res.headers.get('Content-Type'), res.headers.get('Content-Range'))
    }).catch(() => {})
  }

  try {
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
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
})
