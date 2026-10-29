import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { School, Building2, Landmark, University, Wrench, MapPin } from 'lucide-react'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { AuthPage, AuthField, PrimaryButton, Notice } from '../components/AuthKit.jsx'

const TYPES = [
  { label: 'Primary School', icon: School },
  { label: 'Junior School', icon: Building2 },
  { label: 'High School', icon: Landmark },
  { label: 'College', icon: University },
  { label: 'University', icon: University },
  { label: 'Other', icon: Wrench },
]

export default function CreateSchool() {
  const navigate = useNavigate()
  const { user, saveProfileDetails } = useAuth()
  const [name, setName] = useState('')
  const [type, setType] = useState('High School')
  const [location, setLocation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [touched, setTouched] = useState(false)

  const nameOk = name.trim().length >= 3

  async function handleCreate(e) {
    e.preventDefault()
    setTouched(true)
    if (!nameOk) return
    setBusy(true)
    setError('')

    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .insert({ name: name.trim(), school_type: type, location: location.trim(), created_by: user.id })
      .select()
      .maybeSingle()

    if (schoolError || !school) {
      setError(schoolError?.message || 'Could not create the school. Please try again.')
      setBusy(false)
      return
    }

    await saveProfileDetails({ school_id: school.id, role: 'Headteacher', account_type: 'school_member' })
    setBusy(false)
    navigate('/home', { replace: true })
  }

  return (
    <AuthPage
      title="Create your school"
      subtitle="You will be the headteacher. You can invite staff and approve students after this."
    >
      <form onSubmit={handleCreate} noValidate className="space-y-5">
        <AuthField
          id="school-name"
          label="School name"
          icon={School}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full official name"
          autoComplete="organization"
          error={touched && !nameOk ? 'Enter the school name, at least 3 letters.' : null}
        />

        <div>
          <p className="text-[13px] font-semibold text-brand-navy mb-2">School type</p>
          <div className="grid grid-cols-2 gap-2">
            {TYPES.map(({ label, icon: Icon }) => {
              const on = type === label
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setType(label)}
                  className={`flex items-center gap-2.5 rounded-2xl border bg-white px-3 py-3 text-left ${
                    on ? 'border-brand-purple ring-4 ring-brand-purple/10' : 'border-gray-200'
                  }`}
                >
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${on ? 'bg-brand-purple text-white' : 'bg-brand-light text-brand-purple'}`}>
                    <Icon size={15} />
                  </span>
                  <span className="text-[13px] font-semibold text-brand-navy leading-tight">{label}</span>
                </button>
              )
            })}
          </div>
        </div>

        <AuthField
          id="school-location"
          label="Location"
          icon={MapPin}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="City and country"
          hint="Optional. Helps parents find your school."
        />

        {error ? <Notice tone="error">{error}</Notice> : null}

        <PrimaryButton type="submit" busy={busy} busyLabel="Creating school…">Create school</PrimaryButton>
      </form>
    </AuthPage>
  )
}
