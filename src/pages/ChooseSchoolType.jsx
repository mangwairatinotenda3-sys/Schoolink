import { useState } from 'react'
import { School, Building2, Landmark, University, Wrench } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { AuthPage, PrimaryButton } from '../components/AuthKit.jsx'

const TYPES = [
  { label: 'Primary School', icon: School },
  { label: 'Junior School', icon: Building2 },
  { label: 'High School', icon: Landmark },
  { label: 'College', icon: University },
  { label: 'University', icon: University },
  { label: 'Other', icon: Wrench },
]

export default function ChooseSchoolType() {
  const navigate = useNavigate()
  const { saveProfileDetails } = useAuth()
  const [selected, setSelected] = useState('High School')
  const [busy, setBusy] = useState(false)

  async function handleContinue() {
    setBusy(true)
    await saveProfileDetails({ school_type: selected })
    navigate('/onboarding/role')
  }

  return (
    <AuthPage title="Your school type" subtitle="This helps us show the right tools for your school.">
      <div className="grid grid-cols-2 gap-3">
        {TYPES.map(({ label, icon: Icon }) => {
          const on = selected === label
          return (
            <button
              key={label}
              type="button"
              onClick={() => setSelected(label)}
              className={`flex flex-col items-start gap-3 rounded-2xl border bg-white p-4 text-left ${
                on ? 'border-brand-purple ring-4 ring-brand-purple/10' : 'border-gray-200'
              }`}
            >
              <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${on ? 'bg-brand-purple text-white' : 'bg-brand-light text-brand-purple'}`}>
                <Icon size={18} />
              </span>
              <span className="text-[14px] font-semibold text-brand-navy">{label}</span>
            </button>
          )
        })}
      </div>

      <PrimaryButton className="mt-8" onClick={handleContinue} busy={busy} busyLabel="Saving…">Continue</PrimaryButton>
    </AuthPage>
  )
  }
