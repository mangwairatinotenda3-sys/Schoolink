import { useState, useEffect } from 'react'
import { X, ZoomIn, ZoomOut, Download } from 'lucide-react'

export default function DocumentViewer({ url, title, onClose }) {
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [scale, setScale] = useState(1)
  const [directUrl, setDirectUrl] = useState(url)

  useEffect(() => {
    let blobUrl = null
    async function fetchPdf() {
      setLoading(true)
      try {
        let finalUrl = url

        // If it's unopasa legacy page, extract the raw R2 PDF
        if (url.includes('/legacy/')) {
          const id = url.split('/legacy/')[1].split('/')[0].split('?')[0]
          const pageProxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://unopasa.com/legacy/${id}`)}`
          const html = await fetch(pageProxy).then(r => r.text())

          // This is the actual R2 storage URL Unopasa uses - no branding
          const match = html.match(/https:\/\/legacy-unopasa[^"'\s]+\.pdf|https:\/\/[^"'\s]*r2\.dev\/[^"'\s]+\.pdf|https:\/\/[^"'\s]*cloudflarestorage[^"'\s]+\.pdf/)
          if (match) {
            finalUrl = match[0]
          } else {
            // Try download endpoint
            const dlMatch = html.match(/\/api\/download\/[a-z0-9]+/i)
            if (dlMatch) finalUrl = `https://unopasa.com${dlMatch[0]}`
          }
        }

        setDirectUrl(finalUrl)

        // Fetch PDF as blob via CORS proxy to hide Unopasa
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(finalUrl)}`
        const res = await fetch(proxyUrl)
        if (!res.ok) throw new Error('proxy failed')
        const blob = await res.blob()
        if (blob.type.includes('text') || blob.size < 1000) throw new Error('not pdf')

        blobUrl = URL.createObjectURL(blob)
        setPdfBlobUrl(blobUrl)
      } catch (e) {
        console.log('Using iframe fallback', e)
        // Fallback to google viewer - still inside your app
        setPdfBlobUrl(null)
      }
      setLoading(false)
    }

    fetchPdf()
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [url])

  const displayUrl = pdfBlobUrl || `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(directUrl)}`

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card shrink-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
            <X size={16} />
          </button>
          <p className="text-sm font-semibold truncate">{title}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <button onClick={() => setScale(s => Math.max(0.5, s - 0.2))} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <ZoomOut size={14} />
          </button>
          <span className="text-xs w-10 text-center">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.min(2, s + 0.2))} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <ZoomIn size={14} />
          </button>
          <a href={directUrl} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-full bg-brand-purple text-white flex items-center justify-center">
            <Download size={14} />
          </a>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-zinc-100 dark:bg-zinc-900 flex justify-center p-2">
        {loading? (
          <div className="mt-24 text-center">
            <div className="w-8 h-8 border-2 border-brand-purple border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs mt-3 text-muted-foreground">Loading document...</p>
          </div>
        ) : (
          <iframe
            src={displayUrl}
            className="w-full max-w-5xl bg-white shadow-lg rounded-lg border-0"
            style={{
              height: '100%',
              minHeight: '85vh',
              transform: `scale(${scale})`,
              transformOrigin: 'top center'
            }}
            title={title}
          />
        )}
      </div>
    </div>
  )
}
