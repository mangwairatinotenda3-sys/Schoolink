import { useState, useRef } from 'react'
import { X, Download, Flag, ZoomIn } from 'lucide-react'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function PhotoViewer({ imageUrl, postId, onClose }) {
  const { user } = useAuth()
  const [zoomed, setZoomed] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [reportSent, setReportSent] = useState(false)
  const lastTap = useRef(0)

  function handleTap() {
    const now = Date.now()
    if (now - lastTap.current < 300) {
      setZoomed((z) => !z)
    }
    lastTap.current = now
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
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
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
        className="flex-1 flex items-center justify-center overflow-auto"
        onClick={handleTap}
      >
        <img
          src={imageUrl}
          alt=""
          className={`transition-transform duration-200 ${zoomed ? 'scale-[2]' : 'scale-100'} max-w-full`}
        />
      </div>

      <p className="text-center text-white/40 text-xs pb-4 shrink-0 flex items-center justify-center gap-1">
        <ZoomIn size={12} /> Double-tap to zoom
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
