import { useNavigate } from 'react-router-dom'
import { Users } from 'lucide-react'
import ScreenHeader from '../components/ScreenHeader.jsx'
import FamilyParent from '../components/FamilyParent.jsx'
import FamilyStudent from '../components/FamilyStudent.jsx'
import FamilyStaff from '../components/FamilyStaff.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { isFamilyManager, isParentAccount, isStudentAccount } from '../lib/familyUtils.js'

// One page, three views: parents see their children, students see their parents, staff manage the links.
export default function Family() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const back = () => navigate(-1)

  if (!user || !profile) return <div className="app-shell" />

  if (isParentAccount(profile)) return <FamilyParent user={user} navigate={navigate} onBack={back} />
  if (isStudentAccount(profile)) return <FamilyStudent user={user} profile={profile} onBack={back} />
  if (isFamilyManager(profile)) return <FamilyStaff user={user} profile={profile} onBack={back} />

  return (
    <div className="app-shell">
      <ScreenHeader title="Family" onBack={back} />
      <div className="flex-1 flex flex-col items-center justify-center text-center px-10">
        <span className="w-20 h-20 rounded-full bg-brand-light flex items-center justify-center mb-4"><Users size={34} className="text-brand-purple" /></span>
        <p className="font-semibold text-lg">Not available for this account</p>
        <p className="text-sm text-gray-400 mt-1">Parent links are for parents, students and teachers.</p>
      </div>
    </div>
  )
  }
