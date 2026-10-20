import { getAppInfo, guessStore } from './appInfo.js'
import { SITE_URL } from './legal.js'

// The newest version is described in public/app-version.json (published with the website).
const URL = `${SITE_URL}/app-version.json`

export async function checkForUpdate() {
  const info = await getAppInfo()
  const res = await fetch(`${URL}?t=${Date.now()}`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Could not reach the update server')
  const latest = await res.json()
  if (!info.native) return { state: 'web', info, latest }
  if (latest.minVersionCode && info.build < latest.minVersionCode) return { state: 'required', info, latest }
  if (latest.versionCode && info.build < latest.versionCode) return { state: 'available', info, latest }
  return { state: 'latest', info, latest }
}

// The best store link for this phone, or '' when none has been filled in yet.
export function storeLinkFor(latest) {
  const stores = latest?.stores || {}
  const mine = guessStore()
  if (stores[mine]) return { store: mine, url: stores[mine] }
  for (const k of ['samsung', 'huawei', 'amazon', 'play']) if (stores[k]) return { store: k, url: stores[k] }
  return { store: mine, url: '' }
}

export async function openLink(url) {
  if (!url) return
  try {
    const { Browser } = await import('@capacitor/browser')
    await Browser.open({ url })
  } catch {
    window.open(url, '_blank', 'noopener')
  }
    }
