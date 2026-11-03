import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, TrendingUp, GraduationCap, BookOpen, KeyRound, Building2, School, ArrowRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { AuthPage, OptionCard, Notice } from '../components/AuthKit.jsx'

const OPTIONS = [
  { value: 'student-school', label: 'Find my school', sub: 'Pick your school from the list. The school approves you.', icon: School },
  { value: 'join-student', label: 'I have a student code', sub: 'Use the code your school gave you.', icon: BookOpen },
  { value: 'later', label: "Continue, I'll choose later", sub: 'Look around now. You can add your school from your profile.', icon: ArrowRight },
  { value: 'parent', label: 'Parent or guardian', sub: "Follow your child's school, timetable and results.", icon: Users },
  { value: 'investor', label: 'Investor', sub: 'Discover schools and follow their growth.', icon: TrendingUp },
  { value: 'alumni', label: 'Alumni', sub: 'Stay connected with the school you attended.', icon: GraduationCap },
  { value: 'join', label: 'I have a staff invite code', sub: 'For teachers and staff joining a school.', icon: KeyRound },
  { value: 'create', label: 'Create a school account', sub: 'Set up your school as its headteacher.', icon: Building2 },
]

const ROUTES = {
  'student-school': '/onboarding/choose-school',
  'join-student': '/onboarding/join-student',
  join: '/onboarding/join-school',
  create: '/onboarding/create-school',
  alumni: '/onboarding/select-alumni-school',
}

// What each choice is saved as on the profile, when it isn't a route of its own.
const SAVE_AS = {
  later: 'student',
  parent: 'parent',
  investor: 'investor',
}

export default function AccountType() {
  const navigate = useNavigate()
  const { saveProfileDetails } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function choose(value) {
    setError('')
    if (ROUTES[value]) {
      navigate(ROUTES[value])
      return
    }
    setBusy(true)
    try {
      await saveProfileDetails({ account_type: SAVE_AS[value] || value })
      navigate('/home', { replace: true })
    } catch {
      setBusy(false)
      setError('Could not save your choice. Please try again.')
    }
  }

  return (
    <AuthPage
      title="Welcome to Schoolink"
      subtitle="How will you use Schoolink? You can change this later in your profile."
      back={false}
    >
      {error ? <div className="mb-4"><Notice tone="error">{error}</Notice></div> : null}
      <div className="space-y-3">
        {OPTIONS.map((o) => (
          <OptionCard
            key={o.value}
            icon={o.icon}
            title={o.label}
            sub={o.sub}
            disabled={busy}
            onClick={() => choose(o.value)}
          />
        ))}
      </div>
    </AuthPage>
  )
  }
