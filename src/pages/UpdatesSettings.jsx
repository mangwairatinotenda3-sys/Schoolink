import { RefreshCw } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'

export default function UpdatesSettings() {
  function checkForUpdates() {
    window.location.reload(true)
  }

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader title="Updates" />
      <div className="flex-1 flex flex-col px-6 pt-4 items-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-brand-light flex items-center justify-center mt-8">
          <RefreshCw size={28} className="text-brand-purple" />
        </div>
        <p className="font-semibold mt-4">Schoolink</p>
        <p className="text-sm text-gray-400">You're on the latest version</p>
        <button
          onClick={checkForUpdates}
          className="mt-6 border border-brand-purple text-brand-purple font-medium py-2.5 px-6 rounded-xl text-sm"
        >
          Check for Updates
        </button>
      </div>
    </div>
  )
}
