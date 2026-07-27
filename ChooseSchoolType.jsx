import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackHeader from '../components/BackHeader.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const types = ['Primary School', 'Junior School', 'High School', 'College', 'University', 'Other']

export default function ChooseSchoolType() {
  const navigate = useNavigate()
  const { saveProfileDetails } = useAuth()
  const [selected, setSelected] = useState('High School')

  async function handleContinue() {
    await saveProfileDetails({ school_type: selected })
    navigate('/onboarding/role')
  }

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader />
      <div className="flex-1 flex flex-col px-6 pt-2">
        <h2 className="text-2xl font-bold">Choose Your School Type</h2>
        <p className="text-gray-500 mt-1">Select the type of school you belong to.</p>

        <div className="grid grid-cols-2 gap-3 mt-8">
          {types.map((t) => (
            <button
              key={t}
              onClick={() => setSelected(t)}
              className={`py-6 rounded-xl border text-sm font-medium ${
                selected === t
                  ? 'border-brand-purple text-brand-purple bg-brand-light'
                  : 'border-gray-200 text-gray-700'
              }`}
            >
              {t}
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
