import { supabase } from './supabaseClient.js'
import { getAppInfo } from './appInfo.js'

// Crash reports go to your own Supabase (table client_errors). No third party sees them.
// The person can turn them off in Settings → Data sharing.
const KEY = 'sl_crash_reports'

export function crashReportsEnabled() {
  try { return localStorage.getItem(KEY) !== '0' } catch { return true }
}
export function setCrashReportsEnabled(on) {
  try { localStorage.setItem(KEY, on ? '1' : '0') } catch { /* private mode */ }
}

let sent = 0
let lastError = ''
const seen = new Set()
const NOISE = /ResizeObserver loop|^Script error\.?$|NetworkError|Failed to fetch|Load failed|AbortError|cancelled|Importing a module script failed/i

export function getLastError() { return lastError }

export async function reportCrash(error, where = '') {
  try {
    const message = String(error?.message || error || 'Unknown error').slice(0, 500)
    if (NOISE.test(message)) return
    lastError = `${where ? where + ': ' : ''}${message}`
    if (!crashReportsEnabled()) return
    const stack = String(error?.stack || '')
    const key = message + (stack.split('\n')[1] || '')
    if (seen.has(key) || sent >= 8) return
    seen.add(key)
    sent += 1
    const info = await getAppInfo()
    const route = (window.location.hash || '').replace(/^#/, '').replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id').slice(0, 180)
    await supabase.from('client_errors').insert({
      message: (where ? where + ': ' : '') + message,
      stack: stack.slice(0, 3500),
      route,
      app_version: `${info.version} (${info.build})`.slice(0, 40),
      platform: info.platform,
      device: (navigator.userAgent || '').slice(0, 280),
    })
  } catch {
    // reporting must never cause a crash of its own
  }
}

let installed = false
export function installCrashReporter() {
  if (installed) return
  installed = true
  window.addEventListener('error', (e) => reportCrash(e.error || e.message, 'error'))
  window.addEventListener('unhandledrejection', (e) => reportCrash(e.reason, 'promise'))
}
