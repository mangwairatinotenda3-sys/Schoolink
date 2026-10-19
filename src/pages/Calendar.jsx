import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus, MapPin, Users, Share2, Check, CalendarDays, List, Clock } from 'lucide-react'
import BottomNav from '../components/BottomNav.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { isStaffMember } from '../lib/permissions.js'

const WEEK = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const key = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
const sameDay = (a, b) => key(a) === key(b)

function EventCard({ e, going, count, onRsvp, onShare }) {
  const d = new Date(e.event_date)
  const past = d < new Date()
  return (
    <div className={`bg-gray-50 rounded-2xl p-3.5 ${past ? 'opacity-70' : ''}`}>
      <div className="flex gap-3.5">
        <span className="w-14 shrink-0 self-start rounded-xl bg-brand-purple text-white flex flex-col items-center justify-center py-1.5">
          <span className="text-[11px] uppercase font-semibold opacity-90">{d.toLocaleDateString([], { month: 'short' })}</span>
          <span className="text-xl font-bold leading-none">{d.getDate()}</span>
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[16px]">{e.title}</p>
          <p className="text-[13px] text-gray-500 mt-0.5 flex items-center gap-1"><Clock size={13} />{d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
          {e.location ? <p className="text-[13px] text-gray-500 mt-0.5 flex items-center gap-1"><MapPin size={13} /><span className="truncate">{e.location}</span></p> : null}
          {e.description ? <p className="text-[14px] text-gray-700 mt-2 line-clamp-3 break-words">{e.description}</p> : null}
        </div>
      </div>
      <div className="flex items-center justify-between mt-3">
        <span className="text-[13px] text-gray-500 flex items-center gap-1"><Users size={14} />{count} going</span>
        <div className="flex items-center gap-2">
          <button onClick={() => onShare(e)} aria-label="Share event" className="w-9 h-9 rounded-full bg-white flex items-center justify-center active:opacity-70"><Share2 size={16} /></button>
          {!past ? (
            <button onClick={() => onRsvp(e)} className={`px-4 h-9 rounded-full text-[13.5px] font-semibold flex items-center gap-1.5 ${going ? 'bg-brand-purple text-white' : 'bg-white text-brand-purple border border-brand-purple'}`}>
              {going ? <><Check size={15} />Going</> : 'RSVP'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default function Calendar() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const today = new Date()
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selected, setSelected] = useState(today)
  const [view, setView] = useState('month')
  const [onlyGoing, setOnlyGoing] = useState(false)
  const [showPast, setShowPast] = useState(false)
  const [events, setEvents] = useState([])
  const [counts, setCounts] = useState({})
  const [mine, setMine] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const touchX = useRef(null)
  const staff = isStaffMember(profile)

  useEffect(() => {
    if (!user || !profile) return
    if (!profile.school_id) { setLoading(false); return }
    load()
  }, [user, profile?.school_id])

  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(''), 2000)
    return () => clearTimeout(t)
  }, [toast])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('events').select('*').eq('school_id', profile.school_id).order('event_date', { ascending: true })
    const list = data ?? []
    setEvents(list)
    if (list.length > 0) {
      const { data: rsvps } = await supabase.from('event_rsvps').select('event_id, user_id').in('event_id', list.map((e) => e.id))
      const c = {}
      const m = new Set()
      for (const r of rsvps ?? []) {
        c[r.event_id] = (c[r.event_id] || 0) + 1
        if (r.user_id === user.id) m.add(r.event_id)
      }
      setCounts(c)
      setMine(m)
    }
    setLoading(false)
  }

  async function rsvp(e) {
    const going = mine.has(e.id)
    setMine((prev) => { const n = new Set(prev); going ? n.delete(e.id) : n.add(e.id); return n })
    setCounts((prev) => ({ ...prev, [e.id]: Math.max(0, (prev[e.id] || 0) + (going ? -1 : 1)) }))
    const { error } = going
      ? await supabase.from('event_rsvps').delete().eq('event_id', e.id).eq('user_id', user.id)
      : await supabase.from('event_rsvps').insert({ event_id: e.id, user_id: user.id })
    if (error) {
      setMine((prev) => { const n = new Set(prev); going ? n.add(e.id) : n.delete(e.id); return n })
      setCounts((prev) => ({ ...prev, [e.id]: Math.max(0, (prev[e.id] || 0) + (going ? 1 : -1)) }))
      setToast("Couldn't update. Try again.")
    } else setToast(going ? 'RSVP removed' : "You're going 🎉")
  }

  async function share(e) {
    const text = `${e.title} · ${new Date(e.event_date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}${e.location ? ` · ${e.location}` : ''}`
    try {
      if (navigator.share) { await navigator.share({ title: e.title, text }); return }
      await navigator.clipboard.writeText(text)
      setToast('Event details copied')
    } catch { /* cancelled */ }
  }

  const byDay = useMemo(() => {
    const m = new Map()
    for (const e of events) { const k = key(new Date(e.event_date)); m.set(k, [...(m.get(k) || []), e]) }
    return m
  }, [events])

  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1)
    const offset = (first.getDay() + 6) % 7
    const total = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
    const out = Array(offset).fill(null)
    for (let i = 1; i <= total; i++) out.push(new Date(month.getFullYear(), month.getMonth(), i))
    return out
  }, [month])

  const shift = (n) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1))
  const goToday = () => { setMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setSelected(today) }
  const onTouchEnd = (e) => {
    if (touchX.current == null) return
    const dx = e.changedTouches[0].clientX - touchX.current
    touchX.current = null
    if (Math.abs(dx) > 60) shift(dx < 0 ? 1 : -1)
  }

  const dayEvents = byDay.get(key(selected)) || []
  const now = new Date()
  const filtered = events.filter((e) => !onlyGoing || mine.has(e.id))
  const upcoming = filtered.filter((e) => new Date(e.event_date) >= now)
  const past = filtered.filter((e) => new Date(e.event_date) < now).reverse()
  const groups = upcoming.reduce((acc, e) => {
    const k = new Date(e.event_date).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })
    ;(acc[k] = acc[k] || []).push(e)
    return acc
  }, {})

  const card = (e) => <EventCard key={e.id} e={e} going={mine.has(e.id)} count={counts[e.id] || 0} onRsvp={rsvp} onShare={share} />

  return (
    <div className="app-shell">
      <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
        <h1 className="font-bold text-[28px] leading-none">Calendar</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setView(view === 'month' ? 'agenda' : 'month')} aria-label="Switch view" className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center active:opacity-70">
            {view === 'month' ? <List size={19} /> : <CalendarDays size={19} />}
          </button>
          {staff ? <button onClick={() => navigate('/calendar/create')} aria-label="Add event" className="w-10 h-10 rounded-full bg-brand-purple text-white flex items-center justify-center active:opacity-80"><Plus size={21} /></button> : null}
        </div>
      </div>

      <div className="screen-scroll">
        {!profile?.school_id && !loading ? (
          <div className="text-center px-10 pt-16">
            <span className="w-20 h-20 rounded-full bg-brand-light mx-auto flex items-center justify-center mb-4"><CalendarDays size={30} className="text-brand-purple" /></span>
            <p className="font-semibold text-lg">No school calendar</p>
            <p className="text-sm text-gray-400 mt-1.5">Join a school to see its events here.</p>
          </div>
        ) : view === 'month' ? (
          <div onTouchStart={(e) => { touchX.current = e.touches[0].clientX }} onTouchEnd={onTouchEnd}>
            <div className="flex items-center justify-between px-4 pb-1">
              <p className="font-semibold text-[18px]">{month.toLocaleDateString([], { month: 'long', year: 'numeric' })}</p>
              <div className="flex items-center gap-1">
                {!(month.getMonth() === today.getMonth() && month.getFullYear() === today.getFullYear() && sameDay(selected, today)) ? <button onClick={goToday} className="text-[13px] font-semibold text-brand-purple px-3 py-1 rounded-full bg-brand-light mr-1">Today</button> : null}
                <button onClick={() => shift(-1)} aria-label="Previous month" className="w-9 h-9 rounded-full flex items-center justify-center active:bg-gray-100"><ChevronLeft size={22} /></button>
                <button onClick={() => shift(1)} aria-label="Next month" className="w-9 h-9 rounded-full flex items-center justify-center active:bg-gray-100"><ChevronRight size={22} /></button>
              </div>
            </div>
            <div className="grid grid-cols-7 px-3 text-center">
              {WEEK.map((w, i) => <span key={i} className="text-[12px] font-semibold text-gray-400 py-2">{w}</span>)}
              {cells.map((d, i) => {
                if (!d) return <span key={`b${i}`} />
                const isSel = sameDay(d, selected)
                const isToday = sameDay(d, today)
                const has = byDay.get(key(d))
                return (
                  <button key={i} onClick={() => setSelected(d)} className="py-1 flex flex-col items-center">
                    <span className={`w-10 h-10 rounded-full flex items-center justify-center text-[15px] ${isSel ? 'bg-brand-purple text-white font-semibold' : isToday ? 'ring-2 ring-brand-purple text-brand-purple font-semibold' : ''}`}>{d.getDate()}</span>
                    <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${has ? (isSel ? 'bg-brand-purple' : 'bg-brand-purple/60') : 'bg-transparent'}`} />
                  </button>
                )
              })}
            </div>
            <div className="px-4 pt-3 pb-4">
              <p className="font-semibold mb-2.5">{selected.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</p>
              {loading ? <div className="h-28 rounded-2xl bg-gray-100 animate-pulse" /> : dayEvents.length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center">Nothing planned for this day.</p>
              ) : <div className="space-y-3">{dayEvents.map(card)}</div>}
            </div>
          </div>
        ) : (
          <div className="px-4 pb-4">
            <div className="flex gap-2 pb-3">
              {[['All', false], ['Going', true]].map(([l, v]) => (
                <button key={l} onClick={() => setOnlyGoing(v)} className={`px-4 py-1.5 rounded-full text-[13.5px] font-semibold ${onlyGoing === v ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-600'}`}>{l}</button>
              ))}
            </div>
            {loading ? <div className="h-28 rounded-2xl bg-gray-100 animate-pulse" /> : upcoming.length === 0 ? (
              <div className="text-center pt-12">
                <span className="w-20 h-20 rounded-full bg-brand-light mx-auto flex items-center justify-center mb-4"><CalendarDays size={30} className="text-brand-purple" /></span>
                <p className="font-semibold text-lg">{onlyGoing ? 'No events you’re going to' : 'No upcoming events'}</p>
                <p className="text-sm text-gray-400 mt-1.5">New school events will appear here.</p>
              </div>
            ) : Object.entries(groups).map(([day, list]) => (
              <div key={day} className="mb-4">
                <p className="text-[13px] font-semibold text-gray-400 uppercase tracking-wide mb-2">{day}</p>
                <div className="space-y-3">{list.map(card)}</div>
              </div>
            ))}
            {past.length > 0 ? (
              <div className="mt-2">
                <button onClick={() => setShowPast((v) => !v)} className="text-[14px] font-semibold text-brand-purple">{showPast ? 'Hide' : 'Show'} past events ({past.length})</button>
                {showPast ? <div className="space-y-3 mt-3">{past.map(card)}</div> : null}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {toast ? <div className="absolute left-1/2 -translate-x-1/2 z-[70] bg-gray-900 text-white text-sm rounded-full px-4 py-2 shadow-lg" style={{ bottom: 100 }}>{toast}</div> : null}
      <BottomNav />
    </div>
  )
  }
