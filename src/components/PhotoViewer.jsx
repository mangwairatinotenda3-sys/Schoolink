import { useRef, useState } from 'react'
import { X, Download, Flag, Plus, Minus, Share2, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import ZoomImage from './ZoomImage.jsx'

export default function PhotoViewer({ images = [], initialIndex = 0, postId, onClose }) {
  const { user } = useAuth()
  const [showReport, setShowReport] = useState(false)
  const [reportSent, setReportSent] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [loaded, setLoaded] = useState(false)
  const zoomRef = useRef(null)
  const currentImage = images[currentIndex]

  function goTo(index) {
    if (index < 0 || index > images.length - 1 || index === currentIndex) return
    setLoaded(false)
    setCurrentIndex(index)
  }

  async function handleShare() {
    if (navigator.share) {
      try { await navigator.share({ title: 'Schoolink Photo', url: currentImage }) } catch { /* cancelled */ }
    } else {
      navigator.clipboard?.writeText(currentImage)
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

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 shrink-0 relative z-10">
        <button onClick={onClose} aria-label="Close"><X size={24} className="text-white" /></button>
        <div className="flex items-center gap-4">
          {images.length > 1 ? <span className="text-sm font-medium text-white">{currentIndex + 1} / {images.length}</span> : null}
          <button onClick={handleShare} aria-label="Share"><Share2 size={20} className="text-white" /></button>
          <button onClick={handleDownload} aria-label="Download"><Download size={20} className="text-white" /></button>
          <button onClick={() => setShowReport(true)} aria-label="Report"><Flag size={20} className="text-white" /></button>
        </div>
      </div>

      <div className="flex-1 min-h-0 relative">
        {!loaded ? <div className="absolute inset-0 flex items-center justify-center"><div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" /></div> : null}
        <ZoomImage
          key={currentIndex}
          ref={zoomRef}
          src={currentImage}
          onLoad={() => setLoaded(true)}
          onSwipe={(dir) => goTo(currentIndex + (dir === 'next' ? 1 : -1))}
        />
        {images.length > 1 && currentIndex > 0 ? (
          <button onClick={() => goTo(currentIndex - 1)} aria-label="Previous" className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-white/20 rounded-full p-2"><ChevronLeft size={24} className="text-white" /></button>
        ) : null}
        {images.length > 1 && currentIndex < images.length - 1 ? (
          <button onClick={() => goTo(currentIndex + 1)} aria-label="Next" className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-white/20 rounded-full p-2"><ChevronRight size={24} className="text-white" /></button>
        ) : null}
        <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-10">
          <button onClick={() => zoomRef.current?.zoomBy(0.75)} aria-label="Zoom in" className="bg-white/20 rounded-full p-2"><Plus size={20} className="text-white" /></button>
          <button onClick={() => zoomRef.current?.zoomBy(-0.75)} aria-label="Zoom out" className="bg-white/20 rounded-full p-2"><Minus size={20} className="text-white" /></button>
        </div>
      </div>

      <p className="text-center text-white/40 text-xs py-3 shrink-0">Pinch to zoom · drag to move · double-tap to zoom</p>

      {showReport ? (
        <div className="absolute inset-0 bg-black/70 flex items-end z-20" onClick={() => setShowReport(false)}>
          <div className="bg-white rounded-t-2xl w-full p-4" onClick={(e) => e.stopPropagation()}>
            <p className="font-semibold text-sm mb-3">Report this photo</p>
            {['Inappropriate content', 'Spam', 'Harassment or bullying', 'Other'].map((reason) => (
              <button key={reason} onClick={() => handleReport(reason)} className="w-full text-left py-3 border-b border-gray-100 text-sm text-gray-700">{reason}</button>
            ))}
            <button onClick={() => setShowReport(false)} className="w-full text-center py-3 mt-2 text-sm text-gray-400">Cancel</button>
          </div>
        </div>
      ) : null}

      {reportSent ? <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white rounded-full px-4 py-2 text-sm shadow-lg z-20">Report submitted</div> : null}
    </div>
  )
  }
