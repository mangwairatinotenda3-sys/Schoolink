import { useNavigate } from 'react-router-dom'
import { X, Download, ExternalLink } from 'lucide-react'

export default function DocumentViewer({ url, title, onClose }) {
  const navigate = useNavigate()
  const close = onClose || (() => navigate(-1))

  // If url is just an ID, build full URL, if it's full URL use it
  const finalUrl = url.startsWith('http')? url : `https://unopasa.com/legacy/${url}`

  // Use Google Viewer which works for all PDFs
  const viewerUrl = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(finalUrl)}`

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button onClick={close} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><X size={16} /></button>
          <p className="text-sm font-semibold truncate">{title || finalUrl}</p>
        </div>
        <div className="flex items-center gap-2">
          <a href={finalUrl} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><ExternalLink size={14} /></a>
          <a href={finalUrl} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-full bg-brand-purple text-white flex items-center justify-center"><Download size={14} /></a>
        </div>
      </div>

      <div className="flex-1 bg-zinc-100">
        <iframe
          src={finalUrl}
          className="w-full h-full border-0 bg-white"
          title={title || "Document"}
          allowFullScreen
        />
      </div>
    </div>
  )
}
