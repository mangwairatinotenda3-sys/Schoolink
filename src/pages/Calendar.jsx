import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Calendar as CalendarIcon, MapPin, Users } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import BottomNav from '../components/BottomNav.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { isStaffMember } from '../lib/permissions.js'

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

export default function Calendar() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [events, setEvents] = useState([])
  const [rsvpCounts, setRsvpCounts] = useState({})
  const [myRsvps, setMyRsvps] = useState(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (profile?.school_id) loadEvents()
  }, [profile?.school_id])

  async function loadEvents() {
    setLoading(true)
    const { data } = await supabase
      .from('events')
      .select('*')
      .eq('school_id', profile.school_id)
      .order('event_date', { ascending: true })
    setEvents(data ?? [])

    if (data && data.length > 0) {
      const eventIds = data.map((e) => e.id)
      const { data: rsvpRows } = await supabase
        .from('event_rsvps')
        .select('event_id, user_id')
        .in('event_id', eventIds)

      const counts = {}
      const mine = new Set()
      for (const r of rsvpRows ?? []) {
        counts[r.event_id] = (counts[r.event_id] ?? 0) + 1
        if (r.user_id === user.id) mine.add(r.event_id)
      }
      setRsvpCounts(counts)
      setMyRsvps(mine)
    }
    setLoading(false)
  }

  async function toggleRsvp(eventId) {
    if (myRsvps.has(eventId)) {
      await supabase.from('event_rsvps').delete().eq('event_id', eventId).eq('user_id', user.id)
      setMyRsvps((prev) => {
        const next = new Set(prev)
        next.delete(eventId)
        return next
      })
      setRsvpCounts((prev) => ({ ...prev, [eventId]: (prev[eventId] ?? 1) - 1 }))
    } else {
      await supabase.from('event_rsvps').insert({ event_id: eventId, user_id: user.id })
      setMyRsvps((prev) => new Set(prev).add(eventId))
      setRsvpCounts((prev) => ({ ...prev, [eventId]: (prev[eventId] ?? 0) + 1 }))
    }
  }

  const now = new Date()
  const upcoming = events.filter((e) => new Date(e.event_date) >= now)
  const past = events.filter((e) => new Date(e.event_date) < now)

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader title="School Calendar" />

      {isStaffMember(profile) ? (
        <div className="px-4 pt-2">
          <button
            onClick={() => navigate('/calendar/create')}
            className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500"
          >
            <Plus size={16} /> Add Event
          </button>
        </div>
      ) : null}

      <div className="screen-scroll px-4 pt-3">
        {loading ? (
          <p className="text-center text-gray-400 mt-8">Loading…</p>
        ) : (
          <>
            <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Upcoming</p>
            {upcoming.length === 0 ? (
              <p className="text-sm text-gray-400 mb-4">No upcoming events.</p>
            ) : (
              <div className="space-y-3 mb-6">
                {upcoming.map((e) => (
                  <div key={e.id} className="border border-gray-100 rounded-xl p-4">
                    <p className="font-semibold text-sm">{e.title}</p>
                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                      <CalendarIcon size={13} /> {formatDate(e.event_date)}
                    </p>
                    {e.location ? (
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <MapPin size={13} /> {e.location}
                      </p>
                    ) : null}
                    {e.description ? <p className="text-sm mt-2">{e.description}</p> : null}
                    <div className="flex items-center justify-between mt-3">
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Users size={13} /> {rsvpCounts[e.id] ?? 0} going
                      </span>
                      <button
                        onClick={() => toggleRsvp(e.id)}
                        className={`text-xs font-medium px-3 py-1.5 rounded-full border ${
                          myRsvps.has(e.id) ? 'text-gray-400 border-gray-200' : 'text-brand-purple border-brand-purple'
                        }`}
                      >
                        {myRsvps.has(e.id) ? "I'm going ✓" : 'RSVP'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {past.length > 0 ? (
              <>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Past</p>
                <div className="space-y-2 mb-6">
                  {past.map((e) => (
                    <div key={e.id} className="border border-gray-100 rounded-xl p-3 opacity-60">
                      <p className="font-medium text-sm">{e.title}</p>
                      <p className="text-xs text-gray-400">{formatDate(e.event_date)}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </>
        )}
      </div>
      <BottomNav />
    </div>
  )
    }
