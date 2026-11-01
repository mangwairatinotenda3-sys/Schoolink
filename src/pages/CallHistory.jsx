import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Phone, Video, PhoneOutgoing, PhoneIncoming, PhoneMissed, Plus, MoreVertical, Trash2 } from 'lucide-react'
import BottomSheet, { SheetAction } from '../components/BottomSheet.jsx'
import { ContactPicker } from '../components/CallOverlay.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useCalls } from '../context/CallContext.jsx'

function timeLabel(dateString) {
  if (!dateString) return ''
  const d = new Date(dateString)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const days = Math.floor((startOfToday - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000)
  if (days <= 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (days === 1) return 'Yesterday'
  if (days < 7) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function durationLabel(seconds) {
  if (seconds == null) return ''
  const s = Math.max(0, Math.round(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

async function loadHistory(uid) {
  const { data: mine, error } = await supabase
    .from('call_participants')
    .select('call_id, role, status, invited_at, calls!inner(id, kind, created_at, answered_at, ended_at, status)')
    .eq('user_id', uid)
    .order('invited_at', { ascending: false })
    .limit(150)
  if (error) throw error
  const rows = (mine ?? []).filter((r) => r.calls)
  if (!rows.length) return []

  const callIds = rows.map((r) => r.call_id)
  const [{ data: hidden }, { data: everyone }] = await Promise.all([
    supabase.from('call_history_hidden').select('call_id').eq('user_id', uid).in('call_id', callIds),
    supabase.from('call_participants').select('call_id, user_id, role, status').in('call_id', callIds),
  ])
  const hiddenSet = new Set((hidden ?? []).map((h) => h.call_id))
  const memberIds = [...new Set((everyone ?? []).map((e) => e.user_id))]
  const { data: profiles } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', memberIds)
  const people = Object.fromEntries((profiles ?? []).map((p) => [
    p.id, { id: p.id, name: p.full_name || 'Schoolink member', avatar: p.avatar_url || null },
  ]))

  const byCall = {}
  for (const e of everyone ?? []) (byCall[e.call_id] ||= []).push(e)

  return rows
    .filter((r) => !hiddenSet.has(r.call_id))
    .map((r) => {
      const call = r.calls
      const members = byCall[r.call_id] ?? []
      const peers = [...new Map(members.filter((m) => m.user_id !== uid).map((m) => [m.user_id, m])).values()]
        .map((m) => people[m.user_id])
        .filter(Boolean)
      const outgoing = r.role === 'caller'
      const answered = call.answered_at != null

      let label
      let tone
      if (outgoing) {
        label = answered ? 'Answered' : 'No answer'
        tone = 'out'
      } else if (r.status === 'joined' || r.status === 'left') {
        label = 'Answered'
        tone = 'in'
      } else if (r.status === 'declined') {
        label = 'Declined'
        tone = 'missed'
      } else {
        label = 'Missed'
        tone = 'missed'
      }

      const seconds = call.answered_at && call.ended_at
        ? (Date.parse(call.ended_at) - Date.parse(call.answered_at)) / 1000
        : null

      const names = peers.map((p) => p.name)
      const title = peers.length === 1
        ? peers[0].name
        : peers.length
          ? `${names.slice(0, 2).join(', ')}${peers.length > 2 ? ` +${peers.length - 2}` : ''}`
          : 'Call'

      return {
        id: r.call_id,
        kind: call.kind,
        at: call.created_at,
        outgoing,
        tone,
        label,
        seconds,
        title,
        group: peers.length > 1,
        peerIds: peers.map((p) => p.id),
        avatar: peers.length === 1 ? peers[0].avatar : null,
        initial: (peers[0]?.name || '?').charAt(0).toUpperCase(),
      }
    })
}

export default function CallHistory() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { startCall } = useCalls()
  const uid = user?.id
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('all')
  const [newOpen, setNewOpen] = useState(false)
  const [kind, setKind] = useState('video')
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setItems(await loadHistory(uid))
      setError('')
    } catch {
      setError('Could not load your calls.')
    }
  }, [uid])

  useEffect(() => { if (uid) refresh() }, [uid, refresh])

  // Refresh when any call I'm part of changes
  useEffect(() => {
    if (!uid) return undefined
    const channel = supabase
      .channel(`call-history-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'call_participants' }, () => refresh())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [uid, refresh])

  async function clearAll() {
    setConfirmClear(false)
    const ids = (items ?? []).map((i) => i.id)
    if (!ids.length) return
    const { error: e } = await supabase.from('call_history_hidden')
      .upsert(ids.map((call_id) => ({ user_id: uid, call_id })), { onConflict: 'user_id,call_id', ignoreDuplicates: true })
    if (e) setError('Could not clear the history.')
    setItems([])
    refresh()
  }

  const shown = (items ?? []).filter((i) => tab === 'all' || i.tone === 'missed')

  return (
    <div className="app-shell">
      <div className="flex items-center justify-between gap-3 px-3 pt-4 pb-3 shrink-0">
        <div className="flex items-center gap-1 min-w-0">
          <button onClick={() => navigate(-1)} aria-label="Go back" className="w-10 h-10 rounded-full flex items-center justify-center shrink-0">
            <ChevronLeft size={24} />
          </button>
          <h1 className="font-bold text-[24px] leading-none">Calls</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setMenuOpen(true)} aria-label="More" className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
            <MoreVertical size={20} />
          </button>
          <button onClick={() => setNewOpen(true)} aria-label="New call" className="w-10 h-10 rounded-full bg-brand-purple text-white flex items-center justify-center">
            <Plus size={20} />
          </button>
        </div>
      </div>

      <div className="px-4 pb-3 flex gap-2 shrink-0">
        {[['all', 'All'], ['missed', 'Missed']].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium ${tab === id ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="screen-scroll">
        {error ? <p role="alert" className="text-sm text-red-500 px-4 py-2">{error}</p> : null}
        {items === null ? (
          <p className="text-sm text-gray-500 px-4 py-10 text-center">Loading calls…</p>
        ) : shown.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="font-semibold">{tab === 'missed' ? 'No missed calls' : 'No calls yet'}</p>
            <p className="text-sm text-gray-500 mt-1">Voice and video calls with people in your school show up here.</p>
          </div>
        ) : (
          <ul className="px-2 pb-6">
            {shown.map((item) => {
              const Icon = item.outgoing ? PhoneOutgoing : item.tone === 'missed' ? PhoneMissed : PhoneIncoming
              const red = item.tone === 'missed'
              const openChat = () => { if (!item.group && item.peerIds[0]) navigate(`/chats/${item.peerIds[0]}`) }
              return (
                <li key={item.id} className="flex items-center gap-3 px-2 py-2.5 rounded-2xl">
                  <button onClick={openChat} className="flex items-center gap-3 flex-1 min-w-0 text-left" aria-label={`${item.title}, ${item.label}`}>
                    {item.avatar ? (
                      <img src={item.avatar} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
                    ) : (
                      <span className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold shrink-0" style={{ background: item.group ? '#1B1739' : '#6D4DFF' }}>
                        {item.group ? '👥' : item.initial}
                      </span>
                    )}
                    <span className="flex-1 min-w-0">
                      <span className={`block font-semibold truncate ${red ? 'text-red-500' : ''}`}>{item.title}</span>
                      <span className="flex items-center gap-1.5 text-sm text-gray-500 truncate">
                        <Icon size={14} className={red ? 'text-red-500 shrink-0' : 'shrink-0'} />
                        <span className="truncate">
                          {item.label}
                          {item.group ? ' · Group' : ''}
                          {item.seconds != null ? ` · ${durationLabel(item.seconds)}` : ''}
                        </span>
                      </span>
                    </span>
                  </button>
                  <span className="text-xs text-gray-400 shrink-0">{timeLabel(item.at)}</span>
                  <button
                    onClick={() => startCall({ inviteeIds: item.peerIds, kind: item.kind })}
                    disabled={!item.peerIds.length}
                    aria-label={item.kind === 'video' ? 'Video call back' : 'Voice call back'}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-brand-purple disabled:opacity-30 shrink-0"
                  >
                    {item.kind === 'video' ? <Video size={20} /> : <Phone size={20} />}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {newOpen ? (
        <BottomSheet onClose={() => setNewOpen(false)}>
          <ContactPicker
            max={11}
            confirmLabel="Start call"
            header={
              <div className="flex items-center justify-between mb-3">
                <p className="font-semibold text-base">New call</p>
                <div className="inline-flex bg-gray-100 rounded-full p-1">
                  {[['video', 'Video'], ['voice', 'Voice']].map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => setKind(id)}
                      className={`px-3 py-1 rounded-full text-sm font-medium ${kind === id ? 'bg-white shadow-sm text-brand-navy' : 'text-gray-500'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            }
            onConfirm={async (ids) => {
              const ok = await startCall({ inviteeIds: ids, kind })
              if (ok) setNewOpen(false)
            }}
          />
        </BottomSheet>
      ) : null}

      {menuOpen ? (
        <BottomSheet onClose={() => setMenuOpen(false)}>
          <SheetAction
            icon={Trash2}
            label="Clear call history"
            sub="Removes these calls from your list only"
            danger
            onClick={() => { setMenuOpen(false); setConfirmClear(true) }}
          />
        </BottomSheet>
      ) : null}

      {confirmClear ? (
        <BottomSheet onClose={() => setConfirmClear(false)}>
          <div className="px-4 py-3">
            <p className="font-semibold">Clear call history?</p>
            <p className="text-sm text-gray-500 mt-1">Calls are removed from your list only. Other people keep theirs.</p>
            <button onClick={clearAll} className="w-full mt-4 bg-red-500 text-white font-semibold rounded-full py-3">Clear</button>
            <button onClick={() => setConfirmClear(false)} className="w-full mt-2 py-3 text-gray-600">Cancel</button>
          </div>
        </BottomSheet>
      ) : null}
    </div>
  )
}
