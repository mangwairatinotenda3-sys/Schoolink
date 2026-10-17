import { ChevronLeft } from 'lucide-react'

// The top bar used on full pages: back button, title, and buttons on the right.
export default function ScreenHeader({ title, onBack, right, sub }) {
  return (
    <div className="bg-white flex items-center justify-between px-3 shrink-0 border-b border-gray-100" style={{ height: 56 }}>
      <div className="flex items-center gap-1 min-w-0">
        <button onClick={onBack} aria-label="Back" className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"><ChevronLeft size={22} /></button>
        <div className="min-w-0">
          <h1 className="font-semibold text-lg leading-tight truncate">{title}</h1>
          {sub ? <p className="text-[11px] text-gray-400 leading-tight truncate -mt-0.5">{sub}</p> : null}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">{right}</div>
    </div>
  )
}
