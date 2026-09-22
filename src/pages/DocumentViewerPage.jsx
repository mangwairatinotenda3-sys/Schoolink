import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import DocumentViewer from '../components/DocumentViewer.jsx'

export default function DocumentViewerPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  // Accept /viewer/:id OR /viewer?url=https://...
  const urlFromQuery = searchParams.get('url')
  const finalUrl = urlFromQuery || id

  if (!finalUrl) {
    return <div className="p-8">No document URL provided. <button onClick={()=>navigate(-1)} className="text-brand-purple">Go back</button></div>
  }

  return (
    <DocumentViewer
      url={finalUrl}
      title={id || "Document"}
      onClose={() => navigate(-1)}
    />
  )
  }
