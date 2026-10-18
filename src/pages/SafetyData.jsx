import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Share2, ShieldCheck, Gauge, FileText, Lock, Ban, Clock, Loader2, Check, ChevronRight, Scale } from 'lucide-react'
import ScreenHeader from '../components/ScreenHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { buildExport, saveFile, sizeText } from '../lib/dataExport.js'

const TABLE_NAMES = { posts: 'Posts', comments: 'Comments', messages: 'Chat messages', community_messages: 'Community messages', statuses: 'Statuses', content_reports: 'Reports' }

function windowText(s) {
  if (s % 86400 === 0) return s === 86400 ? 'a day' : `${s / 86400} days`
  if (s % 3600 === 0) return s === 3600 ? 'an hour' : `${s / 3600} hours`
  if (s % 60 === 0) return s === 60 ? 'a minute' : `${s / 60} minutes`
  return `${s} seconds`
}

function Card({ icon: Icon, title, children, tone = 'bg-brand-light text-brand-purple' }) {
  return (
    <section className="rounded-2xl border border-gray-100 p-4 mt-4">
      <div className="flex items-center gap-3">
        <span className={`w-9 h-9 rounded-full flex items-center justify-center ${tone}`}><Icon size={17} /></span>
        <h2 className="font-semibold text-[15px]">{title}</h2>
      </div>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Row({ icon: Icon, label, sub, onClick, badge }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 py-3 text-left">
      <Icon size={18} className="text-gray-500 shrink-0" />
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-medium">{label}</span>
        {sub ? <span className="block text-xs text-gray-400">{sub}</span> : null}
      </span>
      {badge ? <span className="bg-brand-purple text-white text-xs font-semibold rounded-full px-2 py-0.5">{badge}</span> : null}
      <ChevronRight size={16} className="text-gray-300" />
    </button>
  )
}

export default function SafetyData() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const isGuest = !user || user.is_anonymous || profile?.account_type === 'guest'

  const [limits, setLimits] = useState([])
  const [pendingAppeals, setPendingAppeals] = useState(null)
  const [phase, setPhase] = useState('idle')
  const [plan, setPlan] = useState([])
  const [progress, setProgress] = useState({})
  const [current, setCurrent] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const alive = useRef(true)

  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])

  useEffect(() => {
    supabase.from('rate_limits').select('table_name, window_seconds, max_count').order('window_seconds').then(({ data }) => setLimits(data ?? []))
    if (!isGuest) {
      supabase.rpc('list_appeals', { p_status: 'pending' }).then(({ data }) => setPendingAppeals(data?.ok ? (data.items ?? []).length : null))
    }
  }, [isGuest])

  async function start() {
    setPhase('working')
    setError('')
    setNote('')
    setResult(null)
    setProgress({})
    try {
      const res = await buildExport({
        user,
        onStep: (e) => {
          if (!alive.current) return
          if (e.type === 'plan') setPlan(e.sections)
          if (e.type === 'start') setCurrent(e.key)
          if (e.type === 'progress' || e.type === 'done') setProgress((p) => ({ ...p, [e.key]: { done: e.done, finished: e.type === 'done' } }))
        },
      })
      if (!alive.current) return
      setResult(res)
      setPhase('ready')
    } catch (e) {
      if (!alive.current) return
      setError(e.message || 'Something went wrong. Try again.')
      setPhase('idle')
    }
  }

  async function save() {
    const how = await saveFile(result.blob, result.name)
    if (how === 'downloaded') setNote('Saved to your downloads.')
    else if (how === 'shared') setNote('Done.')
  }

  const doneCount = plan.filter((s) => progress[s.key]?.finished).length
  const pct = plan.length ? Math.round((doneCount / plan.length) * 100) : 0

  const byTable = {}
  limits.forEach((l) => { (byTable[l.table_name] ||= []).push(l) })

  return (
    <div className="app-shell">
      <ScreenHeader title="Safety and data" onBack={() => navigate(-1)} />
      <div className="screen-scroll px-4 pb-12">
        <Card icon={Download} title="Download your data">
          <p className="text-sm text-gray-600 leading-snug">Get a copy of what you have on Schoolink: your profile, posts, comments, statuses, chats, saved items, follows, communities, notifications, login history, reports and appeals.</p>
          <p className="text-xs text-gray-400 mt-2 leading-snug">Photos and videos are included as links. Marks, report cards, fees and counselling records belong to your school and are not in the file.</p>

          {isGuest ? (
            <p className="text-sm text-gray-500 bg-gray-50 rounded-xl p-3 mt-3">Guests have no saved data. Create an account to use this.</p>
          ) : null}

          {!isGuest && phase === 'idle' ? (
            <>
              {error ? <p className="text-sm text-red-500 mt-3">{error}</p> : null}
              <button onClick={start} className="w-full mt-4 bg-brand-purple text-white font-semibold py-3.5 rounded-full flex items-center justify-center gap-2"><Download size={18} /> Download my data</button>
            </>
          ) : null}

          {phase === 'working' ? (
            <div className="mt-4">
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden"><div className="h-full bg-brand-purple transition-all" style={{ width: `${Math.max(6, pct)}%` }} /></div>
              <p className="text-xs text-gray-400 mt-2">{plan.length ? `Collecting your data… ${doneCount} of ${plan.length}` : 'Starting…'}</p>
              <ul className="mt-2 space-y-1.5">
                {plan.map((s) => {
                  const p = progress[s.key]
                  return (
                    <li key={s.key} className="flex items-center gap-2 text-sm">
                      <span className="w-5 flex justify-center">
                        {p?.finished ? <Check size={15} className="text-emerald-600" /> : current === s.key ? <Loader2 size={14} className="animate-spin text-brand-purple" /> : <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />}
                      </span>
                      <span className={p?.finished ? 'text-gray-700' : 'text-gray-400'}>{s.label}</span>
                      <span className="ml-auto text-xs text-gray-400">{p ? p.done : s.count}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}

          {phase === 'ready' && result ? (
            <div className="mt-4">
              <div className="rounded-xl bg-emerald-50 p-3 flex items-center gap-3">
                <FileText size={22} className="text-emerald-700 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-emerald-800 truncate">{result.name}</p>
                  <p className="text-xs text-emerald-700">{sizeText(result.size)} · {result.counts.reduce((n, c) => n + c.count, 0)} items</p>
                </div>
              </div>
              <button onClick={save} className="w-full mt-3 bg-brand-purple text-white font-semibold py-3.5 rounded-full flex items-center justify-center gap-2">
                {navigator.canShare ? <Share2 size={18} /> : <Download size={18} />} Save the file
              </button>
              {note ? <p className="text-xs text-emerald-600 text-center mt-2">{note}</p> : null}
              <p className="text-xs text-gray-400 mt-3 leading-snug flex gap-2"><Lock size={13} className="shrink-0 mt-0.5" /> This file was made on your phone and is not stored by Schoolink. Anyone who has it can read your chats, so keep it safe.</p>
              <button onClick={() => { setPhase('idle'); setResult(null) }} className="w-full mt-2 py-2 text-sm text-gray-500">Done</button>
            </div>
          ) : null}
        </Card>

        <Card icon={Gauge} title="Slow-down limits" tone="bg-amber-50 text-amber-600">
          <p className="text-sm text-gray-600 leading-snug">To stop spam, there is a limit on how fast one account can post. If you reach one, wait a moment and carry on. Normal use never gets near them.</p>
          {Object.keys(byTable).length ? (
            <ul className="mt-3 divide-y divide-gray-50">
              {Object.entries(byTable).map(([table, rows]) => (
                <li key={table} className="flex items-start justify-between gap-3 py-2.5">
                  <span className="text-sm font-medium">{TABLE_NAMES[table] || table}</span>
                  <span className="text-xs text-gray-500 text-right leading-snug">{rows.map((r) => `${r.max_count} per ${windowText(r.window_seconds)}`).join(' · ')}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>

        <Card icon={ShieldCheck} title="Your safety" tone="bg-emerald-50 text-emerald-600">
          <div className="-my-1 divide-y divide-gray-50">
            <Row icon={Ban} label="Blocked people" sub="People you have blocked" onClick={() => navigate('/settings/blocked-users')} />
            <Row icon={Clock} label="Login history" sub="Where and when you signed in" onClick={() => navigate('/settings/login-history')} />
            {pendingAppeals !== null ? <Row icon={ShieldCheck} label="Review ban appeals" sub="For moderators" badge={pendingAppeals || null} onClick={() => navigate('/appeals')} /> : null}
          </div>
        </Card>

        <Card icon={Scale} title="The rules" tone="bg-gray-100 text-gray-600">
          <div className="-my-1 divide-y divide-gray-50">
            <Row icon={FileText} label="Terms of Service" onClick={() => navigate('/terms')} />
            <Row icon={Lock} label="Privacy Policy" onClick={() => navigate('/privacy')} />
          </div>
        </Card>
      </div>
    </div>
  )
}
