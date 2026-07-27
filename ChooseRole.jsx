import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackHeader from '../components/BackHeader.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const roles = [
  { label: 'Headteacher', color: 'bg-purple-500' },
  { label: 'Deputy Head', color: 'bg-yellow-500' },
  { label: 'Teacher / Tutor', color: 'bg-green-500' },
  { label: 'Bursar', color: 'bg-blue-500' },
  { label: 'Librarian', color: 'bg-sky-500' },
  { label: 'Parent / Guardian', color: 'bg-red-500' },
]

export default function ChooseRole() {
  const navigate = useNavigate()
  const { saveProfileDetails } = useAuth()
  const [selected, setSelected] = useState('Headteacher')

  async function handleContinue() {
    await saveProfileDetails({ role: selected })
    navigate('/home')
  }

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader />
      <div className="flex-1 flex flex-col px-6 pt-2">
        <h2 className="text-2xl font-bold">Choose Your Role</h2>
        <p className="text-gray-500 mt-1">Select your role at the school.</p>

        <div className="mt-6 divide-y divide-gray-100">
          {roles.map(({ label, color }) => (
            <button
              key={label}
              onClick={() => setSelected(label)}
              className="w-full flex items-center justify-between py-4"
            >
              <span className="flex items-center gap-3">
                <span className={`w-3 h-3 rounded-full ${color}`} />
                <span className="font-medium">{label}</span>
              </span>
              <span
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  selected === label ? 'border-brand-purple' : 'border-gray-300'
                }`}
              >
                {selected === label ? <span className="w-2.5 h-2.5 rounded-full bg-brand-purple" /> : null}
              </span>
            </button>
          ))}
        </div>

        <div className="flex-1" />
        <button
          onClick={handleContinue}
          className="w-full bg-brand-purple text-white font-medium py-3.5 rounded-xl mb-6"
        >
          Continue
        </button>
      </div>
    </div>
  )
}
