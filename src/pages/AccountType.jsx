import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, TrendingUp, GraduationCap, BookOpen, KeyRound, Building2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { AuthPage, OptionCard, Notice } from '../components/AuthKit.jsx'

const OPTIONS = [
  { value: 'parent', label: 'Parent or guardian', sub: "Follow your child's school, timetable and results.", icon: Users },
  { value: 'investor', label: 'Investor', sub: 'Discover schools and follow their growth.', icon: TrendingUp },
  { value: 'alumni', label: 'Alumni', sub: 'Stay connected with the school you attended.', icon: GraduationCap },
  { value: 'join-student', label: 'Join as a student', sub: 'Use the student code from your school.', icon: BookOpen },
  { value: 'join', label: 'I have a staff invite code', sub: 'For teachers and staff joining a school.', icon: KeyRound },
  { value: 'create', label: 'Create a school account', sub: 'Set up your school as its headteacher.', icon: Building2 },
]

const ROUTES = {
  join: '/onboarding/join-school',
  'join-student': '/onboarding/join-student',
  create: '/onboarding/create-school',
  alumni: '/onboarding/select-alumni-school',
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
      await saveProfileDetails({ account_type: value })
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
