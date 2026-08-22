import { Trash2 } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'

export default function StorageSettings() {
  function clearCache() {
    if ('caches' in window) {
      caches.keys().then((names) => names.forEach((n) => caches.delete(n)))
    }
    alert('Cache cleared. You may need to reload the app.')
  }

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader title="Storage and Data" />
      <div className="flex-1 flex flex-col px-6 pt-4">
        <div className="border border-gray-100 rounded-xl p-4">
          <p className="font-medium text-sm">Network Usage</p>
          <p className="text-xs text-gray-400 mt-1">
            Schoolink loads photos and posts as you scroll. There's no option to restrict this yet.
          </p>
        </div>

        <button
          onClick={clearCache}
          className="mt-4 w-full flex items-center justify-center gap-2 border border-red-100 text-red-500 rounded-xl py-3 text-sm font-medium"
        >
          <Trash2 size={16} /> Clear Cached Data
        </button>
      </div>
    </div>
  )
}
