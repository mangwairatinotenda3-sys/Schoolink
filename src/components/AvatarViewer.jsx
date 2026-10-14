import { X } from 'lucide-react'
import ZoomImage from './ZoomImage.jsx'

// Shows the whole profile photo (not a circle), with pinch-zoom that never shows empty space.
export default function AvatarViewer({ imageUrl, onClose }) {
  if (!imageUrl) return null
  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="flex items-center justify-end px-4 py-3 shrink-0">
        <button onClick={onClose} aria-label="Close"><X size={24} className="text-white" /></button>
      </div>
      <div className="flex-1 min-h-0">
        <ZoomImage src={imageUrl} />
      </div>
      <p className="text-center text-white/40 text-xs py-3 shrink-0">Pinch to zoom · double-tap to zoom</p>
    </div>
  )
}
