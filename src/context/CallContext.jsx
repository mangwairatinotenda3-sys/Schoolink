import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from './AuthContext.jsx'

const CallCtx = createContext(null)
const NO_ANSWER_MS = 45 * 1000
const RING_MS = 60 * 1000
const HEARTBEAT_MS = 30 * 1000

export async function callApi(body) {
  const { data, error } = await supabase.functions.invoke('calls', { body })
  if (error || !data?.ok) {
    const err = new Error(data?.error || 'Could not connect the call. Please try again.')
    err.code = data?.code || null
    err.ids = data?.ids || []
    throw err
  }
  return data
}

async function fetchPeople(ids) {
  const list = [...new Set(ids.filter(Boolean))]
  if (!list.length) return {}
  const { data } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', list)
  return Object.fromEntries((data ?? []).map((p) => [
    p.id, { id: p.id, name: p.full_name || 'Schoolink member', avatar: p.avatar_url || null },
  ]))
}

const addPeer = (list, peer) => (!peer || list.some((p) => p.id === peer.id) ? list : [...list, peer])

export function CallProvider({ children }) {
  const { user } = useAuth()
  const uid = user?.id || null
  const [incoming, setIncoming] = useState(null) // { callId, kind, caller, others }
  const [active, setActive] = useState(null)     // the call on screen
  const [notice, setNotice] = useState('')
  const [requests, setRequests] = useState([])   // people asking to be allowed to call me
  const activeRef = useRef(null)
  const incomingRef = useRef(null)
  const startingRef = useRef(false)
  activeRef.current = active
  incomingRef.current = incoming

  const clearNotice = useCallback(() => setNotice(''), [])

  const loadIncoming = useCallback(async (callId) => {
    const { data: call } = await supabase.from('calls').select('id, kind, status, caller_id').eq('id', callId).maybeSingle()
    if (!call || call.status === 'ended') return null
    const { data: rows } = await supabase.from('call_participants').select('user_id, role, status').eq('call_id', callId)
    const list = rows ?? []
    const mine = list.find((r) => r.user_id === uid)
    if (!mine || mine.status !== 'ringing') return null
    const people = await fetchPeople([...list.map((r) => r.user_id), call.caller_id])
    const others = list
      .filter((r) => r.user_id !== uid && r.user_id !== call.caller_id && ['ringing', 'joined'].includes(r.status))
      .map((r) => people[r.user_id])
      .filter(Boolean)
    return {
      callId: call.id,
      kind: call.kind,
      caller: people[call.caller_id] || { id: call.caller_id, name: 'Schoolink member', avatar: null },
      others,
    }
  }, [uid])

  const hangUp = useCallback(() => {
    const cur = activeRef.current
    if (!cur) return
    activeRef.current = null
    setActive(null)
    callApi({ action: 'leave', callId: cur.callId }).catch(() => {})
  }, [])

  // Pending call requests waiting for me, loaded when the app opens
  useEffect(() => {
    setRequests([])
    if (!uid) return undefined
    let live = true
    ;(async () => {
      const { data } = await supabase.from('call_requests').select('requester_id')
        .eq('target_id', uid).eq('status', 'pending').order('created_at', { ascending: true })
      const ids = (data ?? []).map((r) => r.requester_id)
      if (!ids.length) return
      const people = await fetchPeople(ids)
      if (!live) return
      setRequests(ids.map((id) => ({
        requesterId: id,
        name: people[id]?.name || 'Schoolink member',
        avatar: people[id]?.avatar || null,
      })))
    })()
    return () => { live = false }
  }, [uid])

  // Live updates. RLS limits every event to calls this person is part of.
  useEffect(() => {
    if (!uid) return undefined
    const offerIncoming = async (callId) => {
      if (activeRef.current || incomingRef.current) return
      const info = await loadIncoming(callId)
      if (info && !activeRef.current && !incomingRef.current) setIncoming(info)
    }

    const channel = supabase
      .channel(`calls-${uid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'call_participants' }, async (payload) => {
        const row = payload.new
        if (row.status !== 'ringing') return
        if (row.user_id === uid) {
          if (activeRef.current?.callId === row.call_id) return
          if (activeRef.current || incomingRef.current) {
            callApi({ action: 'decline', callId: row.call_id }).catch(() => {}) // already on a call
            return
          }
          offerIncoming(row.call_id)
          return
        }
        if (activeRef.current?.callId === row.call_id) {
          const people = await fetchPeople([row.user_id])
          setActive((a) => (a && a.callId === row.call_id ? { ...a, pending: addPeer(a.pending, people[row.user_id]) } : a))
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'call_participants' }, async (payload) => {
        const row = payload.new
        const cur = activeRef.current
        if (row.user_id === uid) {
          const inc = incomingRef.current
          if (inc && inc.callId === row.call_id && row.status !== 'ringing') setIncoming(null)
          if (row.status === 'ringing' && !cur && !inc) offerIncoming(row.call_id)
          if (cur && cur.callId === row.call_id && ['missed', 'declined', 'left'].includes(row.status)) {
            setActive(null)
            setNotice('You were removed from the call.')
          }
          return
        }
        if (!cur || cur.callId !== row.call_id) return
        if (row.status === 'joined') {
          setActive((a) => (a && a.callId === row.call_id ? {
            ...a,
            joined: a.joined.includes(row.user_id) ? a.joined : [...a.joined, row.user_id],
            pending: a.pending.filter((p) => p.id !== row.user_id),
          } : a))
        } else if (row.status === 'ringing') {
          const people = await fetchPeople([row.user_id])
          setActive((a) => (a && a.callId === row.call_id ? { ...a, pending: addPeer(a.pending, people[row.user_id]) } : a))
        } else {
          setActive((a) => (a && a.callId === row.call_id ? {
            ...a,
            joined: a.joined.filter((id) => id !== row.user_id),
            pending: a.pending.filter((p) => p.id !== row.user_id),
          } : a))
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'calls' }, (payload) => {
        const c = payload.new
        if (c.status !== 'ended') return
        if (activeRef.current?.callId === c.id) { setActive(null); setNotice('Call ended.') }
        if (incomingRef.current?.callId === c.id) setIncoming(null)
      })
      // Call requests sent to me
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'call_requests', filter: `target_id=eq.${uid}` }, async (payload) => {
        const row = payload.new
        if (row.status !== 'pending') return
        const people = await fetchPeople([row.requester_id])
        const p = people[row.requester_id] || { name: 'Schoolink member', avatar: null }
        setRequests((list) => (list.some((r) => r.requesterId === row.requester_id)
          ? list
          : [...list, { requesterId: row.requester_id, name: p.name, avatar: p.avatar }]))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'call_requests', filter: `target_id=eq.${uid}` }, (payload) => {
        const row = payload.new
        if (row.status !== 'pending') setRequests((list) => list.filter((r) => r.requesterId !== row.requester_id))
      })
      // Requests I sent
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'call_requests', filter: `requester_id=eq.${uid}` }, async (payload) => {
        const row = payload.new
        if (row.status === 'pending') return
        const people = await fetchPeople([row.target_id])
        const name = people[row.target_id]?.name || 'They'
        setNotice(row.status === 'accepted'
          ? `${name} accepted your call request. You can call now.`
          : `${name} can't take your call right now.`)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [uid, loadIncoming])

  // An incoming ring stops on its own after a minute, matching the server
  useEffect(() => {
    if (!incoming) return undefined
    const t = setTimeout(() => setIncoming(null), RING_MS)
    return () => clearTimeout(t)
  }, [incoming])

  // Keep my place in the call alive while the app is open
  const activeCallId = active?.callId || null
  useEffect(() => {
    if (!activeCallId) return undefined
    const t = setInterval(() => { callApi({ action: 'ping', callId: activeCallId }).catch(() => {}) }, HEARTBEAT_MS)
    return () => clearInterval(t)
  }, [activeCallId])

  // Caller: if nobody has joined, end when nobody is left ringing, or after 45 seconds
  const waiting = active && active.role === 'caller' && active.joined.length === 0 ? active.pending.length : null
  useEffect(() => {
    if (waiting === null) return undefined
    if (waiting === 0) { setNotice('No one answered.'); hangUp(); return undefined }
    const t = setTimeout(() => { setNotice('No answer.'); hangUp() }, NO_ANSWER_MS)
    return () => clearTimeout(t)
  }, [waiting, hangUp])

  // Ask someone outside the school to let me call them. Returns 'accepted', 'pending' or null.
  const requestCall = useCallback(async (partnerId) => {
    try {
      const data = await callApi({ action: 'request', targetId: partnerId })
      if (data.status === 'accepted') setNotice('You can call now.')
      else setNotice(`Call request sent${data.name ? ` to ${data.name}` : ''}. You can call once they accept.`)
      return data.status
    } catch (e) {
      setNotice(e.message)
      return null
    }
  }, [])

  // Accept or decline a call request sent to me
  const respondRequest = useCallback(async (requesterId, accept) => {
    setRequests((list) => list.filter((r) => r.requesterId !== requesterId))
    try {
      await callApi({ action: 'respond', requesterId, accept })
      if (accept) setNotice('They can call you now.')
    } catch (e) {
      setNotice(e.message)
    }
  }, [])

  const startCall = useCallback(async ({ inviteeIds, kind = 'video', title = '' }) => {
    if (startingRef.current) return false
    if (activeRef.current) { setNotice('Finish your current call first.'); return false }
    if (incomingRef.current) { setNotice('Answer or decline the incoming call first.'); return false }
    startingRef.current = true
    try {
      const data = await callApi({ action: 'start', calleeIds: inviteeIds, kind })
      setActive({
        callId: data.callId,
        kind: data.kind,
        title,
        role: 'caller',
        token: data.token,
        url: data.url,
        startedAt: Date.now(),
        pending: data.pending ?? [],
        joined: [],
      })
      if (data.skipped?.length) setNotice(data.skipped.join(' · '))
      return true
    } catch (e) {
      // Calling a stranger: send the request for them, they decide
      if (e.code === 'needs_request' && inviteeIds.length === 1) await requestCall(inviteeIds[0])
      else setNotice(e.message)
      return false
    } finally {
      startingRef.current = false
    }
  }, [requestCall])

  const accept = useCallback(async () => {
    const cur = incomingRef.current
    if (!cur || activeRef.current) return
    incomingRef.current = null
    setIncoming(null)
    try {
      const data = await callApi({ action: 'join', callId: cur.callId })
      setActive({
        callId: cur.callId,
        kind: data.kind,
        title: cur.caller?.name ? `${cur.caller.name}'s call` : 'Call',
        role: 'invitee',
        token: data.token,
        url: data.url,
        startedAt: Date.now(),
        pending: data.pending ?? [],
        joined: [],
      })
    } catch (e) {
      setNotice(e.message)
    }
  }, [])

  const decline = useCallback(async () => {
    const cur = incomingRef.current
    if (!cur) return
    incomingRef.current = null
    setIncoming(null)
    try { await callApi({ action: 'decline', callId: cur.callId }) } catch { /* ignore */ }
  }, [])

  const invite = useCallback(async (userIds) => {
    const cur = activeRef.current
    if (!cur || !userIds.length) return false
    try {
      const data = await callApi({ action: 'invite', callId: cur.callId, userIds })
      setActive((a) => {
        if (!a || a.callId !== cur.callId) return a
        const pending = (data.invited ?? []).reduce((list, p) => addPeer(list, p), a.pending)
        return { ...a, pending }
      })
      if (data.skipped?.length) setNotice(data.skipped.join(' · '))
      return true
    } catch (e) {
      setNotice(e.message)
      return false
    }
  }, [])

  const value = useMemo(
    () => ({
      uid, incoming, active, notice, setNotice, clearNotice, requests,
      startCall, accept, decline, hangUp, invite, requestCall, respondRequest,
    }),
    [uid, incoming, active, notice, clearNotice, requests, startCall, accept, decline, hangUp, invite, requestCall, respondRequest]
  )

  return <CallCtx.Provider value={value}>{children}</CallCtx.Provider>
}

export function useCalls() {
  const value = useContext(CallCtx)
  if (!value) throw new Error('useCalls must be used inside CallProvider')
  return value
    }
