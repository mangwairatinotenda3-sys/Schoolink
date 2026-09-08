import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Briefcase, GraduationCap, BookOpen, UserPlus, Landmark } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const options = [
  { label: 'Parent / Guardian', value: 'parent', icon: Users, color: 'bg-blue-500' },
  { label: 'Investor', value: 'investor', icon: Briefcase, color: 'bg-green-500' },
  { label: 'Alumni', value: 'alumni', icon: GraduationCap, color: 'bg-rose-500' },
  { label: 'Join as a Student', value: 'join-student', icon: BookOpen, color: 'bg-orange-500' },
  { label: 'I have a Staff Invite Code', value: 'join', icon: UserPlus, color: 'bg-purple-500' },
  { label: 'Create a School Account', value: 'create', icon: Landmark, color: 'bg-brand-navy' },
]

export default function AccountType() {
  const navigate = useNavigate()
  const { saveProfileDetails } = useAuth()
  const [busy, setBusy] = useState(false)

  async function handleChoice(value) {
    setBusy(true)
    if (value === 'join') return navigate('/onboarding/join-school')
    if (value === 'join-student') return navigate('/onboarding/join-student')
    if (value === 'create') return navigate('/onboarding/create-school')
    if (value === 'alumni') return navigate('/onboarding/select-alumni-school')
    await saveProfileDetails({ account_type: value })
    navigate('/home')
  }

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader />
      <div className="flex-1 flex flex-col px-6 pt-2">
        <h2 className="text-2xl font-bold">Welcome to Schoolink</h2>
        <p className="text-gray-500 mt-1">How would you like to continue?</p>

        <div className="mt-8 space-y-3">
          {options.map((o) => (
            <button
              key={o.value}
              disabled={busy}
              onClick={() => handleChoice(o.value)}
              className="w-full flex items-center gap-3 text-left border border-gray-200 rounded-xl px-4 py-3.5 disabled:opacity-50"
            >
              <span className={`w-10 h-10 rounded-full ${o.color} flex items-center justify-center shrink-0`}>
                <o.icon size={18} className="text-white" />
              </span>
              <span className="font-medium">{o.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
