import { forwardRef, useImperativeHandle, useRef, useState } from 'react'

const MAX_SCALE = 5

// A photo you can pinch, drag and double-tap. The photo can never be dragged past its own edges,
// so you never see empty black space around a zoomed-in picture.
const ZoomImage = forwardRef(function ZoomImage({ src, onLoad, onSwipe, onSingleTap, className = '' }, ref) {
  const boxRef = useRef(null)
  const imgRef = useRef(null)
  const [view, setView] = useState({ s: 1, x: 0, y: 0 })
  const [moving, setMoving] = useState(false)
  const viewRef = useRef(view)
  const pointers = useRef(new Map())
  const gesture = useRef(null)
  const lastTap = useRef({ time: 0, x: 0, y: 0 })

  function apply(next) {
    viewRef.current = next
    setView(next)
  }

  function sizes() {
    const box = boxRef.current?.getBoundingClientRect()
    const img = imgRef.current
    if (!box || !img) return null
    return { box, w: img.offsetWidth, h: img.offsetHeight }
  }

  // Keeps the photo's edges at or beyond the screen's edges.
  function clamp(s, x, y) {
    const sz = sizes()
    if (!sz) return { s, x: 0, y: 0 }
    const maxX = Math.max(0, (sz.w * s - sz.box.width) / 2)
    const maxY = Math.max(0, (sz.h * s - sz.box.height) / 2)
    return { s, x: Math.min(maxX, Math.max(-maxX, x)), y: Math.min(maxY, Math.max(-maxY, y)) }
  }

  // Zoom to a new size while keeping the point under your fingers in place.
  function zoomAt(newScale, fx, fy, from = viewRef.current) {
    const s2 = Math.min(MAX_SCALE, Math.max(1, newScale))
    const ratio = s2 / from.s
    if (s2 === 1) return { s: 1, x: 0, y: 0 }
    return clamp(s2, fx - (fx - from.x) * ratio, fy - (fy - from.y) * ratio)
  }

  function center(e) {
    const box = boxRef.current.getBoundingClientRect()
    return { x: e.clientX - box.left - box.width / 2, y: e.clientY - box.top - box.height / 2 }
  }

  useImperativeHandle(ref, () => ({
    zoomBy(step) { apply(zoomAt(viewRef.current.s + step, 0, 0)) },
    reset() { apply({ s: 1, x: 0, y: 0 }) },
  }))

  function startGesture() {
    const pts = Array.from(pointers.current.values())
    const v = viewRef.current
    if (pts.length >= 2) {
      const box = boxRef.current.getBoundingClientRect()
      gesture.current = {
        mode: 'pinch',
        dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1,
        from: v,
        fx: (pts[0].x + pts[1].x) / 2 - box.left - box.width / 2,
        fy: (pts[0].y + pts[1].y) / 2 - box.top - box.height / 2,
      }
    } else if (pts.length === 1) {
      gesture.current = { mode: 'pan', startX: pts[0].x, startY: pts[0].y, from: v, moved: false }
    }
  }

  function handleDown(e) {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    setMoving(true)
    startGesture()
  }

  function handleMove(e) {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesture.current
    if (!g) return
    const pts = Array.from(pointers.current.values())
    if (g.mode === 'pinch' && pts.length >= 2) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      apply(zoomAt(g.from.s * (dist / g.dist), g.fx, g.fy, g.from))
    } else if (g.mode === 'pan' && pts.length === 1) {
      const dx = pts[0].x - g.startX
      const dy = pts[0].y - g.startY
      if (Math.abs(dx) + Math.abs(dy) > 6) g.moved = true
      if (g.from.s > 1) apply(clamp(g.from.s, g.from.x + dx, g.from.y + dy))
    }
  }

  function handleUp(e) {
    const g = gesture.current
    const wasPan = g && g.mode === 'pan'
    pointers.current.delete(e.pointerId)

    if (pointers.current.size > 0) {
      startGesture()
      return
    }
    setMoving(false)
    gesture.current = null
    if (!wasPan) return

    const dx = e.clientX - g.startX
    const dy = e.clientY - g.startY

    // Swipe sideways to switch photos (only when not zoomed in).
    if (g.from.s === 1 && g.moved && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      onSwipe?.(dx < 0 ? 'next' : 'prev')
      return
    }

    if (g.moved) return

    // A tap: two quick taps zoom in or back out.
    const now = Date.now()
    const prev = lastTap.current
    if (now - prev.time < 300 && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 40) {
      lastTap.current = { time: 0, x: 0, y: 0 }
      const c = center(e)
      apply(viewRef.current.s > 1 ? { s: 1, x: 0, y: 0 } : zoomAt(2.5, c.x, c.y))
      return
    }
    lastTap.current = { time: now, x: e.clientX, y: e.clientY }
    if (onSingleTap) setTimeout(() => { if (lastTap.current.time === now) onSingleTap() }, 310)
  }

  function handleWheel(e) {
    const c = center(e)
    apply(zoomAt(viewRef.current.s * (e.deltaY < 0 ? 1.15 : 1 / 1.15), c.x, c.y))
  }

  return (
    <div
      ref={boxRef}
      className={`relative w-full h-full overflow-hidden flex items-center justify-center select-none ${className}`}
      style={{ touchAction: 'none' }}
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
      onWheel={handleWheel}
    >
      <img
        ref={imgRef}
        src={src}
        alt=""
        draggable={false}
        onLoad={onLoad}
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: 'contain',
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})`,
          transition: moving ? 'none' : 'transform 0.18s ease-out',
          userSelect: 'none',
          WebkitUserDrag: 'none',
        }}
      />
    </div>
  )
}) 

export default ZoomImage
