import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, ClipboardList, Loader2, Users, AlertCircle, PartyPopper } from 'lucide-react'
import ScreenHeader from '../components/ScreenHeader.jsx'
import PersonAvatar from '../components/PersonAvatar.jsx'
import HomeworkCard from '../components/HomeworkCard.jsx'
import HomeworkComposer from '../components/HomeworkComposer.jsx'
import HomeworkDetail from '../components/HomeworkDetail.jsx'
import HomeworkReview from '../components/HomeworkReview.jsx'
import { Empty, SectionTitle, Toast } from '../components/HomeworkBits.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { isSchoolMember } from '../lib/permissions.js'
import { isParentAccount } from '../lib/familyUtils.js'
import { ADMIN_ROLES, EDITOR_ROLES, byDueAsc, byDueDesc, chunk, dueOf, forClass, idOf, isDoneState, stateOf } from '../lib/homeworkUtils.js'

function Chip({ active, onClick, children }) {
  return <button onClick={onClick} className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ${active ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-600'}`}>{children}</button>
}

const asIds = (ids) => (Array.isArray(ids) ? ids.map((x) => (typeof x === 'string' ? x : Object.values(x)[0])) : [])

export default function Assignments() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { user, profile } = useAuth()

  const member = isSchoolMember(profile)
  const isStudent = member && profile?.role === 'Student'
  const isEditor = member && EDITOR_ROLES.includes(profile?.role)
  const isAdmin = member && ADMIN_ROLES.includes(profile?.role)
  const isViewer = member && !isStudent && !isEditor
  const isParent = !member && isParentAccount(profile)

  const openId = params.get('a')
  const wantedChild = params.get('child')

  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [attach, setAttach] = useState({})
  const [works, setWorks] = useState({})
  const [counts, setCounts] = useState({})
  const [children, setChildren] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [kidsReady, setKidsReady] = useState(false)
  const [classList, setClassList] = useState([])
  const [extra, setExtra] = useState(null)
  const [extraAtt, setExtraAtt] = useState([])
  const [composer, setComposer] = useState(null)
  const [tab, setTab] = useState('todo')
  const [scope, setScope] = useState('mine')
  const [classFilter, setClassFilter] = useState('')
  const [subjectFilter, setSubjectFilter] = useState('')
  const [toast, setToast] = useState('')
  const [now, setNow] = useState(new Date())
  const pushed = useRef(false)
  const reqId = useRef(0)

  const activeChild = children.find((c) => c.id === activeId) || null
  const viewer = isStudent
    ? { id: user?.id, full_name: profile?.full_name, class_name: profile?.class_name, school_id: profile?.school_id }
    : isParent ? activeChild : null
  const schoolId = member ? profile?.school_id : activeChild?.school_id

  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(''), 2600)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(t)
  }, [])

  // ---------- Parents: which children ----------
  useEffect(() => {
    if (!user || !profile || !isParent) { setKidsReady(true); return undefined }
    let cancelled = false
    ;(async () => {
      const { data: ids } = await supabase.rpc('my_children')
      const list = asIds(ids)
      if (list.length) {
        const { data: kids } = await supabase.from('profiles').select('id, full_name, avatar_url, school_id, class_name').in('id', list)
        if (cancelled) return
        const ordered = list.map((id) => (kids ?? []).find((k) => k.id === id)).filter(Boolean)
        setChildren(ordered)
        setActiveId((ordered.find((k) => k.id === wantedChild) || ordered[0])?.id || null)
      }
      if (!cancelled) setKidsReady(true)
    })()
    return () => { cancelled = true }
  }, [user?.id, profile?.id, profile?.account_type, profile?.role])

  // ---------- Loading ----------
  async function loadWork(studentId) {
    const { data } = await supabase.rpc('hw_work', { p_student: studentId })
    const map = {}
    ;(Array.isArray(data) ? data : []).forEach((w) => { map[String(w.assignment_id)] = w })
    setWorks(map)
  }

  async function loadAll() {
    const mine = ++reqId.current
    if (!schoolId) { setItems([]); setLoading(false); return }
    const { data } = await supabase.from('assignments').select('*').eq('school_id', schoolId).order('created_at', { ascending: false }).limit(200)
    const list = data ?? []

    const parts = await Promise.all(chunk(list.map((x) => x.id), 40).map((ids) => supabase.from('assignment_attachments').select('*').in('assignment_id', ids)))
    const grouped = {}
    parts.forEach((p) => (p.data ?? []).forEach((att) => {
      const k = String(att.assignment_id)
      if (!grouped[k]) grouped[k] = []
      grouped[k].push(att)
    }))

    let workMap = {}
    if (viewer?.id) {
      const { data: w } = await supabase.rpc('hw_work', { p_student: viewer.id })
      ;(Array.isArray(w) ? w : []).forEach((x) => { workMap[String(x.assignment_id)] = x })
    }
    let countMap = {}
    if (isEditor) {
      const { data: c } = await supabase.rpc('hw_counts')
      ;(Array.isArray(c) ? c : []).forEach((x) => { countMap[String(x.assignment_id)] = x })
    }
    if (mine !== reqId.current) return
    setItems(list)
    setAttach(grouped)
    setWorks(workMap)
    setCounts(countMap)
    setLoading(false)
  }

  useEffect(() => {
    if (!user || !profile) return undefined
    if (isParent && !kidsReady) return undefined
    setLoading(true)
    loadAll()
    if (!schoolId) return undefined
    let timer = null
    const refresh = () => { clearTimeout(timer); timer = setTimeout(loadAll, 500) }
    let ch = supabase.channel(`homework-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments', filter: `school_id=eq.${schoolId}` }, refresh)
    if (isEditor) ch = ch.on('postgres_changes', { event: '*', schema: 'public', table: 'assignment_submissions', filter: `school_id=eq.${schoolId}` }, refresh)
    else if (viewer?.id) ch = ch.on('postgres_changes', { event: '*', schema: 'public', table: 'assignment_submissions', filter: `student_id=eq.${viewer.id}` }, refresh)
    ch.subscribe()
    return () => { clearTimeout(timer); supabase.removeChannel(ch) }
  }, [user?.id, profile?.id, schoolId, viewer?.id, isEditor, kidsReady])

  // Teachers: the classes in the school
  useEffect(() => {
    if (!isEditor || !schoolId) return
    supabase.from('profiles').select('class_name').eq('school_id', schoolId).eq('role', 'Student').limit(3000).then(({ data }) => {
      setClassList([...new Set((data ?? []).map((r) => (r.class_name || '').trim()).filter(Boolean))].sort())
    })
  }, [isEditor, schoolId])

  // An assignment opened from a notification may not be in the list
  const fromList = openId ? items.find((x) => idOf(x) === openId) : null
  useEffect(() => {
    setExtra(null)
    setExtraAtt([])
    if (!openId || loading || fromList) return
    let cancelled = false
    ;(async () => {
      const { data: row } = await supabase.from('assignments').select('*').eq('id', openId).maybeSingle()
      if (cancelled) return
      if (!row) { setToast('That assignment is no longer available'); closeDetail(); return }
      const { data: att } = await supabase.from('assignment_attachments').select('*').eq('assignment_id', row.id)
      if (cancelled) return
      setExtra(row)
      setExtraAtt(att ?? [])
    })()
    return () => { cancelled = true }
  }, [openId, loading, !!fromList])

  const openA = fromList || (extra && idOf(extra) === openId ? extra : null)
  const openAtt = fromList ? attach[idOf(fromList)] || [] : extraAtt

  function openDetail(a) {
    pushed.current = true
    const next = { a: idOf(a) }
    if (isParent && activeId) next.child = activeId
    setParams(next)
  }

  function closeDetail() {
    if (pushed.current) { pushed.current = false; navigate(-1) } else setParams(isParent && activeId ? { child: activeId } : {}, { replace: true })
  }

  async function removeAssignment() {
    const a = openA
    await supabase.from('assignment_attachments').delete().eq('assignment_id', a.id)
    const { error } = await supabase.from('assignments').delete().eq('id', a.id)
    if (error) return false
    setToast('Assignment deleted')
    closeDetail()
    loadAll()
    return true
  }

  // ---------- What is on screen ----------
  const subjects = useMemo(() => [...new Set(items.filter((a) => !viewer || forClass(a, viewer.class_name)).map((x) => (x.subject || '').trim()).filter(Boolean))].sort(), [items, viewer?.class_name])

  const visible = useMemo(() => {
    let list = items
    if (viewer) list = list.filter((a) => forClass(a, viewer.class_name))
    if (isEditor && scope === 'mine') list = list.filter((a) => String(a.created_by) === String(user?.id))
    if (isEditor && classFilter) list = list.filter((a) => (a.class_name || '') === classFilter)
    if (subjectFilter) list = list.filter((a) => (a.subject || '').trim() === subjectFilter)
    return list
  }, [items, viewer?.class_name, isEditor, scope, classFilter, subjectFilter, user?.id])

  const decorated = useMemo(() => visible.map((a) => ({ a, work: works[idOf(a)], state: stateOf(a, works[idOf(a)], now) })), [visible, works, now])
  const missing = decorated.filter((d) => d.state.key === 'missing').sort((x, y) => byDueDesc(x.a, y.a))
  const todo = decorated.filter((d) => ['todo', 'soon', 'draft', 'info'].includes(d.state.key)).sort((x, y) => byDueAsc(x.a, y.a))
  const done = decorated.filter((d) => isDoneState(d.state)).sort((x, y) => new Date(y.work?.submitted_at || y.a.created_at) - new Date(x.work?.submitted_at || x.a.created_at))

  const open = visible.filter((a) => { const d = dueOf(a); return !d || d >= now }).sort(byDueAsc)
  const past = visible.filter((a) => { const d = dueOf(a); return d && d < now }).sort(byDueDesc)

  const teacherSide = isEditor || isViewer
  const classChoices = [...new Set([...classList, ...items.map((x) => x.class_name).filter(Boolean)])].sort()
  const canEditOpen = openA && (isAdmin || String(openA.created_by) === String(user?.id))

  // ---------- Screens ----------
  if (!user || !profile) return <div className="app-shell" />

  if (!member && !isParent) {
    return (
      <div className="app-shell">
        <ScreenHeader title="Homework" onBack={() => navigate(-1)} />
        <Empty icon={ClipboardList} title="Homework is for school accounts" text="Students, parents and teachers see assignments here." />
      </div>
    )
  }

  if (isParent && kidsReady && children.length === 0) {
    return (
      <div className="app-shell">
        <ScreenHeader title="Homework" onBack={() => navigate(-1)} />
        <Empty icon={Users} title="No child linked yet" text="Link your child to see their homework." action="Add a child" onAction={() => navigate('/family')} />
      </div>
    )
  }

  if (loading && !openA) return <div className="app-shell items-center justify-center flex text-gray-400"><Loader2 className="animate-spin" /></div>

  const composerEl = composer ? (
    <HomeworkComposer
      assignment={composer.edit || null}
      attachments={composer.edit ? attach[idOf(composer.edit)] || [] : []}
      schoolId={schoolId}
      user={user}
      profile={profile}
      classes={classChoices}
      subjects={subjects}
      onClose={() => setComposer(null)}
      onSaved={({ isNew, failed }) => {
        setComposer(null)
        setToast(failed.length ? `Saved, but ${failed.length} file${failed.length > 1 ? 's' : ''} did not upload` : isNew ? 'Assignment posted' : 'Changes saved')
        loadAll()
      }}
    />
  ) : null

  if (openA) {
    if (teacherSide) {
      return (
        <>
          <HomeworkReview
            key={idOf(openA)}
            a={openA}
            attachments={openAtt}
            canGrade={isEditor}
            canEdit={!!canEditOpen && isEditor}
            now={now}
            onBack={closeDetail}
            onEdit={() => setComposer({ edit: openA })}
            onDelete={removeAssignment}
            onChanged={loadAll}
          />
          {composerEl}
        </>
      )
    }
    return (
      <HomeworkDetail
        key={`${idOf(openA)}-${viewer?.id}`}
        a={openA}
        attachments={openAtt}
        work={works[idOf(openA)] || null}
        mode={isStudent ? 'student' : 'parent'}
        child={viewer}
        user={user}
        now={now}
        onBack={closeDetail}
        onReload={() => loadWork(viewer.id)}
      />
    )
  }

  const subTitle = isParent ? activeChild?.full_name : isStudent && profile?.class_name ? `Class ${profile.class_name}` : ''
  const shown = tab === 'todo' ? missing.length + todo.length : done.length

  return (
    <div className="app-shell relative">
      <ScreenHeader
        title="Homework"
        sub={subTitle}
        onBack={() => navigate(-1)}
        right={isEditor ? <button onClick={() => setComposer({})} aria-label="New assignment" className="w-10 h-10 rounded-full bg-brand-purple text-white flex items-center justify-center"><Plus size={20} /></button> : null}
      />

      <div className="flex-1 overflow-y-auto" style={{ paddingBottom: 40 }}>
        {isParent && children.length > 1 ? (
          <div className="flex gap-2 overflow-x-auto px-4 pt-3" style={{ scrollbarWidth: 'none' }}>
            {children.map((c) => (
              <button key={c.id} onClick={() => { setActiveId(c.id); setSubjectFilter('') }} className={`shrink-0 flex items-center gap-2 rounded-full pl-1.5 pr-4 py-1.5 ${activeId === c.id ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-700'}`}>
                <PersonAvatar p={c} size={28} /><span className="text-sm font-medium">{c.full_name?.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        ) : null}

        {/* Teachers and staff */}
        {teacherSide ? (
          <div className="px-4">
            {isEditor ? (
              <div className="flex gap-2 overflow-x-auto pt-3" style={{ scrollbarWidth: 'none' }}>
                <Chip active={scope === 'mine'} onClick={() => setScope('mine')}>Mine</Chip>
                <Chip active={scope === 'all'} onClick={() => setScope('all')}>Everyone's</Chip>
                {classChoices.length > 0 ? <span className="w-px bg-gray-200 shrink-0 my-1" /> : null}
                {classChoices.map((c) => <Chip key={c} active={classFilter === c} onClick={() => setClassFilter(classFilter === c ? '' : c)}>{c}</Chip>)}
              </div>
            ) : null}

            {visible.length === 0 ? (
              <Empty
                icon={ClipboardList}
                title={items.length ? 'Nothing here' : 'No assignments yet'}
                text={isEditor ? (items.length ? 'Try another filter, or post something new.' : 'Post homework once and students and parents are told straight away.') : 'Assignments from teachers will show here.'}
                action={isEditor ? 'New assignment' : undefined}
                onAction={() => setComposer({})}
              />
            ) : (
              <>
                {open.length > 0 ? <SectionTitle count={open.length}>Open</SectionTitle> : null}
                <div className="space-y-3">
                  {open.map((a) => <HomeworkCard key={idOf(a)} a={a} teacher counts={counts[idOf(a)]} files={(attach[idOf(a)] || []).length} now={now} onClick={() => openDetail(a)} />)}
                </div>
                {past.length > 0 ? <SectionTitle count={past.length}>Past due</SectionTitle> : null}
                <div className="space-y-3">
                  {past.map((a) => <HomeworkCard key={idOf(a)} a={a} teacher counts={counts[idOf(a)]} files={(attach[idOf(a)] || []).length} now={now} onClick={() => openDetail(a)} />)}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="px-4">
            <div className="flex bg-gray-100 rounded-full p-1 mt-3">
              {[['todo', `To do${missing.length + todo.length ? ` · ${missing.length + todo.length}` : ''}`], ['done', `Done${done.length ? ` · ${done.length}` : ''}`]].map(([k, label]) => (
                <button key={k} onClick={() => setTab(k)} className={`flex-1 py-2 text-sm font-semibold rounded-full ${tab === k ? 'bg-white shadow-sm text-brand-purple' : 'text-gray-500'}`}>{label}</button>
              ))}
            </div>

            {subjects.length > 1 ? (
              <div className="flex gap-2 overflow-x-auto pt-3" style={{ scrollbarWidth: 'none' }}>
                <Chip active={!subjectFilter} onClick={() => setSubjectFilter('')}>All subjects</Chip>
                {subjects.map((s) => <Chip key={s} active={subjectFilter === s} onClick={() => setSubjectFilter(subjectFilter === s ? '' : s)}>{s}</Chip>)}
              </div>
            ) : null}

            {tab === 'todo' && missing.length > 0 ? (
              <>
                <SectionTitle count={missing.length} tone="text-red-500">Missing</SectionTitle>
                <div className="space-y-3">
                  {missing.map((d) => <HomeworkCard key={idOf(d.a)} a={d.a} state={d.state} files={(attach[idOf(d.a)] || []).length} now={now} onClick={() => openDetail(d.a)} />)}
                </div>
              </>
            ) : null}

            {tab === 'todo' && todo.length > 0 ? (
              <>
                <SectionTitle count={todo.length}>{missing.length ? 'Coming up' : 'To do'}</SectionTitle>
                <div className="space-y-3">
                  {todo.map((d) => <HomeworkCard key={idOf(d.a)} a={d.a} state={d.state} files={(attach[idOf(d.a)] || []).length} now={now} onClick={() => openDetail(d.a)} />)}
                </div>
              </>
            ) : null}

            {tab === 'done' && done.length > 0 ? (
              <div className="space-y-3 pt-4">
                {done.map((d) => <HomeworkCard key={idOf(d.a)} a={d.a} state={d.state} files={(attach[idOf(d.a)] || []).length} now={now} onClick={() => openDetail(d.a)} />)}
              </div>
            ) : null}

            {shown === 0 ? (
              tab === 'todo'
                ? <Empty icon={PartyPopper} title={items.length ? 'All caught up' : 'No homework yet'} text={items.length ? 'Nothing is waiting. Enjoy your free time.' : 'Homework from your teachers will show here.'} />
                : <Empty icon={AlertCircle} title="Nothing finished yet" text="Work that is handed in or marked shows here." />
            ) : null}
          </div>
        )}
      </div>

      {composerEl}
      <Toast text={toast} />
    </div>
  )
          }
