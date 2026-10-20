import { useEffect, useState } from 'react'
import { RefreshCw, CheckCircle2, Download, Globe } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { checkForUpdate, storeLinkFor, openLink } from '../lib/updates.js'
import { getAppInfo, STORE_NAMES } from '../lib/appInfo.js'

export default function UpdatesSettings() {
  const [info, setInfo] = useState(null)
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { getAppInfo().then(setInfo) }, [])
  useEffect(() => { check() }, [])

  async function check() {
    setBusy(true)
    setError('')
    try {
      setResult(await checkForUpdate())
    } catch {
      setError("Couldn't check right now. Make sure you're online and try again.")
    }
    setBusy(false)
  }

  const state = result?.state
  const link = result ? storeLinkFor(result.latest) : null

  return (
    <div className="app-shell">
      <BackHeader title="Updates" />
      <div className="screen-scroll px-6 pt-4 flex flex-col items-center text-center">
        <span className="w-20 h-20 rounded-3xl bg-brand-light flex items-center justify-center mt-6">
          {state === 'available' || state === 'required' ? <Download size={34} className="text-brand-purple" /> : state === 'web' ? <Globe size={34} className="text-brand-purple" /> : <CheckCircle2 size={34} className="text-brand-purple" />}
        </span>
        <p className="font-bold text-xl mt-4">Schoolink</p>
        <p className="text-sm text-gray-400 mt-0.5">{info?.native ? `Version ${info.version} (${info.build})` : 'Web app'}</p>

        {error ? <p className="text-sm text-red-500 mt-6">{error}</p> : null}
        {!error && state === 'latest' ? <p className="text-[15px] font-medium mt-6">You’re on the latest version</p> : null}
        {!error && state === 'web' ? <p className="text-[15px] font-medium mt-6">The web app always updates itself</p> : null}
        {!error && (state === 'available' || state === 'required') ? (
          <div className="mt-6 w-full rounded-2xl bg-gray-50 p-4 text-left">
            <p className="font-semibold">Version {result.latest.versionName} is available</p>
            {result.latest.notes ? <p className="text-sm text-gray-500 mt-1.5 leading-snug">{result.latest.notes}</p> : null}
            {link?.url ? (
              <button onClick={() => openLink(link.url)} className="mt-4 w-full bg-brand-purple text-white font-semibold rounded-full py-3">Update in {STORE_NAMES[link.store]}</button>
            ) : (
              <p className="text-sm text-gray-500 mt-3">Open your app store and update Schoolink.</p>
            )}
          </div>
        ) : null}

        <button onClick={check} disabled={busy} className="mt-6 flex items-center gap-2 text-brand-purple font-semibold text-sm disabled:opacity-50">
          <RefreshCw size={16} className={busy ? 'animate-spin' : ''} /> {busy ? 'Checking…' : 'Check again'}
        </button>
      </div>
    </div>
  )
    }
