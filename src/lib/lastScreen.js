const KEY = 'schoolink_last_screen'
const MAX_AGE_MS = 15 * 60 * 1000

// Screens that should never be reopened: sign-in, setup, and the staff areas.
const SKIP_PREFIXES = ['/welcome', '/login', '/signup', '/onboarding', '/controller', '/admin', '/reset']

// Remembers the screen the person is on, so the app can reopen it after Android restarts it.
export function rememberScreen(path) {
  if (!path || path === '/' || SKIP_PREFIXES.some((p) => path.startsWith(p))) return
  try {
    localStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() }))
  } catch {
    // ignore
  }
}

// The screen to reopen, or null when there is none or it is too old.
export function savedScreen() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const { path, at } = JSON.parse(raw)
    if (typeof path !== 'string' || !path.startsWith('/') || Date.now() - at > MAX_AGE_MS) return null
    return path
  } catch {
    return null
  }
}
