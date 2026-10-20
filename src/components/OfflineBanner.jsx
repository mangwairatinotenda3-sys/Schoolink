import { useEffect, useRef, useState } from 'react'
import { WifiOff, Wifi } from 'lucide-react'

// A slim bar at the top: "No internet connection" while offline, "Back online" for a moment after.
export default function OfflineBanner() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  const [back, setBack] = useState(false)
  const timer = useRef(null)

  useEffect(() => {
    const off = () => { clearTimeout(timer.current); setBack(false); setOnline(false) }
    const on = () => {
      setOnline(true)
      setBack(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setBack(false), 2500)
    }
    window.addEventListener('offline', off)
    window.addEventListener('online', on)
    return () => { window.removeEventListener('offline', off); window.removeEventListener('online', on); clearTimeout(timer.current) }
  }, [])

  if (online && !back) return null
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-0 right-0 z-[85] flex justify-center pointer-events-none"
      style={{ top: 'max(8px, env(safe-area-inset-top))' }}
    >
      <div
        className={`flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold shadow-lg text-white ${online ? 'bg-green-600' : 'bg-gray-900'}`}
        style={{ animation: 'sl-drop 220ms cubic-bezier(.2,.8,.2,1)' }}
      >
        <style>{'@keyframes sl-drop{from{transform:translateY(-16px);opacity:0}to{transform:none;opacity:1}}'}</style>
        {online ? <Wifi size={15} /> : <WifiOff size={15} />}
        {online ? 'Back online' : 'No internet connection'}
      </div>
    </div>
  )
}
