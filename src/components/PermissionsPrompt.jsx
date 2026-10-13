import { useState } from 'react'
import { Bell, Mic, Camera, Check, ImageIcon, ShieldCheck } from 'lucide-react'
import {
  isNativeApp, permissionsAlreadyAsked, markPermissionsAsked,
  requestMicrophone, requestCamera, requestNotifications,
} from '../lib/appPermissions.js'

const ITEMS = [
  { key: 'notifications', icon: Bell, title: 'Notifications', text: 'Messages, posts and school announcements.', ask: requestNotifications },
  { key: 'microphone', icon: Mic, title: 'Microphone', text: 'Send voice notes in chats.', ask: requestMicrophone },
  { key: 'camera', icon: Camera, title: 'Camera', text: 'Take photos for posts, statuses and your profile.', ask: requestCamera },
]

// Shown once, the first time the Android app is opened.
export default function PermissionsPrompt() {
  const [open, setOpen] = useState(() => isNativeApp() && !permissionsAlreadyAsked())
  const [state, setState] = useState({})
  const [busy, setBusy] = useState(false)

  if (!open) return null

  function finish() {
    markPermissionsAsked()
    setOpen(false)
  }

  async function allowOne(item) {
    const ok = await item.ask()
    setState((s) => ({ ...s, [item.key]: ok ? 'on' : 'off' }))
    return ok
  }

  async function allowAll() {
    setBusy(true)
    // One at a time, because Android shows one permission box at a time.
    for (const item of ITEMS) {
      if (state[item.key] !== 'on') await allowOne(item)
    }
    setBusy(false)
    finish()
  }

  return (
    <div className="fixed inset-0 z-[60] bg-white flex flex-col px-6 pt-14 pb-8 overflow-y-auto">
      <div className="flex flex-col items-center text-center">
        <img src="icon.svg" alt="" className="w-20 h-20 rounded-2xl shadow-md" />
        <h1 className="mt-5 text-2xl font-bold text-brand-navy">Welcome to Schoolink</h1>
        <p className="mt-2 text-sm text-gray-500">Allow a few things so the app works the way you expect.</p>
      </div>

      <div className="mt-8 space-y-3">
        {ITEMS.map((item) => {
          const Icon = item.icon
          const s = state[item.key]
          return (
            <div key={item.key} className="flex items-center gap-3 border border-gray-100 rounded-2xl p-3">
              <span className="w-10 h-10 rounded-full bg-brand-light flex items-center justify-center shrink-0">
                <Icon size={18} className="text-brand-purple" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="text-xs text-gray-400">{item.text}</p>
              </div>
              {s === 'on' ? (
                <span className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0"><Check size={16} className="text-green-600" /></span>
              ) : (
                <button onClick={() => allowOne(item)} disabled={busy} className="text-xs font-medium text-brand-purple border border-brand-purple rounded-full px-3 py-1.5 shrink-0 disabled:opacity-50">
                  {s === 'off' ? 'Try again' : 'Allow'}
                </button>
              )}
            </div>
          )
        })}
        <div className="flex items-center gap-3 border border-gray-100 rounded-2xl p-3">
          <span className="w-10 h-10 rounded-full bg-brand-light flex items-center justify-center shrink-0"><ImageIcon size={18} className="text-brand-purple" /></span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Photos and files</p>
            <p className="text-xs text-gray-400">You choose what to share each time, so nothing to allow.</p>
          </div>
          <Check size={16} className="text-green-600 shrink-0" />
        </div>
      </div>

      <p className="mt-4 text-[11px] text-gray-400 flex items-start gap-1.5">
        <ShieldCheck size={13} className="shrink-0 mt-0.5" />
        You can change any of these later in your phone's Settings → Apps → Schoolink → Permissions.
      </p>

      <div className="flex-1" />

      <button onClick={allowAll} disabled={busy} className="mt-6 w-full bg-brand-purple text-white font-medium py-3.5 rounded-xl disabled:opacity-60">
        {busy ? 'Waiting…' : 'Allow all'}
      </button>
      <button onClick={finish} disabled={busy} className="mt-2 w-full text-sm text-gray-500 py-2">Not now</button>
    </div>
  )
  }
