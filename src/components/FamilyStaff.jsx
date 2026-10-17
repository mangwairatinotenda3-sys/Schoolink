import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Search, Trash2, Loader2, Check, X, Users, Inbox, Link2 } from 'lucide-react'
import ScreenHeader from './ScreenHeader.jsx'
import PersonAvatar from './PersonAvatar.jsx'
import { ApproveSheet, ConfirmSheet, LinkParentSheet } from './FamilySheets.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { agoText } from '../lib/familyUtils.js'

// What teachers and the head see: parent requests to answer, and who is linked to whom.
export default function FamilyStaff({ user, profile, onBack }) {
  const schoolId = profile.school_id
  const [tab, setTab] = useState('requests')
  const [loading, setLoading] = useState(true)
  const [requests, setRequests] = useState([])
  const [links, setLinks] = useState([])
  const [people, setPeople] = useState(new Map())
  const [students, setStudents] = useState([])
  const [query, setQuery] = useState('')
  const [approving, setApproving] = useState(null)
  const [declining, setDeclining] = useState(null)
  const [removing, setRemoving] = useState(null)
  const [linking, setLinking] = useState(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  const channelName = useRef(`family-staff-${Math.random().toString(36).slice(2)}`)

  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(''), 2600)
    return () => clearTimeout(t)
  }, [toast])

  async function load() {
    const [r, l, s] = await Promise.all([
      supabase.from('family_requests').select('*').eq('school_id', schoolId).order('created_at', { ascending: false }).limit(150),
      supabase.from('family_links').select('*').eq('school_id', schoolId).order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, full_name, avatar_url, class_name').eq('school_id', schoolId).eq('role', 'Student').order('full_name'),
    ])
    const reqs = r.data ?? []
    const lks = l.data ?? []
    setRequests(reqs)
    setLinks(lks)
    setStudents(s.data ?? [])
    const ids = [...new Set([...reqs.map((x) => x.parent_id), ...lks.map((x) => x.parent_id)])]
    if (ids.length) {
      const { data } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', ids)
      setPeople(new Map((data ?? []).map((p) => [p.id, p])))
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
    const ch = supabase
      .channel(channelName.current)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'family_requests' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'family_links' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [schoolId])

  const pending = requests.filter((r) => r.status === 'pending')
  const answered = requests.filter((r) => r.status !== 'pending').slice(0, 10)
  const studentById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students])

  const grouped = useMemo(() => {
    const map = new Map()
    links.forEach((l) => {
      if (!map.has(l.student_id)) map.set(l.student_id, [])
      map.get(l.student_id).push(l)
    })
    const q = query.trim().toLowerCase()
    return [...map.entries()]
      .map(([sid, ls]) => ({ student: studentById.get(sid) || { id: sid, full_name: 'Student' }, links: ls }))
      .filter((g) => !q || (g.student.full_name || '').toLowerCase().includes(q) || g.links.some((l) => (people.get(l.parent_id)?.full_name || '').toLowerCase().includes(q)))
      .sort((a, b) => (a.student.full_name || '').localeCompare(b.student.full_name || ''))
  }, [links, studentById, people, query])

  const linkedStudents = new Set(links.map((l) => l.student_id)).size

  async function decline() {
    if (!declining) return
    setBusy(true)
    const { data, error } = await supabase.rpc('decide_family_request', { p_request: declining.id, p_student: null, p_approve: false })
    setBusy(false)
    if (error || !data?.ok) { setToast(error?.message || data?.error || 'Could not decline'); return }
    setDeclining(null)
    setToast('Request declined')
    load()
  }

  async function removeLink() {
    if (!removing) return
    setBusy(true)
    const { error } = await supabase.from('family_links').delete().eq('id', removing.id)
    setBusy(false)
    if (error) { setToast(error.message); return }
    setLinks((prev) => prev.filter((x) => x.id !== removing.id))
    setRemoving(null)
    setToast('Link removed')
  }

  return (
    <div className="app-shell relative">
      <ScreenHeader
        title="Parent Links"
        onBack={onBack}
        right={<button onClick={() => setLinking({})} aria-label="Link a parent" className="w-10 h-10 rounded-full bg-brand-purple text-white flex items-center justify-center"><Plus size={20} /></button>}
      />

      <div className="flex bg-gray-100 rounded-full p-1 mx-4 mt-3">
        {[['requests', `Requests${pending.length ? ` (${pending.length})` : ''}`], ['linked', 'Linked']].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 py-2 text-sm font-semibold rounded-full ${tab === k ? 'bg-white shadow-sm text-brand-purple' : 'text-gray-500'}`}>{label}</button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-3" style={{ paddingBottom: 40 }}>
        {loading ? <p className="text-center text-gray-400 mt-16"><Loader2 className="animate-spin inline" /></p> : null}

        {!loading && tab === 'requests' ? (
          <>
            {pending.length === 0 ? (
              <div className="flex flex-col items-center text-center px-8 pt-16">
                <span className="w-20 h-20 rounded-full bg-brand-light flex items-center justify-center mb-4"><Inbox size={32} className="text-brand-purple" /></span>
                <p className="font-semibold text-lg">No requests waiting</p>
                <p className="text-sm text-gray-400 mt-1">When a parent asks to be linked to a student, it shows here. You can also link a parent yourself with the + button.</p>
              </div>
            ) : pending.map((r) => {
              const p = people.get(r.parent_id)
              return (
                <div key={r.id} className="rounded-3xl border border-gray-100 shadow-sm p-4 mb-3">
                  <div className="flex items-center gap-3">
                    <PersonAvatar p={p} size={46} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">{p?.full_name || 'Parent'}</p>
                      <p className="text-xs text-gray-400">{r.relationship || 'Guardian'} · {agoText(r.created_at)}</p>
                    </div>
                  </div>
                  <p className="text-sm mt-3">Wants to be linked to <b>{r.child_name}</b></p>
                  {r.note ? <p className="text-sm text-gray-500 bg-gray-50 rounded-xl px-3 py-2 mt-2">“{r.note}”</p> : null}
                  <div className="flex gap-3 mt-3">
                    <button onClick={() => setDeclining(r)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full bg-gray-100 text-sm font-semibold text-gray-700"><X size={16} /> Decline</button>
                    <button onClick={() => setApproving(r)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full bg-brand-purple text-white text-sm font-semibold"><Check size={16} /> Choose student</button>
                  </div>
                </div>
              )
            })}
            {answered.length > 0 ? (
              <>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mt-5 mb-1">Answered</p>
                {answered.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 py-2.5 border-b border-gray-50">
                    <PersonAvatar p={people.get(r.parent_id)} size={36} />
                    <p className="flex-1 min-w-0 text-sm truncate"><b className="font-medium">{people.get(r.parent_id)?.full_name || 'Parent'}</b> · {r.child_name}</p>
                    <span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${r.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{r.status === 'approved' ? 'Linked' : 'Declined'}</span>
                  </div>
                ))}
              </>
            ) : null}
          </>
        ) : null}

        {!loading && tab === 'linked' ? (
          <>
            <div className="flex gap-2">
              <div className="flex-1 rounded-2xl bg-gray-50 px-3 py-2.5 text-center"><p className="text-xl font-bold">{linkedStudents}<span className="text-sm text-gray-400 font-semibold"> / {students.length}</span></p><p className="text-[11px] text-gray-400">students with a parent</p></div>
              <div className="flex-1 rounded-2xl bg-gray-50 px-3 py-2.5 text-center"><p className="text-xl font-bold">{links.length}</p><p className="text-[11px] text-gray-400">links in total</p></div>
            </div>
            <div className="relative mt-3">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search students or parents" className="w-full bg-gray-100 rounded-full pl-10 pr-4 py-2.5 text-sm outline-none" />
            </div>
            {grouped.length === 0 ? (
              <div className="flex flex-col items-center text-center px-8 pt-14">
                <span className="w-20 h-20 rounded-full bg-brand-light flex items-center justify-center mb-4"><Users size={32} className="text-brand-purple" /></span>
                <p className="font-semibold text-lg">{links.length ? 'No match' : 'No parents linked yet'}</p>
                <p className="text-sm text-gray-400 mt-1">{links.length ? 'Try another name.' : 'Students can invite their parents from More → My Parents, or you can link a parent here.'}</p>
                {!links.length ? <button onClick={() => setLinking({})} className="mt-5 bg-brand-purple text-white text-sm font-semibold rounded-full px-6 py-2.5">Link a parent</button> : null}
              </div>
            ) : grouped.map((g) => (
              <div key={g.student.id} className="mt-4">
                <div className="flex items-center gap-3">
                  <PersonAvatar p={g.student} size={42} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{g.student.full_name}</p>
                    <p className="text-xs text-gray-400">{g.student.class_name ? `Class ${g.student.class_name}` : 'No class set'}</p>
                  </div>
                  <button onClick={() => setLinking({ student: g.student })} aria-label={`Link another parent to ${g.student.full_name}`} className="w-9 h-9 rounded-full flex items-center justify-center text-brand-purple active:bg-gray-100"><Link2 size={18} /></button>
                </div>
                <div className="ml-6 pl-4 border-l-2 border-gray-100 mt-1">
                  {g.links.map((l) => {
                    const p = people.get(l.parent_id)
                    return (
                      <div key={l.id} className="flex items-center gap-3 py-2">
                        <PersonAvatar p={p} size={32} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{p?.full_name || 'Parent'}</p>
                          <p className="text-xs text-gray-400">{l.relationship || 'Guardian'} · {l.via === 'code' ? 'student code' : 'school'}</p>
                        </div>
                        <button onClick={() => setRemoving(l)} aria-label={`Remove ${p?.full_name || 'parent'}`} className="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 active:bg-gray-100"><Trash2 size={16} /></button>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </>
        ) : null}
      </div>

      {toast ? <div className="absolute left-1/2 -translate-x-1/2 z-30 bg-gray-900 text-white text-sm rounded-full px-4 py-2 shadow-lg max-w-[90%] text-center" style={{ bottom: 30 }}>{toast}</div> : null}

      {approving ? (
        <ApproveSheet
          request={approving}
          parent={people.get(approving.parent_id)}
          students={students}
          onClose={() => setApproving(null)}
          onDone={(s) => { setApproving(null); setToast(`Linked to ${s.full_name}`); load() }}
        />
      ) : null}

      {declining ? (
        <ConfirmSheet title="Decline this request?" body={`${people.get(declining.parent_id)?.full_name || 'The parent'} will be told the school could not link them to ${declining.child_name}.`} confirmLabel="Decline" danger busy={busy} onConfirm={decline} onClose={() => setDeclining(null)} />
      ) : null}

      {removing ? (
        <ConfirmSheet title="Remove this link?" body={`${people.get(removing.parent_id)?.full_name || 'The parent'} will stop seeing ${studentById.get(removing.student_id)?.full_name || 'the student'}'s results and timetable.`} confirmLabel="Remove" danger busy={busy} onConfirm={removeLink} onClose={() => setRemoving(null)} />
      ) : null}

      {linking ? (
        <LinkParentSheet
          students={students}
          preStudent={linking.student}
          onClose={() => setLinking(null)}
          onDone={({ student, parent }) => { setLinking(null); setToast(`${parent.full_name} linked to ${student.full_name}`); load() }}
        />
      ) : null}
    </div>
  )
        }
