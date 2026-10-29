import { useState } from 'react'
import { Crown, ShieldCheck, BookOpen, Wallet, Library, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { AuthPage, OptionCard, PrimaryButton } from '../components/AuthKit.jsx'

const ROLES = [
  { label: 'Headteacher', sub: 'Leads the school and invites staff', icon: Crown },
  { label: 'Deputy Head', sub: 'Supports the headteacher', icon: ShieldCheck },
  { label: 'Teacher / Tutor', sub: 'Teaches classes and shares work', icon: BookOpen },
  { label: 'Bursar', sub: 'Manages fees and payments', icon: Wallet },
  { label: 'Librarian', sub: 'Looks after library resources', icon: Library },
  { label: 'Parent / Guardian', sub: "Follows a child's progress", icon: Users },
]

export default function ChooseRole() {
  const navigate = useNavigate()
  const { saveProfileDetails } = useAuth()
  const [selected, setSelected] = useState('Headteacher')
  const [busy, setBusy] = useState(false)

  async function handleContinue() {
    setBusy(true)
    await saveProfileDetails({ role: selected })
    navigate('/home', { replace: true })
  }

  return (
    <AuthPage title="Your role" subtitle="Choose the role you have at the school.">
      <div className="space-y-3">
        {ROLES.map((r) => (
          <OptionCard
            key={r.label}
            icon={r.icon}
            title={r.label}
            sub={r.sub}
            radio
            selected={selected === r.label}
            onClick={() => setSelected(r.label)}
          />
        ))}
      </div>

      <PrimaryButton className="mt-8" onClick={handleContinue} busy={busy} busyLabel="Saving…">Continue</PrimaryButton>
    </AuthPage>
  )
   }
