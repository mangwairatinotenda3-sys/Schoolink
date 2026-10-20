import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Download, X } from 'lucide-react'
import { checkForUpdate, storeLinkFor, openLink } from '../lib/updates.js'
import { STORE_NAMES } from '../lib/appInfo.js'

const DISMISS = 'sl_update_dismissed'
const CHECKED = 'sl_update_checked_at'

// In the phone app: a small card when a newer version exists, and a full screen when this one is too old to use.
export default function UpdatePrompt() {
  const [result, setResult] = useState(null)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined
    let cancelled = false
    async function run(force) {
      try {
        const last = Number(localStorage.getItem(CHECKED) || 0)
        if (!force && Date.now() - last < 6 * 3600 * 1000) return
        const r = await checkForUpdate()
        localStorage.setItem(CHECKED, String(Date.now()))
        if (!cancelled) setResult(r)
      } catch {
        // offline: try again next time
      }
    }
    run(true)
    const onVisible = () => { if (document.visibilityState === 'visible') run(false) }
    document.addEventListener('visibilitychange', onVisible)
    return () => { cancelled = true; document.removeEventListener('visibilitychange', onVisible) }
  }, [])

  if (!result || (result.state !== 'available' && result.state !== 'required')) return null

  const { latest, state } = result
  const { store, url } = storeLinkFor(latest)
  const storeName = STORE_NAMES[store]

  if (state === 'available') {
    let dismissed = false
    try { dismissed = localStorage.getItem(DISMISS) === String(latest.versionCode) } catch { /* ignore */ }
    if (hidden || dismissed) return null
    return (
      <div className="fixed left-0 right-0 z-[88] flex justify-center px-4" style={{ bottom: 92 }}>
        <div className="w-full max-w-[440px] rounded-2xl bg-gray-900 text-white p-3.5 shadow-xl flex items-center gap-3">
          <span className="w-10 h-10 rounded-full bg-brand-purple flex items-center justify-center shrink-0"><Download size={18} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Schoolink {latest.versionName} is ready</p>
            <p className="text-xs text-gray-300 truncate">{url ? `Update in ${storeName}` : 'Open your app store to update'}</p>
          </div>
          {url ? <button onClick={() => openLink(url)} className="bg-white text-gray-900 text-sm font-semibold rounded-full px-4 py-2">Update</button> : null}
          <button
            aria-label="Dismiss"
            onClick={() => { try { localStorage.setItem(DISMISS, String(latest.versionCode)) } catch { /* ignore */ } setHidden(true) }}
            className="p-1 text-gray-400"
          ><X size={18} /></button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[120] bg-white flex flex-col items-center justify-center text-center px-8" role="alertdialog" aria-modal="true">
      <span className="w-20 h-20 rounded-full bg-brand-light flex items-center justify-center"><Download size={34} className="text-brand-purple" /></span>
      <h1 className="text-2xl font-bold mt-5">Please update Schoolink</h1>
      <p className="text-sm text-gray-500 mt-2 max-w-[320px]">This version is too old to keep working. {latest.notes || ''}</p>
      {url ? (
        <button onClick={() => openLink(url)} className="mt-6 bg-brand-purple text-white font-semibold rounded-full px-8 py-3.5">Update in {storeName}</button>
      ) : (
        <p className="text-sm text-gray-400 mt-6">Open your app store and update Schoolink.</p>
      )}
    </div>
  )
}
