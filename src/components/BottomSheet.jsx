import { useEffect } from 'react'

// A sheet that slides up from the bottom, like on a phone. Tap outside to close.
export default function BottomSheet({ onClose, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45" style={{ animation: 'sl-fade 160ms ease-out' }} onClick={onClose}>
      <style>{'@keyframes sl-fade{from{opacity:0}to{opacity:1}}@keyframes sl-sheet-up{from{transform:translateY(100%)}to{transform:none}}'}</style>
      <div
        className="bg-white w-full max-w-[480px] rounded-t-3xl pt-2 pb-8 px-2 max-h-[85dvh] overflow-y-auto"
        style={{ animation: 'sl-sheet-up 220ms cubic-bezier(.2,.8,.2,1)', paddingBottom: 'max(32px, env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-2" />
        {children}
      </div>
    </div>
  )
}

export function SheetAction({ icon: Icon, label, sub, onClick, danger = false }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-left active:bg-gray-100 ${danger ? 'text-red-500' : ''}`}>
      <Icon size={20} className={danger ? '' : 'text-gray-500'} />
      <span className="flex-1 min-w-0">
        <span className="block text-[15px]">{label}</span>
        {sub ? <span className="block text-xs text-gray-400 mt-0.5">{sub}</span> : null}
      </span>
    </button>
  )
}
