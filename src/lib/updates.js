import { getAppInfo, guessStore, STORE_NAMES } from './appInfo.js'
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

// The best update link for this phone: its app store if one is filled in, otherwise the APK download.
export function storeLinkFor(latest) {
  const stores = latest?.stores || {}
  const mine = guessStore()
  if (stores[mine]) return { store: mine, url: stores[mine] }
  for (const k of ['samsung', 'huawei', 'amazon', 'play']) if (stores[k]) return { store: k, url: stores[k] }
  if (latest?.apkUrl) return { store: 'direct', url: latest.apkUrl }
  return { store: mine, url: '' }
}

// Button and subtitle wording for each kind of update link.
export function updateLabel(store) {
  return store === 'direct' ? 'Download update' : `Update in ${STORE_NAMES[store] || 'your app store'}`
}

export function updateSubtitle(store) {
  return store === 'direct' ? 'Install it over this app. Your data stays' : `Update in ${STORE_NAMES[store] || 'your app store'}`
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
