import { useEffect, useMemo, useState } from 'react'
import { Search, Check, X, Loader2, Users } from 'lucide-react'
import PersonAvatar from './PersonAvatar.jsx'
import { supabase } from '../lib/supabaseClient.js'

const COLUMNS = 'id, full_name, role, avatar_url, class_name, school_id, account_type'

function subtitle(p) {
  if (p.role === 'Student') return p.class_name ? `Student · ${p.class_name}` : 'Student'
  return p.role || (p.account_type === 'parent' ? 'Parent' : 'Schoolink member')
}

function Chip({ active, onClick, children }) {
  return <button type="button" onClick={onClick} className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ${active ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-600'}`}>{children}</button>
}

// Choose people for a group, the way WhatsApp does: chips on top, a list below, tap to tick.
export default function PeoplePicker({ meId, schoolId, excludeIds = [], selected, setSelected, max = 250 }) {
  const [filter, setFilter] = useState(schoolId ? 'staff' : 'all')
  const [query, setQuery] = useState('')
  const [staff, setStaff] = useState([])
  const [classes, setClasses] = useState([])
  const [classMembers, setClassMembers] = useState([])
  const [found, setFound] = useState([])
  const [loading, setLoading] = useState(false)

  const blocked = useMemo(() => new Set([meId, ...excludeIds]), [meId, excludeIds.join(',')])
  const picked = useMemo(() => new Set(selected.map((p) => p.id)), [selected])

  useEffect(() => {
    if (!schoolId) return
    supabase.from('profiles').select(COLUMNS).eq('school_id', schoolId).eq('account_type', 'school_member').neq('role', 'Student').order('full_name').limit(300).then(({ data }) => setStaff(data ?? []))
    supabase.from('profiles').select('class_name').eq('school_id', schoolId).eq('role', 'Student').limit(3000).then(({ data }) => {
      setClasses([...new Set((data ?? []).map((r) => (r.class_name || '').trim()).filter(Boolean))].sort())
    })
  }, [schoolId])

  useEffect(() => {
    if (filter === 'all' || filter === 'staff' || !schoolId) return
    setLoading(true)
    supabase.from('profiles').select(COLUMNS).eq('school_id', schoolId).eq('role', 'Student').eq('class_name', filter).order('full_name').limit(300).then(({ data }) => {
      setClassMembers(data ?? [])
      setLoading(false)
    })
  }, [filter, schoolId])

  useEffect(() => {
    if (filter !== 'all') return undefined
    const q = query.trim()
    if (q.length < 2) { setFound([]); return undefined }
    setLoading(true)
    const t = setTimeout(async () => {
      const { data } = await supabase.from('profiles').select(COLUMNS).ilike('full_name', `%${q.replace(/[%_]/g, '')}%`).limit(40)
      setFound(data ?? [])
      setLoading(false)
    }, 250)
    return () => clearTimeout(t)
  }, [query, filter])

  const base = filter === 'all' ? found : filter === 'staff' ? staff : classMembers
  const q = query.trim().toLowerCase()
  const list = base.filter((p) => !blocked.has(p.id) && (filter === 'all' || !q || (p.full_name || '').toLowerCase().includes(q)))
  const unpicked = list.filter((p) => !picked.has(p.id))

  function toggle(p) {
    if (picked.has(p.id)) setSelected(selected.filter((x) => x.id !== p.id))
    else if (selected.length < max) setSelected([...selected, p])
  }

  function addAll() {
    setSelected([...selected, ...unpicked].slice(0, max))
  }

  return (
    <div className="flex flex-col min-h-0 flex-1">
      {selected.length > 0 ? (
        <div className="flex gap-3 overflow-x-auto px-4 pt-3 pb-2 shrink-0 border-b border-gray-100" style={{ scrollbarWidth: 'none' }}>
          {selected.map((p) => (
            <button key={p.id} onClick={() => toggle(p)} className="shrink-0 w-16 flex flex-col items-center" aria-label={`Remove ${p.full_name}`}>
              <span className="relative">
                <PersonAvatar p={p} size={48} />
                <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-gray-500 text-white flex items-center justify-center border-2 border-white"><X size={11} /></span>
              </span>
              <span className="text-[11px] mt-1 w-full truncate text-center text-gray-600">{(p.full_name || 'Member').split(' ')[0]}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="px-4 pt-3 shrink-0">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={filter === 'all' ? 'Search by name' : 'Filter this list'} className="w-full bg-gray-100 rounded-full pl-10 pr-4 py-2.5 text-sm outline-none" />
        </div>
        <div className="flex gap-2 overflow-x-auto mt-3" style={{ scrollbarWidth: 'none' }}>
          {schoolId ? <Chip active={filter === 'staff'} onClick={() => setFilter('staff')}>School staff</Chip> : null}
          <Chip active={filter === 'all'} onClick={() => setFilter('all')}>Anyone</Chip>
          {classes.map((c) => <Chip key={c} active={filter === c} onClick={() => setFilter(c)}>Class {c}</Chip>)}
        </div>
        {filter !== 'all' && unpicked.length > 0 ? (
          <button onClick={addAll} className="mt-3 text-sm font-semibold text-brand-purple">Add all {unpicked.length}</button>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto mt-1 pb-28">
        {loading ? <div className="flex justify-center pt-10 text-gray-400"><Loader2 className="animate-spin" /></div> : null}
        {!loading && filter === 'all' && query.trim().length < 2 ? (
          <div className="flex flex-col items-center text-center px-10 pt-14 text-gray-400"><Users size={30} /><p className="text-sm mt-3">Type at least 2 letters of a name to find someone.</p></div>
        ) : null}
        {!loading && list.length === 0 && (filter !== 'all' || query.trim().length >= 2) ? <p className="text-center text-sm text-gray-400 pt-10">{filter === 'all' ? 'Nobody found.' : 'Nobody here.'}</p> : null}
        {list.map((p) => {
          const on = picked.has(p.id)
          return (
            <button key={p.id} onClick={() => toggle(p)} className="w-full flex items-center gap-3 px-4 py-2.5 text-left active:bg-gray-50">
              <PersonAvatar p={p} size={44} />
              <span className="flex-1 min-w-0">
                <span className="block font-medium text-[15px] truncate">{p.full_name || 'Schoolink member'}</span>
                <span className="block text-xs text-gray-400 truncate">{subtitle(p)}</span>
              </span>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${on ? 'bg-brand-purple text-white' : 'border-2 border-gray-300'}`}>{on ? <Check size={14} /> : null}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
