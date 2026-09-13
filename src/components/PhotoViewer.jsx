import { useRef, useState, useEffect } from 'react'
import { X, Download, Flag, Plus, Minus, Share2, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

function getDistance(touches) {
  const [a, b] = touches
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
}

export default function PhotoViewer({ images = [], initialIndex = 0, postId, onClose }) {
  const { user } = useAuth()
  const [showReport, setShowReport] = useState(false)
  const [reportSent, setReportSent] = useState(false)

  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const currentImage = images[currentIndex]

  const [scale, setScale] = useState(1)
  const [translate, setTranslate] = useState({ x: 0, y: 0 })
  const [imgLoaded, setImgLoaded] = useState(false)

  const containerRef = useRef(null)
  const imageRef = useRef(null)
  const touchStartX = useRef(0)

  const gesture = useRef({
    mode: null, // 'pinch' | 'pan' | 'swipe'
    startDistance: 0,
    startScale: 1,
    startTranslate: { x: 0, y: 0 },
    startPoint: { x: 0, y: 0 },
  })
  const lastTap = useRef(0)

  // HARD CLAMP: can't see background at all
  function clampTranslate(x, y, currentScale) {
    if (!containerRef.current ||!imageRef.current ||!imgLoaded) return { x: 0, y: 0 }
    const container = containerRef.current.getBoundingClientRect()
    const img = imageRef.current

    const containerRatio = container.width / container.height
    const imgRatio = img.naturalWidth / img.naturalHeight

    let renderedW, renderedH
    if (imgRatio > containerRatio) {
      renderedW = container.width
      renderedH = container.width / imgRatio
    } else {
      renderedH = container.height
      renderedW = container.height * imgRatio
    }

    const scaledW = renderedW * currentScale
    const scaledH = renderedH * currentScale

    const maxX = Math.max(0, (scaledW - container.width) / 2)
    const maxY = Math.max(0, (scaledH - container.height) / 2)

    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y))
    }
  }

  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX
    if (e.touches.length === 2) {
      gesture.current.mode = 'pinch'
      gesture.current.startDistance = getDistance(e.touches)
      gesture.current.startScale = scale
    } else if (e.touches.length === 1) {
      const now = Date.now()
      if (now - lastTap.current < 300) {
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
        gesture.current.startTranslate = {...translate }
      } else {
        gesture.current.mode = 'swipe'
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
      setTranslate(prev => clampTranslate(prev.x, prev.y, nextScale))
    } else if (gesture.current.mode === 'pan' && e.touches.length === 1) {
      e.preventDefault()
      const dx = e.touches[0].clientX - gesture.current.startPoint.x
      const dy = e.touches[0].clientY - gesture.current.startPoint.y
      const next = {
        x: gesture.current.startTranslate.x + dx,
        y: gesture.current.startTranslate.y + dy,
      }
      setTranslate(clampTranslate(next.x, next.y, scale))
    }
  }

  function handleTouchEnd(e) {
    if (gesture.current.mode === 'swipe' && scale === 1) {
      const touchEndX = e.changedTouches[0].clientX
      const diff = touchStartX.current - touchEndX
      if (Math.abs(diff) > 50) {
        if (diff > 0) goNext()
        else goPrev()
      }
    }
    if (e.touches.length === 0) {
      gesture.current.mode = null
      if (scale <= 1.05) {
        setScale(1)
        setTranslate({ x: 0, y: 0 })
      } else {
        setTranslate(prev => clampTranslate(prev.x, prev.y, scale))
      }
    }
  }

  function goPrev() {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
      setScale(1)
      setTranslate({ x: 0, y: 0 })
    }
  }

  function goNext() {
    if (currentIndex < images.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setScale(1)
      setTranslate({ x: 0, y: 0 })
    }
  }

  function zoomIn() { setScale(prev => Math.min(4, prev + 0.5)) }
  function zoomOut() {
    setScale(prev => {
      const next = Math.max(1, prev - 0.5)
      if (next === 1) setTranslate({ x: 0, y: 0 })
      return next
    })
  }

  async function handleShare() {
    if (navigator.share) {
      try { await navigator.share({ title: 'Schoolink Photo', url: currentImage }) } catch {}
    } else {
      navigator.clipboard.writeText(currentImage)
      alert('Link copied')
    }
  }

  function handleDownload() {
    const link = document.createElement('a')
    link.href = currentImage
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

  useEffect(() => {
    setScale(1)
    setTranslate({ x: 0, y: 0 })
    setImgLoaded(false)
  }, [currentIndex])

  return (
    <div className="fixed inset-0 bg-black z-50 flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 shrink-0 relative z-10 bg-black/80 backdrop-blur-sm">
        <button onClick={onClose}><X size={24} className="text-white" /></button>
        <div className="flex items-center gap-4">
          {images.length > 1 && <span className="text-sm font-medium text-white">{currentIndex + 1} / {images.length}</span>}
          <button onClick={handleShare}><Share2 size={20} className="text-white" /></button>
          <button onClick={handleDownload}><Download size={20} className="text-white" /></button>
          <button onClick={() => setShowReport(true)}><Flag size={20} className="text-white" /></button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center overflow-hidden bg-black relative"
        style={{ touchAction: 'none' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {images.length > 1 && currentIndex > 0 && (
          <button onClick={goPrev} className="absolute left-2 z-10 bg-white/20 rounded-full p-2"><ChevronLeft size={24} className="text-white" /></button>
        )}
        {images.length > 1 && currentIndex < images.length - 1 && (
          <button onClick={goNext} className="absolute right-2 z-10 bg-white/20 rounded-full p-2"><ChevronRight size={24} className="text-white" /></button>
        )}

        {!imgLoaded && <div className="absolute w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />}

        <img
          ref={imageRef}
          src={currentImage}
          alt=""
          draggable={false}
          onLoad={() => setImgLoaded(true)}
          className="max-w-full max-h-full select-none object-contain"
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transition: gesture.current.mode? 'none' : 'transform 0.15s ease-out',
            visibility: imgLoaded? 'visible' : 'hidden'
          }}
        />

        <div className="absolute bottom-16 right-4 flex-col gap-2 z-10">
          <button onClick={zoomIn} className="bg-white/20 rounded-full p-2"><Plus size={20} className="text-white" /></button>
          <button onClick={zoomOut} className="bg-white/20 rounded-full p-2"><Minus size={20} className="text-white" /></button>
        </div>
      </div>

      <p className="text-center text-white/40 text-xs pb-4 shrink-0 bg-black">
        Pinch to zoom · drag to move · swipe to switch · double-tap to reset
      </p>

      {showReport? (
        <div className="absolute inset-0 bg-black/70 flex items-end" onClick={() => setShowReport(false)}>
          <div className="bg-white rounded-t-2xl w-full p-4" onClick={(e) => e.stopPropagation()}>
            <p className="font-semibold text-sm mb-3">Report this photo</p>
            {['Inappropriate content', 'Spam', 'Harassment or bullying', 'Other'].map((reason) => (
              <button key={reason} onClick={() => handleReport(reason)} className="w-full text-left py-3 border-b border-gray-100 text-sm text-gray-700">{reason}</button>
            ))}
            <button onClick={() => setShowReport(false)} className="w-full text-center py-3 mt-2 text-sm text-gray-400">Cancel</button>
          </div>
        </div>
      ) : null}

      {reportSent? <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white rounded-full px-4 py-2 text-sm shadow-lg">Report submitted</div> : null}
    </div>
  )
  }
