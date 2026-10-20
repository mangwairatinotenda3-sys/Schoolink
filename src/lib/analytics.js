import { supabase } from './supabaseClient.js'
import { getAppInfo } from './appInfo.js'

// Anonymous "which screens do people use" counts. Off unless the person turns it on.
// It sends the screen name only, never names, emails or what you type.
const CONSENT = 'sl_analytics'
const INSTALL = 'sl_install_id'

export function analyticsEnabled() {
  try { return localStorage.getItem(CONSENT) === '1' } catch { return false }
}
export function setAnalyticsEnabled(on) {
  try { localStorage.setItem(CONSENT, on ? '1' : '0') } catch { /* private mode */ }
  if (!on) queue = []
}

function installId() {
  try {
    let id = localStorage.getItem(INSTALL)
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now())
      localStorage.setItem(INSTALL, id)
    }
    return id
  } catch {
    return 'unknown'
  }
}

function normalise(path) {
  return String(path || '/')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    .replace(/\/\d+(?=\/|$)/g, '/:n')
    .replace(/^\/join\/.*/, '/join/:code')
    .replace(/^\/communities\/join\/.*/, '/communities/join/:code')
    .slice(0, 100)
}

let queue = []
let last = ''
let timer = null

async function flush() {
  clearTimeout(timer)
  timer = null
  if (queue.length === 0 || !analyticsEnabled()) { queue = []; return }
  const batch = queue
  queue = []
  try {
    const info = await getAppInfo()
    const id = installId()
    const rows = batch.map((screen) => ({ install_id: id, screen, platform: info.platform, app_version: `${info.version} (${info.build})`.slice(0, 40) }))
    await supabase.from('app_events').insert(rows)
  } catch {
    // usage numbers are optional; drop them on failure
  }
}

export function trackScreen(path) {
  if (!analyticsEnabled()) return
  const screen = normalise(path)
  if (screen === last) return
  last = screen
  queue.push(screen)
  if (queue.length >= 15) flush()
  else if (!timer) timer = setTimeout(flush, 20000)
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush() })
}
