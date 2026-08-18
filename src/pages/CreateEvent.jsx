import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function CreateEvent() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [location, setLocation] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    if (!title.trim() || !eventDate) return
    setSaving(true)
    setError('')

    const { error: insertError } = await supabase.from('events').insert({
      school_id: profile.school_id,
      title,
      description,
      event_date: new Date(eventDate).toISOString(),
      location,
      created_by: user.id,
    })

    setSaving(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    navigate('/calendar')
  }

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader title="Add Event" />
      <div className="flex-1 flex flex-col px-6 pt-4">
        <label className="text-sm font-medium mb-2">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Term 1 Prize Giving"
          className="border border-gray-200 rounded-xl px-4 py-3 outline-brand-purple"
        />

        <label className="text-sm font-medium mt-4 mb-2">Date & Time</label>
        <input
          type="datetime-local"
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
          className="border border-gray-200 rounded-xl px-4 py-3 outline-brand-purple"
        />

        <label className="text-sm font-medium mt-4 mb-2">Location (optional)</label>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g. School Hall"
          className="border border-gray-200 rounded-xl px-4 py-3 outline-brand-purple"
        />

        <label className="text-sm font-medium mt-4 mb-2">Description (optional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="border border-gray-200 rounded-xl px-4 py-3 outline-brand-purple resize-none"
        />

        {error ? <p className="text-red-500 text-sm mt-3">{error}</p> : null}

        <div className="flex-1" />
        <button
          onClick={handleCreate}
          disabled={saving}
          className="w-full bg-brand-purple text-white font-medium py-3.5 rounded-xl mb-6 disabled:opacity-60"
        >
          {saving ? 'Creating…' : 'Create Event'}
        </button>
      </div>
    </div>
  )
        }
