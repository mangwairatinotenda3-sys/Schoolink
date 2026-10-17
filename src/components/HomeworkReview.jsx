import { useEffect, useMemo, useState } from 'react'
import { MoreVertical, Pencil, Bell, Share2, Copy, Trash2, Loader2, ChevronRight, Users } from 'lucide-react'
import ScreenHeader from './ScreenHeader.jsx'
import PersonAvatar from './PersonAvatar.jsx'
import BottomSheet, { SheetAction } from './BottomSheet.jsx'
import { ConfirmSheet } from './FamilySheets.jsx'
import HomeworkGrade from './HomeworkGrade.jsx'
import { FileList, Pill, Toast } from './HomeworkBits.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { colorFor, dueText, gradeShort, gradeTone, idOf, num, percentOf, resultsText, shareText, whenText } from '../lib/homeworkUtils.js'

const FILTERS = [
  ['all', 'Everyone'],
  ['tomark', 'To mark'],
  ['missing', 'Not handed in'],
  ['marked', 'Marked'],
]

const isIn = (r) => r.status === 'submitted' || r.status === 'returned'

function Stat({ value, label, tone = '' }) {
  return (
    <div className="flex-1 rounded-2xl bg-gray-50 py-3 text-center">
      <p className={`text-2xl font-bold ${tone}`}>{value}</p>
      <p className="text-[11px] font-medium text-gray-500 mt-0.5">{label}</p>
    </div>
  )
}

