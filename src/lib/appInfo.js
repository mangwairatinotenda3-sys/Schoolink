import { Capacitor } from '@capacitor/core'

let cached = null

// Which version of the app this is. On the website it is just "web".
export async function getAppInfo() {
  if (cached) return cached
  let info = { platform: Capacitor.getPlatform(), version: 'web', build: 0, native: Capacitor.isNativePlatform() }
  if (info.native) {
    try {
      const { App } = await import('@capacitor/app')
      const a = await App.getInfo()
      info = { ...info, version: a.version, build: Number(a.build) || 0 }
    } catch {
      // keep the defaults
    }
  }
  cached = info
  return info
}

// Which app store this phone most likely uses, so "Update" opens the right one.
export function guessStore() {
  const ua = navigator.userAgent || ''
  if (/huawei|honor|hmscore/i.test(ua)) return 'huawei'
  if (/silk|\bKF[A-Z]{2,}\b|\bAFT[A-Z]/i.test(ua)) return 'amazon'
  if (/samsung|\bSM-[A-Z0-9]+/i.test(ua)) return 'samsung'
  return 'play'
}

export const STORE_NAMES = {
  samsung: 'Samsung Galaxy Store',
  huawei: 'Huawei AppGallery',
  amazon: 'Amazon Appstore',
  play: 'Google Play',
}
