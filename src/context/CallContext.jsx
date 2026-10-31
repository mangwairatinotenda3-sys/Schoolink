import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from './AuthContext.jsx'

const CallCtx = createContext(null)

async function callApi(body) {
  const { data, error } = await supabase.functions.invoke('calls', { body })
  if (error || !data?.ok) throw new Error(data?.error || 'Could not connect the call. Please try again.')
  return data
}

async function loadPeer(id) {
  const { data } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', id).maybeSingle()
  return { name: data?.full_name || 'Schoolink member', avatar: data?.avatar_url || null }
}

export function CallProvider({ children }) {
  const { user } = useAuth()
  const [incoming, setIncoming] = useState(null) // { call, peer } while the phone rings
  const [active, setActive] = useState(null)     // the call on screen
  const [notice, setNotice] = useState('')
  const activeRef = useRef(null)
  const incomingRef = useRef(null)
  activeRef.current = active
  incomingRef.current = incoming

  const clearNotice = useCallback(() => setNotice(''), [])

  // Live updates: calls ringing for me, and changes to calls I started
  useEffect(() => {
    if (!user?.id) return undefined
    const channel = supabase
      .channel(`calls-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'calls', filter: `callee_id=eq.${user.id}` }, async (payload) => {
        const call = payload.new
        if (call.status !== 'ringing' || activeRef.current || incomingRef.current) return
        const peer = await loadPeer(call.caller_id)
        setIncoming({ call, peer })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'calls', filter: `callee_id=eq.${user.id}` }, (payload) => {
        const call = payload.new
        setIncoming((cur) => (cur && cur.call.id === call.id && call.status !== 'ringing' ? null : cur))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'calls', filter: `caller_id=eq.${user.id}` }, (payload) => {
        const call = payload.new
        const cur = activeRef.current
        if (!cur || cur.call.id !== call.id) return
        if (call.status === 'active') setActive((a) => (a ? { ...a, connected: true } : a))
        else if (call.status === 'declined') { setActive(null); setNotice('Call declined.') }
        else if (call.status === 'ended' || call.status === 'missed') { setActive(null); setNotice('Call ended.') }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user?.id])

  const startCall = useCallback(async (partnerId, kind, peer) => {
    if (activeRef.current || incomingRef.current) { setNotice('Finish your current call first.'); return }
    try {
      const data = await callApi({ action: 'start', calleeId: partnerId, kind })
      setActive({ call: { id: data.callId, kind: data.kind }, token: data.token, url: data.url, role: 'caller', peer, connected: false })
    } catch (e) {
      setNotice(e.message)
    }
  }, [])

  const accept = useCallback(async () => {
    const cur = incomingRef.current
    if (!cur) return
    setIncoming(null)
    try {
      const data = await callApi({ action: 'accept', callId: cur.call.id })
      setActive({ call: { id: cur.call.id, kind: data.kind }, token: data.token, url: data.url, role: 'callee', peer: cur.peer, connected: true })
    } catch (e) {
      setNotice(e.message)
    }
  }, [])

  const decline = useCallback(async () => {
    const cur = incomingRef.current
    if (!cur) return
    setIncoming(null)
    try { await callApi({ action: 'decline', callId: cur.call.id }) } catch { /* ignore */ }
  }, [])

  const hangUp = useCallback(async () => {
    const cur = activeRef.current
    setActive(null)
    if (!cur) return
    try { await callApi({ action: 'end', callId: cur.call.id }) } catch { /* ignore */ }
  }, [])

  const value = useMemo(
    () => ({ incoming, active, notice, clearNotice, setNotice, startCall, accept, decline, hangUp }),
    [incoming, active, notice, clearNotice, startCall, accept, decline, hangUp]
  )

  return <CallCtx.Provider value={value}>{children}</CallCtx.Provider>
}

export function useCalls() {
  const value = useContext(CallCtx)
  if (!value) throw new Error('useCalls must be used inside CallProvider')
  return value
}
