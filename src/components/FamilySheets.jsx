import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, Share2, Loader2, Search, AlertCircle, CheckCircle2, KeyRound, School, X } from 'lucide-react'
import BottomSheet from './BottomSheet.jsx'
import PersonAvatar from './PersonAvatar.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { RELATIONSHIPS, cleanCode, formatCode, inviteText, nameScore, timeLeft } from '../lib/familyUtils.js'

const field = 'w-full border border-gray-200 rounded-xl px-3.5 py-3 text-[15px] outline-none focus:border-brand-purple bg-white'

function RelChips({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2 mt-1.5">
      {RELATIONSHIPS.map((r) => (
        <button key={r} onClick={() => onChange(r)} className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${value === r ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-600'}`}>{r}</button>
      ))}
    </div>
  )
}

function PrimaryButton({ children, busy, disabled, onClick }) {
  return (
    <button onClick={onClick} disabled={disabled || busy} className="w-full mt-5 bg-brand-purple text-white font-semibold py-3.5 rounded-full disabled:opacity-40 flex items-center justify-center">
      {busy ? <Loader2 size={18} className="animate-spin" /> : children}
    </button>
  )
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

// Are you sure?
export function ConfirmSheet({ title, body, confirmLabel = 'Confirm', danger, busy, onConfirm, onClose }) {
  return (
    <BottomSheet onClose={onClose}>
      <div className="px-3 pb-1">
        <p className="font-semibold text-lg">{title}</p>
        {body ? <p className="text-sm text-gray-500 mt-1.5">{body}</p> : null}
        <button onClick={onConfirm} disabled={busy} className={`w-full mt-5 font-semibold py-3.5 rounded-full text-white disabled:opacity-40 flex items-center justify-center ${danger ? 'bg-red-500' : 'bg-brand-purple'}`}>
          {busy ? <Loader2 size={18} className="animate-spin" /> : confirmLabel}
        </button>
        <button onClick={onClose} className="w-full mt-1 py-3.5 text-gray-500 font-medium">Cancel</button>
      </div>
    </BottomSheet>
  )
}

// The code a student gives to a parent.
export function InviteSheet({ code, expires, studentName, onClose, onCancelCode }) {
  const [copied, setCopied] = useState(false)
  const text = inviteText(code, studentName)
  const shown = formatCode(code)

  async function copy() {
    const ok = await copyText(shown)
    setCopied(ok)
    setTimeout(() => setCopied(false), 1800)
  }

  async function share() {
    if (navigator.share) {
      try { await navigator.share({ title: 'Schoolink invite', text }) } catch { /* closed */ }
    } else {
      const ok = await copyText(text)
      setCopied(ok)
      setTimeout(() => setCopied(false), 1800)
    }
  }

  return (
    <BottomSheet onClose={onClose}>
      <div className="px-3 text-center">
        <span className="w-14 h-14 rounded-full bg-brand-light mx-auto flex items-center justify-center"><KeyRound size={26} className="text-brand-purple" /></span>
        <p className="font-semibold text-lg mt-3">Your parent's code</p>
        <p className="text-sm text-gray-500 mt-1">Give this to your parent or guardian. They type it in Schoolink under More → My Children.</p>
        <div className="flex items-center justify-center gap-1.5 mt-5" aria-label={`Code ${shown}`}>
          {shown.split('').map((ch, i) => (ch === '-'
            ? <span key={i} className="w-2 h-0.5 bg-gray-300 rounded mx-0.5" />
            : <span key={i} className="w-9 h-12 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center text-xl font-bold font-mono">{ch}</span>))}
        </div>
        <p className="text-xs text-gray-400 mt-3">Works once · {expires ? timeLeft(expires) : '7 days'}</p>
        <div className="flex gap-3 mt-5">
          <button onClick={copy} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-full bg-gray-100 font-semibold text-sm">
            {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />} {copied ? 'Copied' : 'Copy code'}
          </button>
          <button onClick={share} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-full bg-brand-purple text-white font-semibold text-sm"><Share2 size={16} /> Share</button>
        </div>
        {onCancelCode ? <button onClick={onCancelCode} className="mt-3 py-2 text-sm text-red-500 font-medium">Cancel this code</button> : null}
      </div>
    </BottomSheet>
  )
}

// A parent adds a child: with a code from the child, or by asking the school.
export function AddChildSheet({ onClose, onLinked, onRequested }) {
  const [mode, setMode] = useState('code')
  const [rel, setRel] = useState('Mother')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)

  const [code, setCode] = useState('')

  const [q, setQ] = useState('')
  const [schools, setSchools] = useState([])
  const [searching, setSearching] = useState(false)
  const [school, setSchool] = useState(null)
  const [childName, setChildName] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    const term = q.trim()
    if (school || term.length < 2) { setSchools([]); return undefined }
    let cancelled = false
    setSearching(true)
    const t = setTimeout(async () => {
      const { data } = await supabase.from('schools').select('id, name, logo_url').ilike('name', `%${term.replace(/[%_]/g, '')}%`).limit(8)
      if (!cancelled) { setSchools(data ?? []); setSearching(false) }
    }, 250)
    return () => { cancelled = true; clearTimeout(t) }
  }, [q, school])

  async function link() {
    if (cleanCode(code).length !== 8 || busy) return
    setBusy(true)
    setError('')
    const { data, error: e } = await supabase.rpc('redeem_family_invite', { p_code: code, p_relationship: rel })
    setBusy(false)
    if (e) { setError(e.message); return }
    if (!data?.ok) { setError(data?.error || 'That did not work. Try again.'); return }
    setDone({ kind: 'linked', name: data.student_name })
    onLinked?.()
  }

  async function ask() {
    if (!school || childName.trim().length < 2 || busy) return
    setBusy(true)
    setError('')
    const { data, error: e } = await supabase.rpc('request_family_link', { p_school: String(school.id), p_child_name: childName.trim(), p_relationship: rel, p_note: note.trim() })
    setBusy(false)
    if (e) { setError(e.message); return }
    if (!data?.ok) { setError(data?.error || 'That did not work. Try again.'); return }
    setDone({ kind: 'requested', name: childName.trim(), school: school.name })
    onRequested?.()
  }

  if (done) {
    return (
      <BottomSheet onClose={onClose}>
        <div className="px-3 text-center pb-2">
          <span className="w-16 h-16 rounded-full bg-green-100 mx-auto flex items-center justify-center"><CheckCircle2 size={34} className="text-green-600" /></span>
          {done.kind === 'linked' ? (
            <>
              <p className="font-semibold text-lg mt-3">You are linked to {done.name}</p>
              <p className="text-sm text-gray-500 mt-1">Their report card and timetable are now on your My Children page.</p>
            </>
          ) : (
            <>
              <p className="font-semibold text-lg mt-3">Request sent</p>
              <p className="text-sm text-gray-500 mt-1">{done.school} will check that {done.name} is their student and link you. You will get a notification.</p>
            </>
          )}
          <button onClick={onClose} className="w-full mt-5 bg-brand-purple text-white font-semibold py-3.5 rounded-full">Done</button>
        </div>
      </BottomSheet>
    )
  }

  return (
    <BottomSheet onClose={onClose}>
      <div className="px-3">
        <p className="font-semibold text-lg">Add a child</p>
        <div className="flex bg-gray-100 rounded-full p-1 mt-3">
          {[['code', 'I have a code'], ['school', 'Ask the school']].map(([k, label]) => (
            <button key={k} onClick={() => { setMode(k); setError('') }} className={`flex-1 py-2 text-sm font-semibold rounded-full ${mode === k ? 'bg-white shadow-sm text-brand-purple' : 'text-gray-500'}`}>{label}</button>
          ))}
        </div>

        {mode === 'code' ? (
          <div className="mt-4">
            <p className="text-sm text-gray-500">Your child can make a code in Schoolink under More → My Parents.</p>
            <input
              value={formatCode(code)}
              onChange={(e) => setCode(cleanCode(e.target.value))}
              placeholder="ABCD-EFGH"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              aria-label="Code from your child"
              className="w-full mt-3 text-center text-2xl font-bold font-mono tracking-widest border border-gray-200 rounded-xl py-3.5 outline-none focus:border-brand-purple"
            />
            <label className="text-sm font-semibold block mt-4">You are their</label>
            <RelChips value={rel} onChange={setRel} />
            {error ? <p className="text-sm text-red-500 mt-3 flex items-start gap-1.5"><AlertCircle size={15} className="shrink-0 mt-0.5" /> {error}</p> : null}
            <PrimaryButton busy={busy} disabled={cleanCode(code).length !== 8} onClick={link}>Link my child</PrimaryButton>
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-sm text-gray-500">No code? Tell the school who your child is. A teacher checks and links you.</p>
            <label className="text-sm font-semibold block mt-3">School</label>
            {school ? (
              <div className="mt-1.5 flex items-center gap-3 border border-gray-200 rounded-xl px-3 py-2.5">
                {school.logo_url ? <img src={school.logo_url} alt="" className="w-8 h-8 rounded-lg object-cover" /> : <span className="w-8 h-8 rounded-lg bg-brand-light flex items-center justify-center"><School size={16} className="text-brand-purple" /></span>}
                <span className="flex-1 min-w-0 text-sm font-medium truncate">{school.name}</span>
                <button onClick={() => { setSchool(null); setQ('') }} aria-label="Change school" className="text-gray-400 p-1"><X size={16} /></button>
              </div>
            ) : (
              <>
                <div className="relative mt-1.5">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search for the school" className={`${field} pl-10`} />
                </div>
                {searching ? <p className="text-xs text-gray-400 mt-2">Searching…</p> : null}
                {schools.length ? (
                  <div className="mt-2 border border-gray-100 rounded-xl overflow-hidden">
                    {schools.map((s) => (
                      <button key={s.id} onClick={() => setSchool(s)} className="w-full flex items-center gap-3 px-3 py-2.5 text-left active:bg-gray-50 border-b border-gray-50 last:border-0">
                        {s.logo_url ? <img src={s.logo_url} alt="" className="w-8 h-8 rounded-lg object-cover" /> : <span className="w-8 h-8 rounded-lg bg-brand-light flex items-center justify-center"><School size={16} className="text-brand-purple" /></span>}
                        <span className="text-sm font-medium truncate">{s.name}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
                {!searching && q.trim().length >= 2 && schools.length === 0 ? <p className="text-xs text-gray-400 mt-2">No school found with that name.</p> : null}
              </>
            )}
            <label className="text-sm font-semibold block mt-4">Your child's full name</label>
            <input value={childName} onChange={(e) => setChildName(e.target.value)} maxLength={80} placeholder="As the school knows them" className={`${field} mt-1.5`} />
            <label className="text-sm font-semibold block mt-4">You are their</label>
            <RelChips value={rel} onChange={setRel} />
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Note for the school, like their class (optional)" className={`${field} mt-4`} />
            {error ? <p className="text-sm text-red-500 mt-3 flex items-start gap-1.5"><AlertCircle size={15} className="shrink-0 mt-0.5" /> {error}</p> : null}
            <PrimaryButton busy={busy} disabled={!school || childName.trim().length < 2} onClick={ask}>Send request</PrimaryButton>
          </div>
        )}
      </div>
    </BottomSheet>
  )
       }

function StudentList({ students, query, selected, onPick, suggestFor }) {
  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    let items = students.filter((s) => !q || (s.full_name || '').toLowerCase().includes(q))
    if (suggestFor) items = [...items].sort((a, b) => nameScore(suggestFor, b.full_name) - nameScore(suggestFor, a.full_name))
    return items
  }, [students, query, suggestFor])
  if (!list.length) return <p className="text-center text-sm text-gray-400 py-8">No students match.</p>
  return (
    <div>
      {list.map((s, i) => {
        const best = suggestFor && i === 0 && nameScore(suggestFor, s.full_name) >= 0.5 && !query.trim()
        return (
          <button key={s.id} onClick={() => onPick(s)} className="w-full flex items-center gap-3 px-1 py-2.5 text-left active:bg-gray-50">
            <PersonAvatar p={s} size={40} />
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-medium truncate">{s.full_name}</span>
              <span className="block text-xs text-gray-400">{[s.class_name, best ? 'Best match' : ''].filter(Boolean).join(' · ')}</span>
            </span>
            <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${selected?.id === s.id ? 'bg-brand-purple border-brand-purple' : 'border-gray-300'}`}>{selected?.id === s.id ? <Check size={14} className="text-white" strokeWidth={3} /> : null}</span>
          </button>
        )
      })}
    </div>
  )
}

// Staff answer a parent's request by choosing which student it is.
export function ApproveSheet({ request, parent, students, onClose, onDone }) {
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function approve() {
    if (!picked || busy) return
    setBusy(true)
    setError('')
    const { data, error: e } = await supabase.rpc('decide_family_request', { p_request: request.id, p_student: picked.id, p_approve: true })
    setBusy(false)
    if (e) { setError(e.message); return }
    if (!data?.ok) { setError(data?.error || 'Could not link.'); return }
    onDone(picked)
  }

  return (
    <BottomSheet onClose={onClose}>
      <div className="px-3">
        <p className="font-semibold text-lg">Which student is this?</p>
        <p className="text-sm text-gray-500 mt-1">{parent?.full_name || 'A parent'} wrote <b className="text-gray-700">{request.child_name}</b>. Pick the right student to link them.</p>
        <div className="relative mt-3">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search students" className={`${field} pl-10`} />
        </div>
        <div className="mt-2 overflow-y-auto" style={{ maxHeight: '38vh' }}>
          <StudentList students={students} query={query} selected={picked} onPick={setPicked} suggestFor={request.child_name} />
        </div>
        {error ? <p className="text-sm text-red-500 mt-3 flex items-start gap-1.5"><AlertCircle size={15} className="shrink-0 mt-0.5" /> {error}</p> : null}
        <PrimaryButton busy={busy} disabled={!picked} onClick={approve}>{picked ? `Link to ${picked.full_name}` : 'Choose a student'}</PrimaryButton>
      </div>
    </BottomSheet>
  )
}

// Staff link any parent account to a student directly.
export function LinkParentSheet({ students, preStudent, onClose, onDone }) {
  const [step, setStep] = useState(preStudent ? 2 : 1)
  const [query, setQuery] = useState('')
  const [student, setStudent] = useState(preStudent || null)
  const [pq, setPq] = useState('')
  const [parents, setParents] = useState([])
  const [searching, setSearching] = useState(false)
  const [parent, setParent] = useState(null)
  const [rel, setRel] = useState('Mother')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const term = pq.trim()
    if (term.length < 2) { setParents([]); return undefined }
    let cancelled = false
    setSearching(true)
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc('search_parents', { p_query: term })
      if (!cancelled) { setParents(data ?? []); setSearching(false) }
    }, 250)
    return () => { cancelled = true; clearTimeout(t) }
  }, [pq])

  async function link() {
    if (!student || !parent || busy) return
    setBusy(true)
    setError('')
    const { data, error: e } = await supabase.rpc('staff_link_parent', { p_parent: parent.id, p_student: student.id, p_relationship: rel })
    setBusy(false)
    if (e) { setError(e.message); return }
    if (!data?.ok) { setError(data?.error || 'Could not link.'); return }
    onDone({ student, parent })
  }

  return (
    <BottomSheet onClose={onClose}>
      <div className="px-3">
        <p className="font-semibold text-lg">Link a parent</p>
        {step === 1 ? (
          <>
            <p className="text-sm text-gray-500 mt-1">First choose the student.</p>
            <div className="relative mt-3">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search students" className={`${field} pl-10`} />
            </div>
            <div className="mt-2 overflow-y-auto" style={{ maxHeight: '40vh' }}>
              <StudentList students={students} query={query} selected={student} onPick={setStudent} />
            </div>
            <PrimaryButton disabled={!student} onClick={() => setStep(2)}>{student ? `Continue with ${student.full_name}` : 'Choose a student'}</PrimaryButton>
          </>
        ) : (
          <>
            <button onClick={() => setStep(1)} className="mt-2 flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 w-full text-left">
              <PersonAvatar p={student} size={32} />
              <span className="flex-1 min-w-0 text-sm font-medium truncate">{student?.full_name}</span>
              <span className="text-xs text-brand-purple font-semibold">Change</span>
            </button>
            <label className="text-sm font-semibold block mt-4">Find the parent's account</label>
            <div className="relative mt-1.5">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={pq} onChange={(e) => { setPq(e.target.value); setParent(null) }} placeholder="Type their name" className={`${field} pl-10`} />
            </div>
            {searching ? <p className="text-xs text-gray-400 mt-2">Searching…</p> : null}
            <div className="mt-1 overflow-y-auto" style={{ maxHeight: '26vh' }}>
              {parents.map((p) => (
                <button key={p.id} onClick={() => setParent(p)} className="w-full flex items-center gap-3 px-1 py-2.5 text-left active:bg-gray-50">
                  <PersonAvatar p={p} size={40} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium truncate">{p.full_name}</span>
                    <span className="block text-xs text-gray-400 truncate">{p.hint || 'Parent account'}</span>
                  </span>
                  <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${parent?.id === p.id ? 'bg-brand-purple border-brand-purple' : 'border-gray-300'}`}>{parent?.id === p.id ? <Check size={14} className="text-white" strokeWidth={3} /> : null}</span>
                </button>
              ))}
              {!searching && pq.trim().length >= 2 && parents.length === 0 ? <p className="text-xs text-gray-400 py-3">No parent account with that name. They need to sign up as a Parent / Guardian first.</p> : null}
            </div>
            <label className="text-sm font-semibold block mt-3">They are the student's</label>
            <RelChips value={rel} onChange={setRel} />
            {error ? <p className="text-sm text-red-500 mt-3 flex items-start gap-1.5"><AlertCircle size={15} className="shrink-0 mt-0.5" /> {error}</p> : null}
            <PrimaryButton busy={busy} disabled={!parent} onClick={link}>Link parent</PrimaryButton>
          </>
        )}
      </div>
    </BottomSheet>
  )
                                }
