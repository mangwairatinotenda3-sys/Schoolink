import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const choices = [
  { key: 'wifi', label: 'Wi-Fi only', sub: 'Photos in chats load automatically on Wi-Fi; on mobile data you tap to load' },
  { key: 'always', label: 'Always', sub: 'Photos in chats always load automatically' },
  { key: 'never', label: 'Never', sub: 'Photos in chats always wait for a tap' },
]

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '—'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function StorageSettings() {
  const { profile, saveProfileDetails } = useAuth()
  const [pref, setPref] = useState(profile?.auto_download_media || 'wifi')
  const [usage, setUsage] = useState(null)
  const [quota, setQuota] = useState(null)
  const [cleared, setCleared] = useState(false)

  const connection = typeof navigator !== 'undefined' ? navigator.connection : null

  useEffect(() => {
    loadUsage()
  }, [])

  async function loadUsage() {
    if (navigator.storage?.estimate) {
      const { usage: u, quota: q } = await navigator.storage.estimate()
      setUsage(u ?? null)
      setQuota(q ?? null)
    }
  }

  async function choose(key) {
    setPref(key)
    await saveProfileDetails({ auto_download_media: key })
  }

  async function clearCache() {
    if ('caches' in window) {
      const names = await caches.keys()
      await Promise.all(names.map((n) => caches.delete(n)))
    }
    setCleared(true)
    setTimeout(() => setCleared(false), 2500)
    loadUsage()
  }

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader title="Storage and Data" />
      <div className="flex-1 flex flex-col px-6 pt-4 pb-8">
        <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Auto-download photos</p>
        {choices.map((c) => (
          <button
            key={c.key}
            onClick={() => choose(c.key)}
            className="w-full flex items-center justify-between py-3.5 border-b border-gray-100 text-left"
          >
            <span className="pr-4">
              <span className="block font-medium text-sm">{c.label}</span>
              <span className="block text-xs text-gray-400">{c.sub}</span>
            </span>
            <span
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                pref === c.key ? 'border-brand-purple' : 'border-gray-300'
              }`}
            >
              {pref === c.key ? <span className="w-2.5 h-2.5 rounded-full bg-brand-purple" /> : null}
            </span>
          </button>
        ))}

        <p className="text-xs font-semibold text-gray-400 uppercase mt-6 mb-2">Network usage</p>
        <div className="border border-gray-100 rounded-xl p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Connection</span>
            <span className="font-medium">
              {connection ? (connection.type || connection.effectiveType || 'Unknown') : 'Not reported by this browser'}
            </span>
          </div>
          {connection?.saveData ? (
            <p className="text-xs text-orange-500">Data Saver is on, so photos won't auto-load on "Wi-Fi only".</p>
          ) : null}
          <div className="flex justify-between">
            <span className="text-gray-500">Stored on this device</span>
            <span className="font-medium">
              {formatBytes(usage)}{quota ? ` of ${formatBytes(quota)}` : ''}
            </span>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Some browsers (including iPhone Safari) don't say whether you're on Wi-Fi, so "Wi-Fi only" loads photos there rather than hiding them.
        </p>

        <button
          onClick={clearCache}
          className="mt-6 w-full flex items-center justify-center gap-2 border border-red-100 text-red-500 rounded-xl py-3 text-sm font-medium"
        >
          <Trash2 size={16} /> Clear Cached Data
        </button>
        {cleared ? <p className="text-green-600 text-sm mt-2 text-center">Cache cleared.</p> : null}
      </div>
    </div>
  )
  }
