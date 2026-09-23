import { useNavigate } from 'react-router-dom'
import { X, Download, ExternalLink, Loader2 } from 'lucide-react'
import { useState } from 'react'

export default function DocumentViewer({ url, title, onClose }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const close = onClose || (() => navigate(-1))

  const finalUrl = url?.startsWith('http')? url : `https://unopasa.com/legacy/${url}`

  // Check if it's PDF - force through Google Viewer to prevent download
  const isPdf = finalUrl.toLowerCase().includes('.pdf') || finalUrl.includes('/legacy/') || finalUrl.includes('supabase')

  // Use Google Docs viewer for PDFs - this PREVENTS download, shows inline
  const viewerUrl = isPdf
   ? `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(finalUrl)}`
    : finalUrl

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button onClick={close} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
            <X size={16} />
          </button>
          <p className="text-sm font-semibold truncate">{title || 'Document'}</p>
        </div>
        <div className="flex items-center gap-2">
          <a href={finalUrl} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <ExternalLink size={14} />
          </a>
          <a href={finalUrl} target="_blank" rel="noreferrer" download={false} className="w-8 h-8 rounded-full bg-brand-purple text-white flex items-center justify-center">
            <Download size={14} />
          </a>
        </div>
      </div>

      <div className="flex-1 bg-zinc-200 relative">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background">
            <Loader2 className="animate-spin text-brand-purple" size={32} />
            <p className="text-sm text-muted-foreground">Opening document...</p>
          </div>
        )}
        <iframe
          src={viewerUrl}
          className="w-full h-full border-0 bg-white"
          title={title || "Document"}
          allowFullScreen
          onLoad={() => setLoading(false)}
          // This sandbox prevents automatic downloads
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        />
      </div>
    </div>
  )
    }
