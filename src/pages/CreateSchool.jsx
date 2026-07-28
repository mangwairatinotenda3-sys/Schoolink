import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

const types = ['Primary School', 'Junior School', 'High School', 'College', 'University', 'Other']

export default function CreateSchool() {
  const navigate = useNavigate()
  const { user, saveProfileDetails } = useAuth()
  const [name, setName] = useState('')
  const [type, setType] = useState('High School')
  const [location, setLocation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    if (!name.trim()) return
    setBusy(true)
    setError('')

    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .insert({ name, school_type: type, location, created_by: user.id })
      .select()
      .maybeSingle()

    if (schoolError) {
      setError(schoolError.message)
      setBusy(false)
      return
    }

    await saveProfileDetails({
      school_id: school.id,
      role: 'Headteacher',
      account_type: 'school_member',
    })

    setBusy(false)
    navigate('/home')
  }

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader title="Create Your School" />
      <div className="flex-1 flex flex-col px-6 pt-2">
        <label className="text-sm font-medium mt-4 mb-2">School Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Springfield High School"
          className="border border-gray-200 rounded-xl px-4 py-3.5 outline-brand-purple"
        />

        <label className="text-sm font-medium mt-4 mb-2">School Type</label>
        <div className="grid grid-cols-2 gap-3">
          {types.map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`py-4 rounded-xl border text-sm font-medium ${
                type === t ? 'border-brand-purple text-brand-purple bg-brand-light' : 'border-gray-200'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <label className="text-sm font-medium mt-4 mb-2">Location</label>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Harare, Zimbabwe"
          className="border border-gray-200 rounded-xl px-4 py-3.5 outline-brand-purple"
        />

        {error ? <p className="text-red-500 text-sm mt-3">{error}</p> : null}

        <div className="flex-1" />
        <button
          onClick={handleCreate}
          disabled={busy}
          className="w-full bg-brand-purple text-white font-medium py-3.5 rounded-xl mb-6 disabled:opacity-60"
        >
          {busy ? 'Creating…' : 'Create School — I am the Headteacher'}
        </button>
      </div>
    </div>
  )
               }
