import { useRef, useState } from 'react'
import { X, Download, Flag } from 'lucide-react'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

function getDistance(touches) {
  const [a, b] = touches
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
}

function getMidpoint(touches) {
  const [a, b] = touches
  return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 }
}

export default function PhotoViewer({ imageUrl, postId, onClose }) {
  const { user } = useAuth()
  const [showReport, setShowReport] = useState(false)
  const [reportSent, setReportSent] = useState(false)

  const [scale, setScale] = useState(1)
  const [translate, setTranslate] = useState({ x: 0, y: 0 })

  const gesture = useRef({
    mode: null, // 'pinch' | 'pan'
    startDistance: 0,
    startScale: 1,
    startTranslate: { x: 0, y: 0 },
    startPoint: { x: 0, y: 0 },
  })
  const lastTap = useRef(0)

  function handleTouchStart(e) {
    if (e.touches.length === 2) {
      gesture.current.mode = 'pinch'
      gesture.current.startDistance = getDistance(e.touches)
      gesture.current.startScale = scale
    } else if (e.touches.length === 1) {
      const now = Date.now()
      if (now - lastTap.current < 300) {
        // Double tap: toggle zoom
        if (scale > 1) {
          setScale(1)
          setTranslate({ x: 0, y: 0 })
        } else {
          setScale(2.5)
        }
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
      const newDistance = getDistance(e.touches)
      const ratio = newDistance / gesture.current.startDistance
      const nextScale = Math.min(4, Math.max(1, gesture.current.startScale * ratio))
      setScale(nextScale)
    } else if (gesture.current.mode === 'pan' && e.touches.length === 1) {
      e.preventDefault()
      const dx = e.touches[0].clientX - gesture.current.startPoint.x
      const dy = e.touches[0].clientY - gesture.current.startPoint.y
      setTranslate({
        x: gesture.current.startTranslate.x + dx,
        y: gesture.current.startTranslate.y + dy,
      })
    }
  }

  function handleTouchEnd(e) {
    if (e.touches.length === 0) {
      gesture.current.mode = null
      if (scale <= 1.05) {
        setScale(1)
        setTranslate({ x: 0, y: 0 })
      }
    }
  }

  function handleDownload() {
    const link = document.createElement('a')
    link.href = imageUrl
    link.download = `schoolink-photo-${postId || Date.now()}.jpg`
    link.target = '_blank'
    link.click()
  }

  async function handleReport(reason) {
    if (!user) return
    await supabase.from('reports').insert({ post_id: postId, reported_by: user.id, reason })
    setShowReport(false)
    setReportSent(true)
    setTimeout(() => setReportSent(false), 2000)
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 shrink-0 relative z-10">
        <button onClick={onClose}>
          <X size={24} className="text-white" />
        </button>
        <div className="flex items-center gap-4">
          <button onClick={handleDownload}>
            <Download size={20} className="text-white" />
          </button>
          <button onClick={() => setShowReport(true)}>
            <Flag size={20} className="text-white" />
          </button>
        </div>
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
          className="max-w-full max-h-full select-none"
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transition: gesture.current.mode ? 'none' : 'transform 0.15s ease-out',
          }}
        />
      </div>

      <p className="text-center text-white/40 text-xs pb-4 shrink-0">
        Pinch to zoom · drag to move · double-tap to reset
      </p>

      {showReport ? (
        <div className="absolute inset-0 bg-black/70 flex items-end" onClick={() => setShowReport(false)}>
          <div className="bg-white rounded-t-2xl w-full p-4" onClick={(e) => e.stopPropagation()}>
            <p className="font-semibold text-sm mb-3">Report this photo</p>
            {['Inappropriate content', 'Spam', 'Harassment or bullying', 'Other'].map((reason) => (
              <button
                key={reason}
                onClick={() => handleReport(reason)}
                className="w-full text-left py-3 border-b border-gray-100 text-sm text-gray-700"
              >
                {reason}
              </button>
            ))}
            <button
              onClick={() => setShowReport(false)}
              className="w-full text-center py-3 mt-2 text-sm text-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {reportSent ? (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white rounded-full px-4 py-2 text-sm">
          Report submitted
        </div>
      ) : null}
    </div>
  )
}
