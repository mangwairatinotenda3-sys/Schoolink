import { CalendarOff, Check, Clock, MapPin, Plus, User, Coffee } from 'lucide-react'
import { SHORT_DAY, colorFor, durationText, hhmm, isFreeLesson, lessonMinutes, minutesNow, minutesText, sortLessons, toMinutes } from '../lib/timetableUtils.js'

// The row of days at the top. Today has a dot, the chosen day is filled.
export function DayTabs({ days, active, today, dates, counts, onPick }) {
  return (
    <div data-noswipe="1" className="flex gap-2 overflow-x-auto px-4 pt-3 pb-1" style={{ scrollbarWidth: 'none' }}>
      {days.map((d) => {
        const on = active === d
        return (
          <button key={d} onClick={() => onPick(d)} aria-label={d} aria-pressed={on} className={`shrink-0 w-[54px] rounded-2xl py-2 flex flex-col items-center ${on ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-600'}`}>
            <span className="text-[11px] font-medium opacity-80">{SHORT_DAY[d]}</span>
            <span className="text-lg font-bold leading-tight">{dates[d]?.getDate()}</span>
            <span className={`mt-0.5 w-1.5 h-1.5 rounded-full ${d === today ? (on ? 'bg-white' : 'bg-brand-purple') : counts[d] ? (on ? 'bg-white/40' : 'bg-gray-300') : 'bg-transparent'}`} />
          </button>
        )
      })}
    </div>
  )
}

// "Now" or "Next up": the first thing a student looks for.
export function NowCard({ up, showClass, onOpen }) {
  if (!up) return null
  const l = up.lesson
  const c = colorFor(l.subject)
  const label = up.state === 'now' ? `Now · ends in ${minutesText(up.minutes)}` : up.state === 'next' ? `Next · in ${minutesText(up.minutes)}` : up.daysAhead === 1 ? 'Tomorrow' : up.day
  return (
    <button onClick={() => onOpen(l)} className="mx-4 mt-3 w-[calc(100%-32px)] rounded-3xl p-4 text-left text-white relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${c.hex}, #241B4E)` }}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-white/80">{label}</p>
      <p className="text-2xl font-bold leading-tight mt-1 truncate">{l.subject}</p>
      <p className="text-sm text-white/80 mt-1 truncate">{[`${hhmm(l.start_time)}–${hhmm(l.end_time)}`, l.room, l.teacher_name, showClass && l.class_name ? `Class ${l.class_name}` : ''].filter(Boolean).join(' · ')}</p>
      {up.state === 'now' ? (
        <div className="h-1.5 bg-white/25 rounded-full mt-3 overflow-hidden"><div className="h-full bg-white rounded-full" style={{ width: `${Math.round(up.progress * 100)}%`, transition: 'width 600ms ease' }} /></div>
      ) : null}
    </button>
  )
}

