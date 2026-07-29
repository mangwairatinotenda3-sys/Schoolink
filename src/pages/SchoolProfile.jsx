import { useEffect, useState } from 'react'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { canManageStaff } from '../lib/permissions.js'

export default function SchoolProfile() {
  const { profile } = useAuth()
  const [school, setSchool] = useState(null)
  const [form, setForm] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const canEdit = canManageStaff(profile)

  useEffect(() => {
    if (!profile?.school_id) {
      setLoading(false)
      return
    }
    supabase
      .from('schools')
      .select('*')
      .eq('id', profile.school_id)
      .maybeSingle()
      .then(({ data }) => {
        setSchool(data)
        setForm(data ?? {})
        setLoading(false)
      })
  }, [profile?.school_id])

  function updateField(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    setMessage('')
    const { error } = await supabase
      .from('schools')
      .update({
        name: form.name,
        school_type: form.school_type,
        location: form.location,
        motto: form.motto,
        vision: form.vision,
        mission: form.mission,
      })
      .eq('id', school.id)
    setSaving(false)
    if (error) {
      setMessage(error.message)
      return
    }
    setSchool(form)
    setMessage('Saved!')
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col">
        <BackHeader title="School Profile" />
        <div className="screen-scroll px-4 flex items-center justify-center text-gray-400">Loading…</div>
      </div>
    )
  }

  if (!school) {
    return (
      <div className="flex-1 flex flex-col">
        <BackHeader title="School Profile" />
        <div className="screen-scroll px-4 flex items-center justify-center text-gray-400 text-center">
          You're not linked to a school yet.
        </div>
      </div>
    )
  }

  const fields = [
    { key: 'name', label: 'School Name' },
    { key: 'school_type', label: 'School Type' },
    { key: 'location', label: 'Location' },
    { key: 'motto', label: 'Motto' },
    { key: 'vision', label: 'Vision', multiline: true },
    { key: 'mission', label: 'Mission', multiline: true },
  ]

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader title="School Profile" />
      <div className="screen-scroll px-6 pt-2 pb-8">
        {fields.map(({ key, label, multiline }) => (
          <div key={key} className="mb-4">
            <label className="text-sm font-medium mb-1 block">{label}</label>
            {canEdit ? (
              multiline ? (
                <textarea
                  rows={3}
                  value={form[key] || ''}
                  onChange={(e) => updateField(key, e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-brand-purple resize-none"
                />
              ) : (
                <input
                  value={form[key] || ''}
                  onChange={(e) => updateField(key, e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-brand-purple"
                />
              )
            ) : (
              <p className="text-gray-600 py-1">{school[key] || '—'}</p>
            )}
          </div>
        ))}

        {message ? <p className="text-sm text-brand-purple mb-4">{message}</p> : null}

        {canEdit ? (
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-brand-purple text-white font-medium py-3.5 rounded-xl disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        ) : null}
      </div>
    </div>
  )
}
