import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function BackHeader({ title, dark = false }) {
  const navigate = useNavigate()
  return (
    <div
      className={`flex items-center gap-3 px-4 py-4 ${
        dark ? 'bg-brand-navy text-white' : 'bg-white text-brand-navy'
      }`}
    >
      <button onClick={() => navigate(-1)} aria-label="Go back">
        <ChevronLeft size={22} />
      </button>
      {title ? <h1 className="font-semibold text-lg">{title}</h1> : null}
    </div>
  )
}
