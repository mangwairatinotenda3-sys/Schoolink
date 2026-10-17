import { useEffect, useMemo, useState } from 'react'
import { X, Search, Check, Loader2, Users } from 'lucide-react'
import PersonAvatar from './PersonAvatar.jsx'
import { supabase } from '../lib/supabaseClient.js'

// Teachers put students into classes, so the timetable knows what to show each student.
export default function StudentClasses({ schoolId, classes, onClose, onChanged }) {
  const [students, setStudents] = useState(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [chosen, setChosen] = useState(new Set())
  const [className, setClassName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  async function load() {
    const { data } = await supabase.from('profiles').select('id, full_name, avatar_url, class_name').eq('school_id', schoolId).eq('role', 'Student').order('full_name')
    setStudents(data ?? [])
  }

  useEffect(() => { load() }, [schoolId])

  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(''), 2200)
    return () => clearTimeout(t)
  }, [toast])

  const allClasses = useMemo(() => [...new Set([...(classes || []), ...(students || []).map((s) => s.class_name).filter(Boolean)])].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), [classes, students])

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (students || []).filter((s) => (filter === 'all' ? true : filter === 'none' ? !s.class_name : s.class_name === filter) && (!q || (s.full_name || '').toLowerCase().includes(q)))
  }, [students, query, filter])

  const withoutClass = (students || []).filter((s) => !s.class_name).length

  function toggle(id) {
    setChosen((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  async function save() {
    if (!chosen.size || saving) return
    setSaving(true)
    setError('')
    const { error: e } = await supabase.rpc('set_student_class', { p_students: [...chosen], p_class: className.trim() })
    setSaving(false)
    if (e) { setError(e.message); return }
    setToast(className.trim() ? `${chosen.size} moved to ${className.trim()}` : `${chosen.size} removed from their class`)
    setChosen(new Set())
    setClassName('')
    await load()
    onChanged?.()
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col max-w-[480px] mx-auto">
      <div className="flex items-center gap-2 px-3 shrink-0 border-b border-gray-100" style={{ height: 56 }}>
        <button onClick={onClose} aria-label="Close" className="w-10 h-10 rounded-full flex items-center justify-center"><X size={22} /></button>
        <h1 className="font-semibold text-lg flex-1">Student classes</h1>
      </div>

      <div className="px-4 pt-3">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search students" className="w-full bg-gray-100 rounded-full pl-10 pr-4 py-2.5 text-sm outline-none" />
        </div>
        <div className="flex gap-2 overflow-x-auto mt-3 pb-1" style={{ scrollbarWidth: 'none' }}>
          {[['all', 'All'], ['none', `No class${withoutClass ? ` (${withoutClass})` : ''}`], ...allClasses.map((c) => [c, c])].map(([k, label]) => (
            <button key={k} onClick={() => setFilter(k)} className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ${filter === k ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-600'}`}>{label}</button>
          ))}
        </div>
        {list.length > 0 ? (
          <button onClick={() => setChosen(chosen.size === list.length ? new Set() : new Set(list.map((s) => s.id)))} className="text-sm font-semibold text-brand-purple mt-2">{chosen.size === list.length ? 'Clear selection' : `Select all ${list.length}`}</button>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto mt-1">
        {!students ? <p className="text-center text-gray-400 mt-10"><Loader2 className="animate-spin inline" /></p> : list.length === 0 ? (
          <div className="flex flex-col items-center text-center px-8 pt-14">
            <span className="w-16 h-16 rounded-full bg-brand-light flex items-center justify-center mb-3"><Users size={28} className="text-brand-purple" /></span>
            <p className="font-semibold">{students.length ? 'No students here' : 'No students have joined yet'}</p>
          </div>
        ) : list.map((s) => (
          <button key={s.id} onClick={() => toggle(s.id)} className="w-full flex items-center gap-3 px-4 py-2.5 text-left active:bg-gray-50">
            <PersonAvatar p={s} size={40} />
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-medium truncate">{s.full_name}</span>
              <span className="block text-xs text-gray-400">{s.class_name ? `Class ${s.class_name}` : 'No class yet'}</span>
            </span>
            <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${chosen.has(s.id) ? 'bg-brand-purple border-brand-purple' : 'border-gray-300'}`}>{chosen.has(s.id) ? <Check size={14} className="text-white" strokeWidth={3} /> : null}</span>
          </button>
        ))}
      </div>

      {chosen.size > 0 ? (
        <div className="border-t border-gray-100 p-4 bg-white">
          <p className="text-sm font-semibold">{chosen.size} selected</p>
          <div className="flex gap-2 mt-2">
            <input value={className} onChange={(e) => setClassName(e.target.value)} maxLength={40} placeholder="Class, e.g. 3A (empty removes)" className="flex-1 min-w-0 border border-gray-200 rounded-xl px-3.5 py-2.5 text-[15px] outline-none focus:border-brand-purple" />
            <button onClick={save} disabled={saving} className="px-5 rounded-full bg-brand-purple text-white font-semibold text-sm disabled:opacity-40 flex items-center justify-center">{saving ? <Loader2 size={16} className="animate-spin" /> : 'Save'}</button>
          </div>
          {allClasses.length ? (
            <div className="flex gap-2 overflow-x-auto mt-2" style={{ scrollbarWidth: 'none' }}>
              {allClasses.map((c) => <button key={c} onClick={() => setClassName(c)} className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${className === c ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-600'}`}>{c}</button>)}
            </div>
          ) : null}
          {error ? <p className="text-sm text-red-500 mt-2">{error}</p> : null}
        </div>
      ) : null}

      {toast ? <div className="absolute left-1/2 -translate-x-1/2 z-30 bg-gray-900 text-white text-sm rounded-full px-4 py-2 shadow-lg max-w-[90%] text-center" style={{ bottom: chosen.size ? 130 : 30 }}>{toast}</div> : null}
    </div>
  )
    }
