import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { School, Building2, Landmark, University, Wrench, MoreHorizontal } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

const types = [
  { label: 'Primary School', icon: School, color: 'bg-blue-500' },
  { label: 'Junior School', icon: Building2, color: 'bg-green-500' },
  { label: 'High School', icon: Landmark, color: 'bg-purple-500' },
  { label: 'College', icon: University, color: 'bg-orange-500' },
  { label: 'University', icon: University, color: 'bg-rose-500' },
  { label: 'Other', icon: Wrench, color: 'bg-gray-500' },
]

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
              key={t.label}
              onClick={() => setType(t.label)}
              className={`flex items-center gap-2 py-3 px-3 rounded-xl border ${
                type === t.label ? 'border-brand-purple bg-brand-light' : 'border-gray-200'
              }`}
            >
              <span className={`w-8 h-8 rounded-full ${t.color} flex items-center justify-center shrink-0`}>
                <t.icon size={15} className="text-white" />
              </span>
              <span className="text-sm font-medium text-left">{t.label}</span>
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
