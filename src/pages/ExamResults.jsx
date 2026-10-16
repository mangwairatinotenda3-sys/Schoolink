import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Plus, MoreVertical, Share2, Printer, Search, Loader2, GraduationCap, Eye, EyeOff, Settings2, Users, ChevronRight, ArrowUpDown, FileText } from 'lucide-react'
import ReportCard from '../components/ReportCard.jsx'
import ProgressView from '../components/ProgressView.jsx'
import ResultsEntry from '../components/ResultsEntry.jsx'
import BottomSheet, { SheetAction } from '../components/BottomSheet.jsx'
import { EditResultSheet, RemarksSheet, GradingScaleSheet } from '../components/ResultSheets.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { isSchoolMember } from '../lib/permissions.js'
import {
  EDITOR_ROLES, ADMIN_ROLES, currentTerm, normaliseScale, listTerms, sortTermKeys, termKey, termLabel, averageOf, gradeFor, tone, reportText, groupSubjects,
} from '../lib/resultsUtils.js'

function Avatar({ p, size = 44 }) {
  return p?.avatar_url ? <img src={p.avatar_url} alt="" className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} /> : <span className="rounded-full bg-brand-light text-brand-purple font-semibold flex items-center justify-center shrink-0" style={{ width: size, height: size }}>{(p?.full_name || '?').slice(0, 1).toUpperCase()}</span>
}

