import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AlertCircle, Check, Loader2, Lock, Search, Send, Share2, Unlock, X } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { containsProfanity } from '../lib/moderation.js'
import { canManageSchoolChat, displayName, fetchPeople, learnerDetail } from '../lib/schoolChat.js'

const ACCENT = '#6C4CE0'

function Page({ title, children }) {
  return (
    <div className="app-shell">
      <BackHeader title={title} />
      {children}
    </div>
  )
}

// Pick a staff member to refer the conversation to.
function ReferSheet({ schoolId, currentAssignee, busy, onPick, onClose }) {
  const [staff, setStaff] = useState([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('school_id', schoolId)
      .eq('status', 'active')
      .neq('role', 'Student')
      .order('full_name')
      .then(({ data }) => setStaff(data ?? []))
  }, [schoolId])

  const q = query.trim().toLowerCase()
  const shown = staff.filter((s) => (s.full_name || '').toLowerCase().includes(q))

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={() => !busy && onClose()}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[520px] bg-white rounded-t-3xl px-5 pt-3 pb-8 max-h-[85dvh] flex flex-col">
        <span className="block w-10 h-1.5 rounded-full bg-gray-200 mx-auto mb-4" />
        <div className="flex items-center justify-between">
          <p className="text-[18px] font-semibold text-brand-navy">Refer to</p>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
            <X size={18} />
          </button>
        </div>
        <div className="relative mt-4">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search staff"
            className="w-full rounded-xl border border-gray-200 pl-10 pr-4 py-3 text-[14px] outline-none"
          />
        </div>
        <ul className="mt-3 overflow-y-auto divide-y divide-gray-100">
          <li>
            <button type="button" disabled={busy} onClick={() => onPick(null)} className="w-full flex items-center gap-3 py-3 text-left">
              <span className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-[12px] font-semibold text-gray-600">SC</span>
              <span className="flex-1">
                <span className="block text-[14px] font-medium text-brand-navy">The school chat managers</span>
                <span className="block text-[12px] text-gray-500">Move it back to the queue</span>
              </span>
              {!currentAssignee ? <Check size={18} style={{ color: ACCENT }} /> : null}
            </button>
          </li>
          {shown.map((s) => (
            <li key={s.id}>
              <button type="button" disabled={busy} onClick={() => onPick(s.id)} className="w-full flex items-center gap-3 py-3 text-left">
                <span className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-semibold" style={{ background: '#EFEBFF', color: ACCENT }}>
                  {(s.full_name || '?').trim().slice(0, 1).toUpperCase()}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[14px] font-medium truncate text-brand-navy">{displayName(s)}</span>
                  <span className="block text-[12px] text-gray-500">{s.role}</span>
                </span>
                {currentAssignee === s.id ? <Check size={18} style={{ color: ACCENT }} /> : null}
              </button>
            </li>
          ))}
        </ul>
        {shown.length === 0 ? <p className="text-center text-gray-400 text-[14px] py-8">No staff found.</p> : null}
        {busy ? <p className="text-center text-[13px] text-gray-500 mt-3 flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /> Referring…</p> : null}
      </div>
    </div>
  )
}