// One lesson in the day list.
export function LessonCard({ item, showClass, now, onOpen }) {
  const l = item.lesson
  const free = isFreeLesson(l)
  const c = colorFor(l.subject)
  const status = item.status
  const s = toMinutes(l.start_time)
  const e = toMinutes(l.end_time)
  const progress = status === 'now' && s != null && e != null ? Math.min(100, Math.max(0, ((minutesNow(now) - s) / Math.max(1, e - s)) * 100)) : 0
  const mins = lessonMinutes(l)
  return (
    <button onClick={() => onOpen(l)} className={`w-full flex items-stretch gap-3 rounded-2xl p-3 text-left ${status === 'now' ? 'bg-white ring-2 ring-brand-purple shadow-md' : free ? 'bg-gray-50' : 'bg-white border border-gray-100'} ${status === 'done' ? 'opacity-55' : ''}`}>
      <div className="w-12 shrink-0 text-center self-center">
        <p className="text-sm font-bold leading-tight">{hhmm(l.start_time)}</p>
        <p className="text-[11px] text-gray-400">{hhmm(l.end_time)}</p>
      </div>
      <span className={`w-1 rounded-full shrink-0 ${free ? 'bg-gray-200' : c.bar}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {free ? <Coffee size={15} className="text-gray-400 shrink-0" /> : null}
          <p className={`font-semibold truncate ${free ? 'text-gray-500' : ''}`}>{l.subject}</p>
          {status === 'now' ? <span className="text-[10px] font-bold bg-brand-purple text-white rounded-full px-2 py-0.5 shrink-0">NOW</span> : null}
          {status === 'next' ? <span className="text-[10px] font-bold bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 shrink-0">NEXT</span> : null}
          {status === 'done' ? <Check size={14} className="text-gray-400 shrink-0" /> : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-gray-400">
          {mins ? <span className="flex items-center gap-1"><Clock size={11} />{durationText(mins)}</span> : null}
          {l.room ? <span className="flex items-center gap-1"><MapPin size={11} />{l.room}</span> : null}
          {l.teacher_name ? <span className="flex items-center gap-1 min-w-0"><User size={11} /><span className="truncate">{l.teacher_name}</span></span> : null}
          {showClass && l.class_name ? <span className="font-semibold text-gray-500">Class {l.class_name}</span> : null}
        </div>
        {status === 'now' ? <div className="h-1 bg-gray-100 rounded-full mt-2 overflow-hidden"><div className="h-full bg-brand-purple rounded-full" style={{ width: `${progress}%`, transition: 'width 600ms ease' }} /></div> : null}
      </div>
    </button>
  )
}

// A whole day: lessons in order with the free gaps between them.
export function DayList({ plan, day, showClass, now, canEdit, onOpen, onAdd }) {
  if (plan.length === 0) {
    return (
      <div className="flex flex-col items-center text-center px-10 pt-14">
        <span className="w-20 h-20 rounded-full bg-brand-light flex items-center justify-center mb-4"><CalendarOff size={32} className="text-brand-purple" /></span>
        <p className="font-semibold text-lg">No lessons on {day}</p>
        <p className="text-sm text-gray-400 mt-1">{canEdit ? 'Add the lessons for this day.' : 'Enjoy the free day.'}</p>
        {canEdit ? <button onClick={onAdd} className="mt-5 flex items-center gap-1.5 bg-brand-purple text-white text-sm font-semibold rounded-full px-6 py-2.5"><Plus size={16} /> Add a lesson</button> : null}
      </div>
    )
  }
  return (
    <div className="px-4 pt-3 space-y-2">
      {plan.map((it) => (it.type === 'gap'
        ? <p key={it.key} className="text-center text-[11px] text-gray-400 py-0.5">Free · {minutesText(it.minutes)}</p>
        : <LessonCard key={it.key} item={it} showClass={showClass} now={now} onOpen={onOpen} />))}
    </div>
  )
}

// The whole week side by side; scroll sideways.
export function WeekGrid({ days, dates, today, byDay, showClass, onOpen, onPickDay }) {
  return (
    <div className="flex gap-3 overflow-x-auto px-4 pt-3 pb-4" style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}>
      {days.map((d) => {
        const list = sortLessons(byDay[d] || [])
        const isToday = d === today
        return (
          <div key={d} className="shrink-0 w-[150px]" style={{ scrollSnapAlign: 'start' }}>
            <button onClick={() => onPickDay(d)} className={`w-full rounded-2xl py-2 mb-2 text-center ${isToday ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-600'}`}>
              <span className="block text-[11px] font-medium opacity-80">{SHORT_DAY[d]}</span>
              <span className="block text-base font-bold leading-tight">{dates[d]?.getDate()}</span>
            </button>
            {list.length === 0 ? <p className="text-center text-xs text-gray-300 py-6">Free</p> : list.map((l) => {
              const c = colorFor(l.subject)
              const free = isFreeLesson(l)
              return (
                <button key={l.id} onClick={() => onOpen(l)} className={`w-full text-left rounded-xl p-2.5 mb-2 ${free ? 'bg-gray-50' : c.soft}`}>
                  <p className={`text-[11px] font-semibold ${free ? 'text-gray-400' : c.text}`}>{hhmm(l.start_time)}–{hhmm(l.end_time)}</p>
                  <p className={`text-sm font-semibold leading-tight mt-0.5 ${free ? 'text-gray-500' : ''}`}>{l.subject}</p>
                  <p className="text-[11px] text-gray-400 truncate mt-0.5">{[showClass ? l.class_name : '', l.room].filter(Boolean).join(' · ')}</p>
                </button>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