function Chip({ active, onClick, children }) {
  return <button onClick={onClick} className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ${active ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-600'}`}>{children}</button>
}

const keyOf = (r) => r.student_id || `name:${(r.student_name || '').trim().toLowerCase()}`

export default function ExamResults() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()

  const member = isSchoolMember(profile)
  const isEditor = member && EDITOR_ROLES.includes(profile?.role)
  const isAdmin = member && ADMIN_ROLES.includes(profile?.role)
  const isStudent = member && profile?.role === 'Student'
  const isParent = profile?.account_type === 'parent' || profile?.role === 'Parent / Guardian'

  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [school, setSchool] = useState(null)
  const [people, setPeople] = useState(new Map())
  const [children, setChildren] = useState([])
  const [activeKey, setActiveKey] = useState(null)
  const [term, setTerm] = useState(null)
  const [tab, setTab] = useState('card')
  const [summary, setSummary] = useState(null)
  const [remarks, setRemarks] = useState(null)
  const [classFilter, setClassFilter] = useState('')
  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState('name')
  const [sheet, setSheet] = useState(null)
  const [editing, setEditing] = useState(null)
  const [entry, setEntry] = useState(false)
  const [toast, setToast] = useState('')

  const scale = useMemo(() => normaliseScale(school?.grading_scale), [school])
  const schoolId = profile?.school_id

  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(''), 2600)
    return () => clearTimeout(t)
  }, [toast])

  // ---------- Loading ----------
  async function loadPeople(ids) {
    const need = ids.filter((id) => id && !people.has(id))
    if (!need.length) return
    const { data } = await supabase.from('profiles').select('id, full_name, avatar_url, school_id').in('id', need)
    setPeople((prev) => {
      const next = new Map(prev)
      ;(data ?? []).forEach((p) => next.set(p.id, p))
      return next
    })
  }

  async function loadSchool(id) {
    if (!id) return
    const { data } = await supabase.from('schools').select('name, logo_url, grading_scale').eq('id', id).maybeSingle()
    if (data) setSchool(data)
  }

  async function load(quiet = false) {
    if (!user || !profile) return
    if (!quiet) setLoading(true)
    if (isEditor) {
      const { data } = await supabase.from('exam_results').select('*').eq('school_id', schoolId).order('created_at', { ascending: false }).limit(3000)
      setRows(data ?? [])
      loadPeople([...new Set((data ?? []).map((r) => r.student_id).filter(Boolean))])
      await loadSchool(schoolId)
    } else if (isStudent) {
      const own = await supabase.from('exam_results').select('*').eq('student_id', user.id)
      const legacy = await supabase.from('exam_results').select('*').is('student_id', null).ilike('student_name', (profile.full_name || '').replace(/[%_]/g, '\\$&'))
      const all = [...(own.data ?? []), ...(legacy.data ?? [])].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      setRows(all)
      setActiveKey(user.id)
      setPeople(new Map([[user.id, { id: user.id, full_name: profile.full_name, avatar_url: profile.avatar_url }]]))
      await loadSchool(schoolId)
    } else if (isParent) {
      const { data: ids } = await supabase.rpc('my_children')
      const list = Array.isArray(ids) ? ids.map((x) => (typeof x === 'string' ? x : Object.values(x)[0])) : []
      if (list.length) {
        const { data: kids } = await supabase.from('profiles').select('id, full_name, avatar_url, school_id').in('id', list)
        setChildren(kids ?? [])
        setPeople(new Map((kids ?? []).map((k) => [k.id, k])))
        setActiveKey((kids ?? [])[0]?.id || null)
        const { data } = await supabase.from('exam_results').select('*').in('student_id', list).order('created_at', { ascending: false })
        setRows(data ?? [])
        await loadSchool((kids ?? [])[0]?.school_id)
      }
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [user?.id, profile?.id, profile?.school_id, profile?.role])

  // Switching child (parents): the school may differ
  useEffect(() => {
    if (!isParent || !activeKey) return
    const kid = people.get(activeKey)
    if (kid?.school_id) loadSchool(kid.school_id)
  }, [activeKey])

  // ---------- What is on screen ----------
  const terms = useMemo(() => {
    const keys = listTerms(rows)
    if (isEditor) {
      const now = `${new Date().getFullYear()}|${currentTerm()}`
      if (!keys.includes(now)) keys.push(now)
    }
    return sortTermKeys(keys)
  }, [rows, isEditor])

  useEffect(() => {
    if (!term || !terms.includes(term)) setTerm(terms[0] || null)
  }, [terms])

  // A student's own list also holds older results that were only typed with their name
  const studentRows = useMemo(() => (!activeKey ? [] : isStudent ? rows : rows.filter((r) => keyOf(r) === activeKey)), [rows, activeKey, isStudent])
  // Students and parents: when you switch child, jump to a term that child has results for
  useEffect(() => {
    if (isEditor || !activeKey) return
    const keys = sortTermKeys(listTerms(studentRows))
    if (keys.length && !keys.includes(term)) setTerm(keys[0])
  }, [activeKey, studentRows])

  const termRows = studentRows.filter((r) => termKey(r) === term)
  const publishedRows = studentRows.filter((r) => r.published !== false)
  const student = activeKey ? (people.get(activeKey) || { id: activeKey.startsWith('name:') ? null : activeKey, full_name: studentRows[0]?.student_name }) : null
  const className = termRows.find((r) => r.class_name)?.class_name || ''
  const [yearOfTerm, termName] = term ? term.split('|') : ['', '']

  useEffect(() => {
    setSummary(null)
    setRemarks(null)
    if (!activeKey || !term || activeKey.startsWith('name:')) return
    let cancelled = false
    supabase.rpc('report_summary', { p_student: activeKey, p_term: termName, p_year: yearOfTerm }).then(({ data }) => { if (!cancelled) setSummary(Array.isArray(data) ? data[0] : data) })
    supabase.from('report_remarks').select('*').eq('student_id', activeKey).eq('term', termName).eq('year', yearOfTerm).maybeSingle().then(({ data }) => { if (!cancelled) setRemarks(data) })
    return () => { cancelled = true }
  }, [activeKey, term, rows])

  // Teacher's list: one row per student for the chosen term
  const classes = useMemo(() => [...new Set(rows.map((r) => r.class_name).filter(Boolean))].sort(), [rows])
  const subjects = useMemo(() => [...new Set(rows.map((r) => (r.subject || '').trim()).filter(Boolean))].sort(), [rows])
  const roster = useMemo(() => {
    if (!isEditor || !term) return []
    const map = new Map()
    rows.filter((r) => termKey(r) === term && (!classFilter || r.class_name === classFilter)).forEach((r) => {
      const k = keyOf(r)
      if (!map.has(k)) map.set(k, { key: k, id: r.student_id, name: r.student_name, rows: [] })
      map.get(k).rows.push(r)
    })
    const q = query.trim().toLowerCase()
    return [...map.values()]
      .map((s) => ({ ...s, name: people.get(s.id)?.full_name || s.name, avatar: people.get(s.id)?.avatar_url, avg: averageOf(s.rows), hidden: s.rows.filter((r) => r.published === false).length, cls: s.rows.find((r) => r.class_name)?.class_name }))
      .filter((s) => !q || (s.name || '').toLowerCase().includes(q))
      .sort((a, b) => (sortBy === 'rank' ? (b.avg ?? -1) - (a.avg ?? -1) : (a.name || '').localeCompare(b.name || '')))
  }, [rows, term, classFilter, query, sortBy, people, isEditor])
  const hiddenInTerm = isEditor && term ? rows.filter((r) => termKey(r) === term && r.published === false) : []

  async function publishTerm() {
    setSheet(null)
    const ids = hiddenInTerm.map((r) => r.id)
    if (!ids.length) return
    const { error } = await supabase.from('exam_results').update({ published: true }).in('id', ids)
    if (error) { setToast(error.message); return }
    await supabase.rpc('announce_results', { p_term: termName, p_year: yearOfTerm, p_students: [...new Set(hiddenInTerm.map((r) => r.student_id).filter(Boolean))] })
    setToast(`Published ${ids.length} mark${ids.length > 1 ? 's' : ''}`)
    load(true)
  }

  function share() {
    const subs = groupSubjects(termRows.filter((r) => r.published !== false), scale)
    const avg = summary?.average ?? averageOf(termRows.filter((r) => r.published !== false))
    const text = reportText({ student, school, term: termLabel(term), subjects: subs, average: avg, overall: gradeFor(avg, scale), position: summary?.class_position, size: summary?.class_size })
    if (navigator.share) navigator.share({ title: `${student?.full_name} — ${termLabel(term)}`, text }).catch(() => {})
    else navigator.clipboard?.writeText(text).then(() => setToast('Copied to share'))
    }

  // ---------- Screens ----------
  const backFromDetail = isEditor && activeKey
  const title = isEditor && !activeKey ? 'Results' : 'Report card'

  function onBack() {
    if (backFromDetail) { setActiveKey(null); setTab('card') } else navigate(-1)
  }

  if (loading) {
    return <div className="app-shell items-center justify-center flex text-gray-400"><Loader2 className="animate-spin" /></div>
  }

  if (!isEditor && !isStudent && !isParent) {
    return (
      <div className="app-shell">
        <Header title="Results" onBack={() => navigate(-1)} />
        <div className="flex-1 flex flex-col items-center justify-center text-center px-10">
          <span className="w-20 h-20 rounded-full bg-brand-light flex items-center justify-center mb-4"><GraduationCap size={34} className="text-brand-purple" /></span>
          <p className="font-semibold text-lg">Results are for students, parents and teachers</p>
          <p className="text-sm text-gray-400 mt-1">Report cards appear here for the student and their linked parents.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell relative">
      <style>{'@media print{body *{visibility:hidden}#report-card-print,#report-card-print *{visibility:visible}#report-card-print{position:absolute;left:0;top:0;width:100%;box-shadow:none!important;border:0!important}.app-shell{height:auto!important;overflow:visible!important}}'}</style>
      <Header
        title={title}
        onBack={onBack}
        right={(
          <>
            {isEditor && !activeKey ? <button onClick={() => setEntry(true)} aria-label="Enter marks" className="w-10 h-10 rounded-full bg-brand-purple text-white flex items-center justify-center"><Plus size={20} /></button> : null}
            {isAdmin && !activeKey ? <button onClick={() => setSheet('menu')} aria-label="More" className="w-10 h-10 rounded-full flex items-center justify-center"><MoreVertical size={20} /></button> : null}
            {activeKey && studentRows.length ? <button onClick={share} aria-label="Share" className="w-10 h-10 rounded-full flex items-center justify-center"><Share2 size={19} /></button> : null}
            {activeKey && studentRows.length ? <button onClick={() => window.print()} aria-label="Print or save as PDF" className="w-10 h-10 rounded-full flex items-center justify-center"><Printer size={19} /></button> : null}
          </>
        )}
      />

      <div className="flex-1 overflow-y-auto" style={{ paddingBottom: 40 }}>
        {/* Parents with several children */}
        {isParent && children.length > 1 ? (
          <div className="flex gap-2 overflow-x-auto px-4 pt-3" style={{ scrollbarWidth: 'none' }}>
            {children.map((c) => (
              <button key={c.id} onClick={() => setActiveKey(c.id)} className={`shrink-0 flex items-center gap-2 rounded-full pl-1.5 pr-4 py-1.5 ${activeKey === c.id ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-700'}`}>
                <Avatar p={c} size={28} /><span className="text-sm font-medium">{c.full_name?.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        ) : null}

        {isParent && children.length === 0 ? (
          <div className="flex flex-col items-center text-center px-10 pt-24">
            <span className="w-20 h-20 rounded-full bg-brand-light flex items-center justify-center mb-4"><Users size={34} className="text-brand-purple" /></span>
            <p className="font-semibold text-lg">No child linked yet</p>
            <p className="text-sm text-gray-400 mt-1">Ask your child's school to link your account to your child. Their report cards will show here.</p>
          </div>
        ) : null}

        {/* Teacher: list of students */}
        {isEditor && !activeKey ? (
          <div>
            <div className="flex gap-2 overflow-x-auto px-4 pt-3" style={{ scrollbarWidth: 'none' }}>
              {terms.map((t) => <Chip key={t} active={term === t} onClick={() => setTerm(t)}>{termLabel(t)}</Chip>)}
            </div>
            {classes.length > 0 ? (
              <div className="flex gap-2 overflow-x-auto px-4 pt-2" style={{ scrollbarWidth: 'none' }}>
                <Chip active={!classFilter} onClick={() => setClassFilter('')}>All classes</Chip>
                {classes.map((c) => <Chip key={c} active={classFilter === c} onClick={() => setClassFilter(c)}>{c}</Chip>)}
              </div>
            ) : null}
            <div className="flex items-center gap-2 px-4 pt-3">
              <div className="flex-1 relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search students" className="w-full bg-gray-100 rounded-full pl-10 pr-4 py-2.5 text-sm outline-none" />
              </div>
              <button onClick={() => setSortBy(sortBy === 'name' ? 'rank' : 'name')} className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-gray-100 rounded-full px-3 py-2.5"><ArrowUpDown size={14} /> {sortBy === 'name' ? 'A–Z' : 'Top'}</button>
            </div>

            {hiddenInTerm.length > 0 ? (
              <button onClick={publishTerm} className="mx-4 mt-3 w-[calc(100%-32px)] flex items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-left">
                <EyeOff size={20} className="text-amber-600 shrink-0" />
                <span className="flex-1"><span className="block text-sm font-semibold text-amber-800">{hiddenInTerm.length} mark{hiddenInTerm.length > 1 ? 's' : ''} hidden from students</span><span className="block text-xs text-amber-700/80">Tap to publish them and notify students and parents.</span></span>
                <Eye size={18} className="text-amber-600" />
              </button>
            ) : null}

            <div className="mt-2">
              {roster.length === 0 ? (
                <div className="flex flex-col items-center text-center px-10 pt-16">
                  <span className="w-20 h-20 rounded-full bg-brand-light flex items-center justify-center mb-4"><FileText size={32} className="text-brand-purple" /></span>
                  <p className="font-semibold text-lg">{rows.length ? 'No results for this term' : 'No results yet'}</p>
                  <p className="text-sm text-gray-400 mt-1">Tap + to enter marks for a class in one go.</p>
                  <button onClick={() => setEntry(true)} className="mt-5 bg-brand-purple text-white text-sm font-semibold rounded-full px-6 py-2.5">Enter marks</button>
                </div>
              ) : roster.map((s, i) => {
                const g = gradeFor(s.avg, scale)
                return (
                  <button key={s.key} onClick={() => { setActiveKey(s.key); setTab('card') }} className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-gray-50 border-b border-gray-50">
                    {sortBy === 'rank' ? <span className="w-6 text-center text-sm font-bold text-gray-400">{i + 1}</span> : null}
                    <Avatar p={{ full_name: s.name, avatar_url: s.avatar }} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[15px] truncate">{s.name}</p>
                      <p className="text-xs text-gray-400">{[s.cls, `${new Set(s.rows.map((r) => (r.subject || '').toLowerCase())).size} subjects`].filter(Boolean).join(' · ')}{s.hidden ? ' · hidden' : ''}</p>
                    </div>
                    <span className="text-sm font-semibold">{s.avg != null ? `${Math.round(s.avg)}%` : ''}</span>
                    <span className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${tone(s.avg).bg} ${tone(s.avg).text}`}>{g?.grade || '—'}</span>
                    <ChevronRight size={16} className="text-gray-300" />
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        {/* One student's card */}
        {activeKey ? (
          <div className="px-4 pt-3">
            {terms.length > 0 ? (
              <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {sortTermKeys(listTerms(studentRows)).map((t) => <Chip key={t} active={term === t} onClick={() => setTerm(t)}>{termLabel(t)}</Chip>)}
              </div>
            ) : null}
            <div className="flex bg-gray-100 rounded-full p-1 mt-3 mb-4">
              {[['card', 'Report card'], ['progress', 'Progress']].map(([k, label]) => (
                <button key={k} onClick={() => setTab(k)} className={`flex-1 py-2 text-sm font-semibold rounded-full ${tab === k ? 'bg-white shadow-sm text-brand-purple' : 'text-gray-500'}`}>{label}</button>
              ))}
            </div>
            {studentRows.length === 0 ? (
              <div className="text-center pt-16 px-8">
                <span className="w-20 h-20 rounded-full bg-brand-light mx-auto flex items-center justify-center mb-4"><GraduationCap size={34} className="text-brand-purple" /></span>
                <p className="font-semibold text-lg">No results yet</p>
                <p className="text-sm text-gray-400 mt-1">{isStudent ? 'Your results will show here when your teachers publish them.' : 'Results will show here when the school publishes them.'}</p>
              </div>
            ) : tab === 'card' ? (
              <>
                <ReportCard
                  student={student}
                  school={school}
                  term={termLabel(term)}
                  rows={isEditor ? termRows : termRows.filter((r) => r.published !== false)}
                  scale={scale}
                  summary={summary}
                  remarks={remarks}
                  className={className}
                  canEdit={isEditor}
                  onEditRow={(r) => setEditing(r)}
                  onEditRemarks={() => (student?.id ? setSheet('remarks') : setToast('Link this student to their account to add remarks.'))}
                />
                {isEditor && !student?.id ? <p className="text-xs text-amber-600 text-center mt-3">These marks were typed with a name only, so the student can't see them in their own account. Enter new marks with Add students to link them.</p> : null}
              </>
            ) : (
              <ProgressView rows={isEditor ? studentRows : publishedRows} scale={scale} />
            )}
          </div>
        ) : null}
      </div>

      {toast ? <div className="absolute left-1/2 -translate-x-1/2 z-30 bg-gray-900 text-white text-sm rounded-full px-4 py-2 shadow-lg max-w-[90%] text-center" style={{ bottom: 30 }}>{toast}</div> : null}

      {entry ? (
        <ResultsEntry
          schoolId={schoolId}
          user={user}
          scale={scale}
          subjects={subjects}
          classes={classes}
          defaultTerm={termName || undefined}
          defaultYear={yearOfTerm || undefined}
          onClose={() => setEntry(false)}
          onSaved={({ term: t, year: y, count, published }) => {
            setEntry(false)
            setTerm(`${y}|${t}`)
            setToast(`Saved ${count} mark${count > 1 ? 's' : ''}${published ? '' : ' (hidden until published)'}`)
            load(true)
          }}
        />
      ) : null}

      {editing ? (
        <EditResultSheet
          row={editing}
          scale={scale}
          onClose={() => setEditing(null)}
          onSaved={(r) => { setRows((prev) => prev.map((x) => (x.id === r.id ? r : x))); setEditing(null); setToast('Mark updated') }}
          onDeleted={(id) => { setRows((prev) => prev.filter((x) => x.id !== id)); setEditing(null); setToast('Mark deleted') }}
        />
      ) : null}

      {sheet === 'remarks' && student?.id ? (
        <RemarksSheet student={student} schoolId={schoolId} term={termName} year={yearOfTerm} remarks={remarks} isAdmin={isAdmin} userId={user.id} onClose={() => setSheet(null)} onSaved={(r) => { setRemarks(r); setSheet(null); setToast('Remarks saved') }} />
      ) : null}

      {sheet === 'scale' ? (
        <GradingScaleSheet scale={scale} schoolId={schoolId} onClose={() => setSheet(null)} onSaved={(s) => { setSchool((prev) => ({ ...prev, grading_scale: s })); setSheet(null); setToast('Grading scale saved') }} />
      ) : null}

      {sheet === 'menu' ? (
        <BottomSheet onClose={() => setSheet(null)}>
          <SheetAction icon={Settings2} label="Grading scale" sub="Set which marks earn which grade" onClick={() => setSheet('scale')} />
          {hiddenInTerm.length ? <SheetAction icon={Eye} label={`Publish ${hiddenInTerm.length} hidden mark${hiddenInTerm.length > 1 ? 's' : ''}`} onClick={publishTerm} /> : null}
        </BottomSheet>
      ) : null}
    </div>
  )
}

function Header({ title, onBack, right }) {
  return (
    <div className="bg-white flex items-center justify-between px-3 shrink-0 border-b border-gray-100" style={{ height: 56 }}>
      <div className="flex items-center gap-1">
        <button onClick={onBack} aria-label="Back" className="w-10 h-10 rounded-full flex items-center justify-center"><ChevronLeft size={22} /></button>
        <h1 className="font-semibold text-lg">{title}</h1>
      </div>
      <div className="flex items-center gap-1">{right}</div>
    </div>
  )
      }
