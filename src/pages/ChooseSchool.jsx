import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, School, Check } from 'lucide-react'
import { AuthPage, PrimaryButton, Notice } from '../components/AuthKit.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

const FIELD_CLASS = 'w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-purple'

// Students pick their school, then add their class and admission number. The school then approves them.
export default function ChooseSchool() {
  const navigate = useNavigate()
  const { saveProfileDetails } = useAuth()
  const [schools, setSchools] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState(null)
  const [classRoom, setClassRoom] = useState('')
  const [admission, setAdmission] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const ready = !!picked && classRoom.trim().length > 0 && admission.trim().length > 0

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError('')
    const { data, error: loadError } = await supabase
      .from('schools')
      .select('id, name, location')
      .order('name', { ascending: true })
      .limit(500)
    if (loadError) setError("Couldn't load schools. Check your connection and try again.")
    setSchools(data ?? [])
    setLoading(false)
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return schools
    return schools.filter((s) => `${s.name} ${s.location || ''}`.toLowerCase().includes(q))
  }, [schools, query])

  async function sendRequest() {
    if (!ready || busy) return
    setBusy(true)
    setError('')
    const { data, error: rpcError } = await supabase.rpc('request_school', {
      p_school: picked.id,
      p_class: classRoom.trim(),
      p_admission: admission.trim(),
    })
    if (rpcError || !data?.ok) {
      setBusy(false)
      setError(data?.error || "Couldn't send your request. Try again.")
      return
    }
    if (saveProfileDetails) {
      await saveProfileDetails({
        school_id: picked.id,
        role: 'Student',
        account_type: 'school_member',
        status: 'pending',
        class_name: classRoom.trim(),
        admission_no: admission.trim(),
      })
    }
    setBusy(false)
    navigate('/verify-student', { replace: true })
  }

  return (
    <AuthPage title="Find your school" subtitle="Pick your school, then add your class. The school approves you after you verify your school report.">
      {error ? <Notice tone="error">{error}</Notice> : null}

      <div className="relative mt-2">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or town"
          className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-3 text-sm outline-none focus:border-brand-purple"
        />
      </div>

      <div className="mt-4 space-y-2 max-h-[38vh] overflow-y-auto">
        {loading ? <p className="text-sm text-gray-400 text-center py-6">Loading schools…</p> : null}
        {!loading && filtered.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No schools match. Check the spelling, or ask your school for a student code.</p>
        ) : null}
        {filtered.map((s) => {
          const selected = picked?.id === s.id
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setPicked(s)}
              className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left ${selected ? 'border-brand-purple bg-brand-light' : 'border-gray-200 bg-white'}`}
            >
              <span className="w-10 h-10 rounded-full bg-brand-light flex items-center justify-center shrink-0"><School size={18} className="text-brand-purple" /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-sm truncate">{s.name}</span>
                {s.location ? <span className="block text-xs text-gray-500 truncate">{s.location}</span> : null}
              </span>
              {selected ? <Check size={18} className="text-brand-purple shrink-0" /> : null}
            </button>
          )
        })}
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <label className="text-sm font-semibold block mb-1.5">Class</label>
          <input
            value={classRoom}
            onChange={(e) => setClassRoom(e.target.value)}
            maxLength={20}
            placeholder="For example Form 3B"
            className={FIELD_CLASS}
          />
        </div>
        <div>
          <label className="text-sm font-semibold block mb-1.5">Admission number</label>
          <input
            value={admission}
            onChange={(e) => setAdmission(e.target.value)}
            maxLength={20}
            placeholder="The number on your school report"
            className={FIELD_CLASS}
          />
        </div>
      </div>

      <div className="mt-6">
        <PrimaryButton type="button" onClick={sendRequest} disabled={!ready} busy={busy} busyLabel="Sending request…">
          {picked ? `Send request to ${picked.name}` : 'Choose a school'}
        </PrimaryButton>
      </div>
    </AuthPage>
  )
}