export default function SchoolChatThread() {
  const { threadId } = useParams()
  const { user, profile } = useAuth()
  const [thread, setThread] = useState(null)
  const [school, setSchool] = useState(null)
  const [people, setPeople] = useState({})
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [referOpen, setReferOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const endRef = useRef(null)

  const manager = !!thread && canManageSchoolChat(profile) && profile?.school_id === thread.school_id
  const isRequester = !!thread && thread.requester_id === user?.id
  const isAssignee = !!thread && thread.assigned_to === user?.id
  const canRefer = manager || isAssignee
  const closed = thread?.status === 'closed'
  const requester = thread ? people[thread.requester_id] : null
  const assignee = thread?.assigned_to ? people[thread.assigned_to] : null

  async function loadAll() {
    const { data: t, error: tErr } = await supabase.from('school_chat_threads').select('*').eq('id', threadId).maybeSingle()
    if (tErr || !t) {
      setMissing(true)
      setLoading(false)
      return
    }
    setThread(t)
    const [{ data: s }, { data: msgs }] = await Promise.all([
      supabase.from('schools').select('id, name, logo_url').eq('id', t.school_id).maybeSingle(),
      supabase.from('school_chat_messages').select('*').eq('thread_id', threadId).order('created_at', { ascending: true }).limit(500),
    ])
    setSchool(s ?? null)
    setMessages(msgs ?? [])
    const map = await fetchPeople([t.requester_id, t.assigned_to, ...(msgs ?? []).map((m) => m.sender_id)])
    setPeople((prev) => ({ ...prev, ...map }))
    setLoading(false)
  }

  useEffect(() => {
    loadAll()
  }, [threadId])

  // Live: new messages, and changes to who it is with or whether it is open.
  useEffect(() => {
    const channel = supabase
      .channel(`school-chat-thread-${threadId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'school_chat_messages', filter: `thread_id=eq.${threadId}` }, (payload) => {
        const row = payload.new
        setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]))
        if (row.sender_id) fetchPeople([row.sender_id]).then((map) => setPeople((prev) => ({ ...prev, ...map })))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'school_chat_threads', filter: `id=eq.${threadId}` }, () => {
        loadAll()
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [threadId])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  async function send() {
    const body = text.trim()
    if (!body || sending || !thread || closed) return
    if (containsProfanity(body)) {
      setError("This contains language that isn't allowed on Schoolink. Please edit it and try again.")
      return
    }
    setSending(true)
    setError('')
    const { data, error: err } = await supabase
      .from('school_chat_messages')
      .insert({ thread_id: threadId, sender_id: user.id, kind: 'text', body })
      .select()
      .single()
    setSending(false)
    if (err || !data) {
      setError(closed ? 'This conversation is closed.' : "Couldn't send. Try again.")
      return
    }
    setText('')
    setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]))
  }

  async function refer(toId) {
    if (busy) return
    setBusy(true)
    setError('')
    const { data, error: err } = await supabase.rpc('refer_school_chat', { p_thread: threadId, p_to: toId ?? null })
    setBusy(false)
    if (err || !data?.ok) {
      setError(data?.error || "Couldn't refer. Try again.")
      return
    }
    setReferOpen(false)
    loadAll()
  }

  async function setOpenState(nextStatus) {
    if (busy) return
    setBusy(true)
    setError('')
    const { error: err } = await supabase.from('school_chat_threads').update({ status: nextStatus }).eq('id', threadId)
    setBusy(false)
    if (err) {
      setError("Couldn't update. Try again.")
      return
    }
    loadAll()
  }

  if (loading) {
    return (
      <Page title="Conversation">
        <div className="screen-scroll flex items-center justify-center">
          <Loader2 className="animate-spin text-brand-purple" />
        </div>
      </Page>
    )
  }

  if (missing) {
    return (
      <Page title="Conversation">
        <div className="screen-scroll flex items-center justify-center px-6 text-center text-gray-500">
          This conversation isn't available to you.
        </div>
      </Page>
    )
  }

  const title = isRequester ? school?.name || 'School chat' : displayName(requester)
  const subtitle = isRequester
    ? assignee ? `With ${displayName(assignee)}` : 'The school chat managers will reply here'
    : [learnerDetail(requester), assignee ? `With ${displayName(assignee)}` : 'Unassigned'].filter(Boolean).join(' · ')

  return (
    <div className="app-shell">
      <BackHeader title={title} />

      <div className="px-4 py-2.5 flex items-center justify-between gap-3 border-b border-gray-100 bg-white">
        <p className="text-[12.5px] text-gray-500 truncate">{subtitle}</p>
        {!isRequester && canRefer ? (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setReferOpen(true)}
              disabled={busy}
              className="h-8 px-3 rounded-full border border-gray-200 text-[12.5px] font-semibold flex items-center gap-1.5 text-brand-navy disabled:opacity-50"
            >
              <Share2 size={13} /> Refer
            </button>
            {manager ? (
              <button
                type="button"
                onClick={() => setOpenState(closed ? 'open' : 'closed')}
                disabled={busy}
                className="h-8 px-3 rounded-full text-[12.5px] font-semibold flex items-center gap-1.5 disabled:opacity-50"
                style={{ background: closed ? '#EFEBFF' : '#F3F4F6', color: closed ? ACCENT : '#374151' }}
              >
                {closed ? <Unlock size={13} /> : <Lock size={13} />} {closed ? 'Reopen' : 'Close'}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="screen-scroll px-4 py-4" style={{ background: '#F6F4FF' }}>
        {messages.length === 0 ? (
          <p className="text-center text-gray-400 text-[14px] py-12">Say hello. The school will reply here.</p>
        ) : null}
        <div className="space-y-2">
          {messages.map((m, i) => {
            if (m.kind === 'system') {
              return <p key={m.id} className="text-center text-[12px] text-gray-500 py-2">{m.body}</p>
            }
            const mine = m.sender_id === user.id
            const prev = messages[i - 1]
            const showName = !mine && (!prev || prev.sender_id !== m.sender_id || prev.kind === 'system')
            return (
              <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                {showName ? <span className="text-[11px] text-gray-500 mb-1 px-1">{displayName(people[m.sender_id])}</span> : null}
                <div
                  className="max-w-[78%] rounded-2xl px-3.5 py-2.5 text-[15px] leading-snug whitespace-pre-wrap break-words"
                  style={mine
                    ? { background: ACCENT, color: '#FFFFFF', borderBottomRightRadius: 6 }
                    : { background: '#FFFFFF', color: '#1B1450', border: '1px solid #ECE9F6', borderBottomLeftRadius: 6 }}
                >
                  {m.body}
                </div>
                <span className="text-[10.5px] text-gray-400 mt-1 px-1">
                  {new Date(m.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </span>
              </div>
            )
          })}
        </div>
        <div ref={endRef} />
      </div>

      <div className="px-3 pt-2 border-t border-gray-100 bg-white" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        {error ? (
          <p className="text-[13px] text-red-500 px-1 pb-2 flex items-center gap-1.5"><AlertCircle size={14} /> {error}</p>
        ) : null}
        {closed ? (
          <p className="text-center text-[13px] text-gray-500 py-3">
            This conversation is closed.{manager ? ' Reopen it to reply.' : ''}
          </p>
        ) : (
          <div className="flex items-end gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={1}
              maxLength={2000}
              placeholder={isRequester ? 'Message the school…' : 'Reply…'}
              className="flex-1 min-w-0 resize-none rounded-2xl border border-gray-200 px-4 py-2.5 text-[15px] outline-none max-h-32"
            />
            <button
              type="button"
              onClick={send}
              disabled={!text.trim() || sending}
              aria-label="Send"
              className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 disabled:opacity-40"
              style={{ background: ACCENT, color: '#FFFFFF' }}
            >
              {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>
        )}
      </div>

      {referOpen ? (
        <ReferSheet
          schoolId={thread.school_id}
          currentAssignee={thread.assigned_to}
          busy={busy}
          onPick={refer}
          onClose={() => setReferOpen(false)}
        />
      ) : null}
    </div>
  )
}
