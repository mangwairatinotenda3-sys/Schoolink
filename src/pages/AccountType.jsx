import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackHeader from '../components/BackHeader.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const options = [
  { label: 'Parent / Guardian', value: 'parent' },
  { label: 'Investor', value: 'investor' },
  { label: 'Alumni', value: 'alumni' },
  { label: 'Join as a Student', value: 'join-student' },
  { label: 'I have a Staff Invite Code', value: 'join' },
  { label: 'Create a School Account', value: 'create' },
]

export default function AccountType() {
  const navigate = useNavigate()
  const { saveProfileDetails } = useAuth()
  const [busy, setBusy] = useState(false)

  async function handleChoice(value) {
    setBusy(true)
    if (value === 'join') {
      navigate('/onboarding/join-school')
      return
    }
    if (value === 'join-student') {
      navigate('/onboarding/join-student')
      return
    }
    if (value === 'create') {
      navigate('/onboarding/create-school')
      return
    }
    if (value === 'alumni') {
      navigate('/onboarding/select-alumni-school')
      return
    }
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
              className="w-full text-left border border-gray-200 rounded-xl px-4 py-4 font-medium disabled:opacity-50"
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
              }
