import { useEffect, useRef, useState } from 'react'
import { X, Check, Loader2 } from 'lucide-react'

const MAX_ZOOM = 5

// The "adjust your photo" screen shown before a profile picture is saved.
// Move and zoom the photo inside the frame; what you see in the frame is exactly what gets saved.
export default function ImageCropper({ file, round = true, aspect = 1, title = 'Adjust photo', onCancel, onDone }) {
  const stageRef = useRef(null)
  const [src, setSrc] = useState(null)
  const [natural, setNatural] = useState(null)
  const [stage, setStage] = useState({ w: 0, h: 0 })
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 })
  const [saving, setSaving] = useState(false)
  const imgRef = useRef(null)
  const viewRef = useRef(view)
  const pointers = useRef(new Map())
  const gesture = useRef(null)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  useEffect(() => {
    function measure() {
      const r = stageRef.current?.getBoundingClientRect()
      if (r) setStage({ w: r.width, h: r.height })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // The frame: as wide as fits, keeping the wanted shape.
  const frameW = Math.min(stage.w * 0.9, stage.h * 0.8 * aspect)
  const frameH = frameW / aspect
  const base = natural ? Math.max(frameW / natural.w, frameH / natural.h) : 1

  function apply(next) {
    viewRef.current = next
    setView(next)
  }

  function clamp(zoom, x, y) {
    if (!natural) return { zoom, x: 0, y: 0 }
    const k = base * zoom
    const maxX = Math.max(0, (natural.w * k - frameW) / 2)
    const maxY = Math.max(0, (natural.h * k - frameH) / 2)
    return { zoom, x: Math.min(maxX, Math.max(-maxX, x)), y: Math.min(maxY, Math.max(-maxY, y)) }
  }

  function zoomAt(newZoom, fx, fy, from = viewRef.current) {
    const z = Math.min(MAX_ZOOM, Math.max(1, newZoom))
    const ratio = z / from.zoom
    return clamp(z, fx - (fx - from.x) * ratio, fy - (fy - from.y) * ratio)
  }

  function startGesture() {
    const pts = Array.from(pointers.current.values())
    const box = stageRef.current.getBoundingClientRect()
    if (pts.length >= 2) {
      gesture.current = {
        mode: 'pinch',
        dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1,
        from: viewRef.current,
        fx: (pts[0].x + pts[1].x) / 2 - box.left - box.width / 2,
        fy: (pts[0].y + pts[1].y) / 2 - box.top - box.height / 2,
      }
    } else if (pts.length === 1) {
      gesture.current = { mode: 'pan', startX: pts[0].x, startY: pts[0].y, from: viewRef.current }
    }
  }

  function handleDown(e) {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    startGesture()
  }

  function handleMove(e) {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesture.current
    const pts = Array.from(pointers.current.values())
    if (g.mode === 'pinch' && pts.length >= 2) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      apply(zoomAt(g.from.zoom * (dist / g.dist), g.fx, g.fy, g.from))
    } else if (g.mode === 'pan' && pts.length === 1) {
      apply(clamp(g.from.zoom, g.from.x + (pts[0].x - g.startX), g.from.y + (pts[0].y - g.startY)))
    }
  }

  function handleUp(e) {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size > 0) startGesture()
    else gesture.current = null
  }

  function handleWheel(e) {
    apply(zoomAt(viewRef.current.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), 0, 0))
  }

  function handleSlider(e) {
    apply(zoomAt(Number(e.target.value), 0, 0))
  }

  // Cuts out exactly what is inside the frame.
  function save() {
    if (!natural || !imgRef.current || saving) return
    setSaving(true)
    const k = base * view.zoom
    const left = stage.w / 2 + view.x - (natural.w * k) / 2
    const top = stage.h / 2 + view.y - (natural.h * k) / 2
    const frameLeft = (stage.w - frameW) / 2
    const frameTop = (stage.h - frameH) / 2
    const sx = (frameLeft - left) / k
    const sy = (frameTop - top) / k
    const sw = frameW / k
    const sh = frameH / k
    const outW = round || aspect <= 1 ? 640 : 1280
    const outH = Math.round(outW / aspect)
    const canvas = document.createElement('canvas')
    canvas.width = outW
    canvas.height = outH
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, outW, outH)
    ctx.drawImage(imgRef.current, sx, sy, sw, sh, 0, 0, outW, outH)
    canvas.toBlob((blob) => {
      if (!blob) {
        setSaving(false)
        return
      }
      Promise.resolve(onDone(blob)).finally(() => setSaving(false))
    }, 'image/jpeg', 0.9)
  }

  const k = base * view.zoom

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <button onClick={onCancel} disabled={saving} aria-label="Cancel" className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center"><X size={20} className="text-white" /></button>
        <p className="text-white text-sm font-medium">{title}</p>
        <span className="w-10" />
      </div>

      <div
        ref={stageRef}
        className="flex-1 min-h-0 relative overflow-hidden"
        style={{ touchAction: 'none' }}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
        onWheel={handleWheel}
      >
        {src ? (
          <img
            ref={imgRef}
            src={src}
            alt=""
            draggable={false}
            onLoad={(e) => setNatural({ w: e.target.naturalWidth, h: e.target.naturalHeight })}
            className="absolute select-none max-w-none"
            style={{
              left: '50%',
              top: '50%',
              width: natural ? natural.w * k : 'auto',
              height: natural ? natural.h * k : 'auto',
              transform: `translate(calc(-50% + ${view.x}px), calc(-50% + ${view.y}px))`,
              visibility: natural ? 'visible' : 'hidden',
            }}
          />
        ) : null}

        {/* The frame: everything outside it is dimmed. */}
        <div
          className="absolute pointer-events-none border-2 border-white/90"
          style={{
            width: frameW,
            height: frameH,
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            borderRadius: round ? '50%' : 8,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.65)',
          }}
        />
      </div>

      <div className="shrink-0 px-6 pt-3">
        <input type="range" min="1" max={MAX_ZOOM} step="0.01" value={view.zoom} onChange={handleSlider} className="w-full accent-purple-500" aria-label="Zoom" />
        <p className="text-center text-white/50 text-xs mt-1">Drag to move · pinch or slide to zoom</p>
      </div>

      <div className="flex items-center justify-between px-5 py-4 shrink-0">
        <button onClick={onCancel} disabled={saving} className="text-white/80 text-sm px-3 py-2">Cancel</button>
        <button onClick={save} disabled={saving || !natural} className="flex items-center gap-2 bg-brand-purple text-white text-sm font-medium rounded-full px-6 py-2.5 disabled:opacity-60">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          {saving ? 'Saving…' : 'Done'}
        </button>
      </div>
    </div>
  )
}