// What a teacher sees for one assignment: the details, and every student's work
export default function HomeworkReview({ a, attachments = [], canGrade, canEdit, onBack, onEdit, onDelete, onChanged, now }) {
  const color = colorFor(a.subject)
  const [tab, setTab] = useState(canGrade ? 'work' : 'info')
  const [roster, setRoster] = useState(null)
  const [filter, setFilter] = useState('all')
  const [gradeId, setGradeId] = useState(null)
  const [menu, setMenu] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(''), 2600)
    return () => clearTimeout(t)
  }, [toast])

  async function load() {
    const { data } = await supabase.rpc('hw_roster', { p_assignment: idOf(a) })
    setRoster(Array.isArray(data) ? data : [])
    return data
  }

  useEffect(() => {
    if (!canGrade) return undefined
    let timer = null
    load()
    const ch = supabase
      .channel(`hw-review-${idOf(a)}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignment_submissions', filter: `assignment_id=eq.${idOf(a)}` }, () => {
        clearTimeout(timer)
        timer = setTimeout(load, 400)
      })
      .subscribe()
    return () => { clearTimeout(timer); supabase.removeChannel(ch) }
  }, [idOf(a), canGrade])

  const list = roster || []
  const handedIn = list.filter(isIn).length
  const marked = list.filter((r) => r.status === 'returned').length
  const graded = list.filter((r) => r.status === 'returned' && r.grade != null)
  const avg = graded.length ? graded.reduce((s, r) => s + Number(r.grade), 0) / graded.length : null
  const avgPct = percentOf(avg, a.points)

  const rows = useMemo(() => {
    if (filter === 'tomark') return list.filter((r) => r.status === 'submitted')
    if (filter === 'missing') return list.filter((r) => !isIn(r))
    if (filter === 'marked') return list.filter((r) => r.status === 'returned')
    return list
  }, [list, filter])
  const counts = { all: list.length, tomark: list.filter((r) => r.status === 'submitted').length, missing: list.length - handedIn, marked }
  const gradeIndex = gradeId ? rows.findIndex((r) => r.student_id === gradeId) : -1

  useEffect(() => {
    if (gradeId && roster && gradeIndex < 0) setGradeId(null)
  }, [gradeIndex, gradeId, roster])

  async function saved(message, returned) {
    const idx = gradeIndex
    const next = returned ? (filter === 'tomark' ? rows[idx + 1] || rows[idx - 1] : rows[idx + 1]) : null
    await load()
    onChanged()
    setToast(message)
    if (returned) setGradeId(next && next.student_id !== gradeId ? next.student_id : null)
  }

  async function remind() {
    setMenu(false)
    setBusy(true)
    const { data, error } = await supabase.rpc('hw_nudge', { p_assignment: idOf(a) })
    setBusy(false)
    if (error || !data?.ok) setToast(error?.message || data?.error || 'Could not send reminders.')
    else setToast(data.count ? `Reminder sent to ${data.count} student${data.count === 1 ? '' : 's'}` : 'Everyone has handed in')
  }

  function share() {
    setMenu(false)
    const text = shareText(a, now)
    if (navigator.share) navigator.share({ title: a.title, text }).catch(() => {})
    else navigator.clipboard?.writeText(text).then(() => setToast('Copied'))
  }

  async function copyResults() {
    setMenu(false)
    try {
      await navigator.clipboard.writeText(resultsText(a, list))
      setToast('Results copied')
    } catch {
      setToast('Could not copy')
    }
  }

  async function remove() {
    setBusy(true)
    const ok = await onDelete()
    setBusy(false)
    setConfirm(false)
    if (!ok) setToast('Could not delete. Try again.')
  }

  return (
    <div className="app-shell relative">
      <ScreenHeader
        title={a.title}
        sub={[a.subject, a.class_name ? `Class ${a.class_name}` : 'Whole school'].filter(Boolean).join(' · ')}
        onBack={onBack}
        right={<button onClick={() => setMenu(true)} aria-label="More" className="w-10 h-10 rounded-full flex items-center justify-center">{busy ? <Loader2 size={19} className="animate-spin" /> : <MoreVertical size={20} />}</button>}
      />

      {canGrade ? (
        <div className="flex bg-gray-100 rounded-full p-1 mx-4 mt-3">
          {[['work', `Student work${list.length ? ` · ${handedIn}/${list.length}` : ''}`], ['info', 'Details']].map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} className={`flex-1 py-2 text-sm font-semibold rounded-full ${tab === k ? 'bg-white shadow-sm text-brand-purple' : 'text-gray-500'}`}>{label}</button>
          ))}
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto" style={{ paddingBottom: 40 }}>
        {tab === 'info' ? (
          <div className="px-4 pt-4 space-y-3">
            <div className={`${color.soft} rounded-2xl p-4`}>
              <p className="text-[22px] font-bold leading-tight">{a.title}</p>
              <p className="text-sm font-medium text-gray-600 mt-2">{dueText(a, now)}</p>
              <p className="text-xs text-gray-500 mt-1">{[a.points ? `${num(a.points)} points` : null, a.accepts_work === false ? 'Not collected in the app' : a.allow_late === false ? 'No late work' : 'Late work accepted', a.author_name].filter(Boolean).join(' · ')}</p>
            </div>
            {a.description ? (
              <div className="rounded-2xl border border-gray-100 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Instructions</p>
                <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">{a.description}</p>
              </div>
            ) : null}
            {attachments.length ? (
              <div className="rounded-2xl border border-gray-100 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Attachments</p>
                <FileList files={attachments} />
              </div>
            ) : null}
            {canGrade ? (
              <button onClick={remind} disabled={busy} className="w-full flex items-center justify-center gap-2 rounded-full border border-gray-200 py-3.5 font-semibold text-gray-700 disabled:opacity-40"><Bell size={17} /> Remind students who have not handed in</button>
            ) : null}
          </div>
        ) : (
          <div className="px-4 pt-4">
            {roster === null ? (
              <div className="flex justify-center pt-16 text-gray-400"><Loader2 className="animate-spin" /></div>
            ) : list.length === 0 ? (
              <div className="flex flex-col items-center text-center px-6 pt-16">
                <span className="w-20 h-20 rounded-full bg-brand-light flex items-center justify-center mb-4"><Users size={34} className="text-brand-purple" /></span>
                <p className="font-semibold text-lg">No students yet</p>
                <p className="text-sm text-gray-400 mt-1">{a.class_name ? `No students are in class ${a.class_name}. Put students in classes from More → Parent Links.` : 'There are no active students in your school yet.'}</p>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <Stat value={`${handedIn}/${list.length}`} label="Handed in" tone="text-brand-purple" />
                  <Stat value={counts.missing} label="Not handed in" tone={counts.missing ? 'text-red-500' : ''} />
                  <Stat value={marked} label="Marked" tone="text-emerald-600" />
                </div>
                {avg != null ? <p className="text-center text-sm text-gray-500 mt-3">Class average <span className="font-semibold text-gray-800">{gradeShort(avg, a.points)}</span>{avgPct != null ? ` (${avgPct}%)` : ''}</p> : null}

                <div className="flex gap-2 overflow-x-auto mt-4" style={{ scrollbarWidth: 'none' }}>
                  {FILTERS.map(([k, label]) => (
                    <button key={k} onClick={() => setFilter(k)} className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ${filter === k ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-600'}`}>{label} <span className="opacity-70">{counts[k]}</span></button>
                  ))}
                </div>

                <div className="mt-2">
                  {rows.length === 0 ? <p className="text-center text-sm text-gray-400 pt-10">Nobody here.</p> : rows.map((r) => {
                    const pct = percentOf(r.grade, a.points)
                    const tone = gradeTone(pct)
                    return (
                      <button key={r.student_id} onClick={() => setGradeId(r.student_id)} className="w-full flex items-center gap-3 py-3 text-left border-b border-gray-50 active:bg-gray-50">
                        <PersonAvatar p={{ full_name: r.full_name, avatar_url: r.avatar_url }} size={42} />
                        <span className="flex-1 min-w-0">
                          <span className="block font-semibold text-[15px] truncate">{r.full_name}</span>
                          <span className="block text-xs text-gray-400">{r.submitted_at ? `${r.is_late ? 'Late · ' : ''}${whenText(r.submitted_at)}` : r.status === 'draft' && (r.body || (r.files || []).length) ? 'Draft only' : 'Not handed in'}</span>
                        </span>
                        {r.status === 'returned' ? (
                          <span className={`rounded-xl px-3 py-1.5 text-sm font-bold ${tone.bg} ${tone.text}`}>{r.grade != null ? gradeShort(r.grade, a.points) : 'Marked'}</span>
                        ) : r.status === 'submitted' ? (
                          <Pill className={r.is_late ? 'bg-amber-50 text-amber-700' : 'bg-brand-light text-brand-purple'}>{r.is_late ? 'Late' : 'To mark'}</Pill>
                        ) : (
                          <Pill className="bg-gray-100 text-gray-500">Missing</Pill>
                        )}
                        <ChevronRight size={16} className="text-gray-300 shrink-0" />
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {gradeId && gradeIndex >= 0 ? (
        <HomeworkGrade key={gradeId} a={a} rows={rows} index={gradeIndex} onIndex={(i) => rows[i] && setGradeId(rows[i].student_id)} onClose={() => setGradeId(null)} onSaved={saved} />
      ) : null}

      {menu ? (
        <BottomSheet onClose={() => setMenu(false)}>
          {canEdit ? <SheetAction icon={Pencil} label="Edit assignment" onClick={() => { setMenu(false); onEdit() }} /> : null}
          {canGrade ? <SheetAction icon={Bell} label="Remind students" sub="Only those who have not handed in" onClick={remind} /> : null}
          <SheetAction icon={Share2} label="Share" onClick={share} />
          {canGrade && list.length ? <SheetAction icon={Copy} label="Copy results" sub="Names and marks, to paste anywhere" onClick={copyResults} /> : null}
          {canEdit ? <SheetAction icon={Trash2} label="Delete assignment" danger onClick={() => { setMenu(false); setConfirm(true) }} /> : null}
        </BottomSheet>
      ) : null}

      {confirm ? (
        <ConfirmSheet title="Delete this assignment?" body="Students and parents will no longer see it, and the work handed in for it is deleted too." confirmLabel="Delete" danger busy={busy} onConfirm={remove} onClose={() => setConfirm(false)} />
      ) : null}
      <Toast text={toast} />
    </div>
  )
}
