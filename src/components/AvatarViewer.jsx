import { useRef, useState } from 'react'
import { X } from 'lucide-react'

function getDistance(touches) {
  const [a, b] = touches
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
}

export default function AvatarViewer({ imageUrl, onClose }) {
  const [scale, setScale] = useState(1)
  const [translate, setTranslate] = useState({ x: 0, y: 0 })
  const gesture = useRef({ mode: null, startDistance: 0, startScale: 1, startTranslate: { x: 0, y: 0 }, startPoint: { x: 0, y: 0 } })
  const lastTap = useRef(0)

  function handleTouchStart(e) {
    if (e.touches.length === 2) {
      gesture.current.mode = 'pinch'
      gesture.current.startDistance = getDistance(e.touches)
      gesture.current.startScale = scale
    } else if (e.touches.length === 1) {
      const now = Date.now()
      if (now - lastTap.current < 300) {
        if (scale > 1) { setScale(1); setTranslate({ x: 0, y: 0 }) } else { setScale(2.5) }
        lastTap.current = 0
        return
      }
      lastTap.current = now
      if (scale > 1) {
        gesture.current.mode = 'pan'
        gesture.current.startPoint = { x: e.touches[0].clientX, y: e.touches[0].clientY }
        gesture.current.startTranslate = { ...translate }
      }
    }
  }

  function handleTouchMove(e) {
    if (gesture.current.mode === 'pinch' && e.touches.length === 2) {
      e.preventDefault()
      const ratio = getDistance(e.touches) / gesture.current.startDistance
      setScale(Math.min(4, Math.max(1, gesture.current.startScale * ratio)))
    } else if (gesture.current.mode === 'pan' && e.touches.length === 1) {
      e.preventDefault()
      const dx = e.touches[0].clientX - gesture.current.startPoint.x
      const dy = e.touches[0].clientY - gesture.current.startPoint.y
      setTranslate({ x: gesture.current.startTranslate.x + dx, y: gesture.current.startTranslate.y + dy })
    }
  }

  function handleTouchEnd(e) {
    if (e.touches.length === 0) {
      gesture.current.mode = null
      if (scale <= 1.05) { setScale(1); setTranslate({ x: 0, y: 0 }) }
    }
  }

  if (!imageUrl) return null

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="flex items-center justify-end px-4 py-3 shrink-0">
        <button onClick={onClose}><X size={24} className="text-white" /></button>
      </div>
      <div
        className="flex-1 flex items-center justify-center overflow-hidden"
        style={{ touchAction: 'none' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <img
          src={imageUrl}
          alt=""
          draggable={false}
          className="max-w-full max-h-full select-none rounded-full"
          style={{ transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`, transition: gesture.current.mode ? 'none' : 'transform 0.15s ease-out' }}
        />
      </div>
      <p className="text-center text-white/40 text-xs pb-6 shrink-0">Pinch to zoom · double-tap to reset</p>
    </div>
  )
}
