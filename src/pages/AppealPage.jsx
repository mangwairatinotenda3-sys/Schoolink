import { useNavigate } from 'react-router-dom'
import { ShieldQuestion } from 'lucide-react'
import ScreenHeader from '../components/ScreenHeader.jsx'
import AppealForm from '../components/AppealForm.jsx'

// For someone who cannot sign in because their account is banned
export default function AppealPage() {
  const navigate = useNavigate()
  return (
    <div className="app-shell">
      <ScreenHeader title="Appeal a ban" onBack={() => navigate('/')} />
      <div className="screen-scroll px-5 pb-10">
        <div className="flex flex-col items-center text-center pt-6 pb-5">
          <span className="w-16 h-16 rounded-full bg-brand-light flex items-center justify-center"><ShieldQuestion size={30} className="text-brand-purple" /></span>
          <p className="text-sm text-gray-500 mt-3 leading-snug max-w-[320px]">If your account was banned and you think it was a mistake, tell us what happened. The Schoolink team will read it.</p>
        </div>
        <AppealForm withEmail />
        <p className="text-[11px] text-gray-400 text-center mt-5 leading-snug">You can send one appeal at a time. If it is turned down you can try again after 7 days.</p>
      </div>
    </div>
  )
}
