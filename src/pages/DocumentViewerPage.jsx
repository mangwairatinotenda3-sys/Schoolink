import { useParams, useNavigate } from 'react-router-dom'
import DocumentViewer from '../components/DocumentViewer.jsx'

export default function DocumentViewerPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  return (
    <DocumentViewer
      url={`https://unopasa.com/legacy/${id}`}
      title="Document"
      onClose={() => navigate(-1)}
    />
  )
}
