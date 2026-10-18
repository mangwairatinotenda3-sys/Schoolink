import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Send, Paperclip, Users, MoreVertical, Image as ImageIcon, FileText, Copy, Forward, Pin, PinOff, Trash2, ShieldCheck, Info, Inbox, Lock, Loader2, X, Check } from 'lucide-react'
import BottomSheet, { SheetAction } from '../components/BottomSheet.jsx'
import { ConfirmSheet } from '../components/FamilySheets.jsx'
import CommunityMessageBubble from '../components/CommunityMessageBubble.jsx'
import CommunityPinned, { previewOf } from '../components/CommunityPinned.jsx'
import CommunityReviewSheet from '../components/CommunityReviewSheet.jsx'
import ForwardPicker from '../components/ForwardPicker.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

function dayLabel(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const today = new Date()
  const yest = new Date()
  yest.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yest.toDateString()) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' })
}

const byTime = (a, b) => new Date(a.created_at) - new Date(b.created_at)

export default function CommunityDetail() {
  const { communityId } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const photoInputRef = useRef(null)
  const fileInputRef = useRef(null)
  const bottomRef = useRef(null)
  const scrollRef = useRef(null)
  const nearBottom = useRef(true)
  const msgRefs = useRef({})
  const adminRef = useRef(false)
  const memberRef = useRef(false)

  const [community, setCommunity] = useState(null)
  const [memberCount, setMemberCount] = useState(0)
  const [myRole, setMyRole] = useState(null)
  const [adminIds, setAdminIds] = useState(new Set())
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [forwarding, setForwarding] = useState(null)
  const [actionMsg, setActionMsg] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [attachOpen, setAttachOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewBusy, setReviewBusy] = useState(false)
  const [requestCount, setRequestCount] = useState(0)
  const [requested, setRequested] = useState(false)
  const [joining, setJoining] = useState(false)
  const [highlight, setHighlight] = useState(null)
  const [toast, setToast] = useState('')

  const isMember = !!myRole
  const isAdmin = myRole === 'admin'
  const mode = community?.posting_mode || 'everyone'
  const canPost = isMember && (mode !== 'admins_only' || isAdmin)
  adminRef.current = isAdmin
  memberRef.current = isMember

  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(''), 2800)
    return () => clearTimeout(t)
  }, [toast])

  // ---------- Loading ----------
  async function loadAll(first = false) {
    if (first) setLoading(true)
    const { data: comm } = await supabase.from('communities').select('*').eq('id', communityId).maybeSingle()
    setCommunity(comm)

    const { count } = await supabase.from('community_members').select('*', { count: 'exact', head: true }).eq('community_id', communityId)
    setMemberCount(count ?? 0)

    const { data: mine } = await supabase.from('community_members').select('role').eq('community_id', communityId).eq('user_id', user.id).maybeSingle()
    const role = mine?.role ?? null
    setMyRole(role)

    const { data: admins } = await supabase.from('community_members').select('user_id').eq('community_id', communityId).eq('role', 'admin')
    setAdminIds(new Set((admins ?? []).map((a) => a.user_id)))

    let query = supabase.from('community_messages').select('*').eq('community_id', communityId)
    if (role !== 'admin') query = query.or(`status.eq.approved,sender_id.eq.${user.id}`)
    const { data: msgs } = await query.order('created_at', { ascending: false }).limit(200)
    setMessages((msgs ?? []).reverse())

    if (role === 'admin' && comm?.is_private) {
      const { count: reqs } = await supabase.from('community_join_requests').select('*', { count: 'exact', head: true }).eq('community_id', communityId).eq('status', 'pending')
      setRequestCount(reqs ?? 0)
    }
    if (!role && comm?.is_private) {
      const { data: req } = await supabase.from('community_join_requests').select('status').eq('community_id', communityId).eq('user_id', user.id).eq('status', 'pending').maybeSingle()
      setRequested(!!req)
    }
    setLoading(false)
    markCommunityRead()
  }

  async function markCommunityRead() {
    await supabase.from('community_reads').upsert(
      { user_id: user.id, community_id: communityId, last_read_at: new Date().toISOString() },
      { onConflict: 'user_id,community_id' }
    )
  }

  function visibleToMe(m) {
    return m.status === 'approved' || m.sender_id === user.id || adminRef.current
  }

  useEffect(() => {
    loadAll(true)
    const channel = supabase
      .channel(`community-${communityId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_messages', filter: `community_id=eq.${communityId}` }, (payload) => {
        const m = payload.new
        if (!visibleToMe(m)) return
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m].sort(byTime)))
        markCommunityRead()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'community_messages', filter: `community_id=eq.${communityId}` }, (payload) => {
        const m = payload.new
        setMessages((prev) => {
          const has = prev.some((x) => x.id === m.id)
          if (!visibleToMe(m)) return has ? prev.filter((x) => x.id !== m.id) : prev
          return has ? prev.map((x) => (x.id === m.id ? { ...x, ...m } : x)) : [...prev, m].sort(byTime)
        })
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'community_messages' }, (payload) => {
        const id = payload.old?.id
        if (id) setMessages((prev) => (prev.some((x) => x.id === id) ? prev.filter((x) => x.id !== id) : prev))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_members', filter: `community_id=eq.${communityId}` }, () => loadAll())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'communities', filter: `id=eq.${communityId}` }, (payload) => setCommunity((c) => ({ ...c, ...payload.new })))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [communityId])

  useEffect(() => {
    if (nearBottom.current) bottomRef.current?.scrollIntoView({ behavior: loading ? 'auto' : 'smooth' })
  }, [messages.length, loading])

  function onScroll(e) {
    const el = e.currentTarget
    nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 140
  }

  // ---------- Derived ----------
  const pinned = useMemo(() => messages.filter((m) => m.pinned_at && !m.removed_at).sort((a, b) => new Date(b.pinned_at) - new Date(a.pinned_at)), [messages])
  const pending = useMemo(() => messages.filter((m) => m.status === 'pending' && !m.removed_at), [messages])

  // ---------- Sending ----------
  async function sendMessage(fields) {
    const status = mode === 'approval' && !isAdmin ? 'pending' : 'approved'
    const { data, error } = await supabase
      .from('community_messages')
      .insert({ community_id: communityId, sender_id: user.id, sender_name: profile?.full_name || user.email, status, ...fields })
      .select()
      .maybeSingle()
    if (error) { setToast(error.message || 'Could not send. Try again.'); return false }
    if (data) {
      nearBottom.current = true
      setMessages((prev) => (prev.some((x) => x.id === data.id) ? prev : [...prev, data].sort(byTime)))
    }
    if (status === 'pending') setToast('Sent. An admin has to approve it before others see it')
    return true
  }

  async function handleSend() {
    const content = text.trim()
    if (!content || sending || !canPost) return
    setSending(true)
    setText('')
    const ok = await sendMessage({ content })
    if (!ok) setText(content)
    setSending(false)
  }

  async function upload(file, kind) {
    if (!file || !canPost) return
    setUploading(true)
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${communityId}/${user.id}/${Date.now()}-${safe}`
    const { error: upErr } = await supabase.storage.from('community-media').upload(path, file)
    if (upErr) { setUploading(false); setToast('Could not upload that file.'); return }
    const { data } = supabase.storage.from('community-media').getPublicUrl(path)
    if (kind === 'file') await sendMessage({ media_url: data.publicUrl, media_type: 'file', content: file.name })
    else await sendMessage({ media_url: data.publicUrl, media_type: file.type.startsWith('video/') ? 'video' : 'image' })
    setUploading(false)
  }

  const pickPhoto = (e) => { const f = e.target.files?.[0]; e.target.value = ''; upload(f, 'media') }
  const pickFile = (e) => { const f = e.target.files?.[0]; e.target.value = ''; upload(f, 'file') }

  // ---------- Message actions ----------
  const patch = (id, fields) => setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...fields } : m)))

  async function copyText(m) {
    setActionMsg(null)
    try { await navigator.clipboard.writeText(m.content || ''); setToast('Copied') } catch { setToast('Could not copy') }
  }

  async function pin(m, on) {
    setActionMsg(null)
    const { data, error } = await supabase.rpc('community_pin_message', { p_community: String(communityId), p_message: String(m.id), p_pin: on })
    if (error || !data?.ok) { setToast(error?.message || data?.error || 'Could not do that.'); return }
    patch(m.id, { pinned_at: on ? new Date().toISOString() : null })
    setToast(on ? 'Message pinned' : 'Message unpinned')
    loadAll()
  }

  async function deleteOwn(m) {
    setConfirm(null)
    const { error } = await supabase.from('community_messages').delete().eq('id', m.id)
    if (error) { setToast('Could not delete it.'); return }
    setMessages((prev) => prev.filter((x) => x.id !== m.id))
  }

  async function removeAsAdmin(m) {
    setConfirm(null)
    const { data, error } = await supabase.rpc('community_remove_message', { p_community: String(communityId), p_message: String(m.id) })
    if (error || !data?.ok) { setToast(error?.message || data?.error || 'Could not remove it.'); return }
    patch(m.id, { removed_at: new Date().toISOString(), content: null, media_url: null, media_type: null, pinned_at: null })
    setToast('Message removed')
  }

  async function review(ids, approve) {
    setReviewBusy(true)
    const { data, error } = await supabase.rpc('community_review_messages', { p_community: String(communityId), p_ids: ids, p_approve: approve })
    setReviewBusy(false)
    if (error || !data?.ok) { setToast(error?.message || data?.error || 'Could not do that.'); return }
    if (approve) setMessages((prev) => prev.map((m) => (ids.includes(String(m.id)) ? { ...m, status: 'approved' } : m)))
    else setMessages((prev) => prev.filter((m) => !ids.includes(String(m.id))))
    setActionMsg(null)
    if (pending.length - ids.length <= 0) setReviewOpen(false)
    setToast(approve ? 'Approved' : 'Turned down')
  }

  async function handleForwardSend(recipientId) {
    if (!forwarding) return
    await supabase.from('messages').insert({
      sender_id: user.id, receiver_id: recipientId, content: forwarding.content,
      media_url: forwarding.media_url, media_type: forwarding.media_type,
    })
    setForwarding(null)
    navigate(`/chats/${recipientId}`)
  }

  function jumpTo(m) {
    const el = msgRefs.current[m.id]
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlight(m.id)
    setTimeout(() => setHighlight(null), 1400)
  }

  async function join() {
    setJoining(true)
    if (community.is_private) {
      const { error } = await supabase.from('community_join_requests').upsert({ community_id: communityId, user_id: user.id, status: 'pending' })
      if (error) setToast('Could not send the request.')
      else setRequested(true)
    } else {
      const { error } = await supabase.from('community_members').upsert({ community_id: communityId, user_id: user.id, role: 'member' }, { onConflict: 'community_id,user_id' })
      if (error) setToast('Could not join. Try again.')
      else await loadAll()
    }
    setJoining(false)
    }

  // ---------- Screens ----------
  if (loading || !community) {
    return (
      <div className="app-shell">
        <div className="flex-1 flex items-center justify-center text-gray-400"><Loader2 className="animate-spin" /></div>
      </div>
    )
  }

  const sheetMsg = actionMsg
  const mineSheet = sheetMsg && sheetMsg.sender_id === user.id
  const sheetPending = sheetMsg && sheetMsg.status === 'pending'

  return (
    <div className="app-shell relative">
      <div className="flex items-center border-b border-gray-100 shrink-0" style={{ minHeight: 60 }}>
        <button onClick={() => navigate('/communities')} aria-label="Back" className="w-11 h-11 ml-1 rounded-full flex items-center justify-center shrink-0 active:bg-gray-100"><ArrowLeft size={22} /></button>
        <button onClick={() => navigate(`/communities/${communityId}/info`)} className="flex items-center gap-3 pr-2 py-2 text-left flex-1 min-w-0">
          {community.avatar_url ? <img src={community.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" /> : <span className="w-10 h-10 rounded-full bg-brand-light flex items-center justify-center shrink-0"><Users size={18} className="text-brand-purple" /></span>}
          <span className="min-w-0">
            <span className="block font-semibold text-[15px] truncate">{community.name}</span>
            <span className="block text-xs text-gray-400 truncate">{memberCount} member{memberCount === 1 ? '' : 's'}{mode === 'admins_only' ? ' · Only admins can send' : mode === 'approval' ? ' · Admins approve messages' : ''}</span>
          </span>
        </button>
        <button onClick={() => setMenuOpen(true)} aria-label="More" className="w-11 h-11 mr-1 rounded-full flex items-center justify-center shrink-0 active:bg-gray-100 relative">
          <MoreVertical size={20} />
          {isAdmin && (requestCount > 0 || pending.length > 0) ? <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-white" /> : null}
        </button>
      </div>

      <CommunityPinned pinned={pinned} onJump={jumpTo} />

      {isAdmin && pending.length > 0 ? (
        <button onClick={() => setReviewOpen(true)} className="w-full flex items-center gap-3 px-4 py-2.5 bg-amber-50 border-b border-amber-100 text-left active:bg-amber-100">
          <ShieldCheck size={18} className="text-amber-600 shrink-0" />
          <span className="flex-1 text-sm text-amber-800 font-medium">{pending.length} message{pending.length === 1 ? '' : 's'} waiting for approval</span>
          <span className="text-sm font-semibold text-amber-700">Review</span>
        </button>
      ) : null}

      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-1.5">
        {messages.length === 0 ? (
          <p className="text-center text-gray-400 mt-10 text-sm">No messages yet. Say hello!</p>
        ) : (
          messages.map((m, i) => {
            const prev = messages[i - 1]
            const newDay = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString()
            const showName = !prev || prev.sender_id !== m.sender_id || newDay || !!prev.removed_at
            return (
              <div key={m.id} ref={(el) => { msgRefs.current[m.id] = el }} className={showName && i > 0 && !newDay ? 'mt-1.5' : ''}>
                {newDay ? <p className="text-center my-3"><span className="text-[11px] font-medium text-gray-500 bg-gray-100 rounded-full px-3 py-1">{dayLabel(m.created_at)}</span></p> : null}
                <CommunityMessageBubble
                  message={m}
                  isMine={m.sender_id === user.id}
                  senderIsAdmin={adminIds.has(m.sender_id)}
                  showName={showName}
                  highlight={highlight === m.id}
                  onOpen={setActionMsg}
                />
                {m.status === 'pending' && !m.removed_at ? (
                  <p className={`text-[11px] mt-0.5 ${m.sender_id === user.id ? 'text-right' : ''} text-amber-600`}>Waiting for an admin to approve</p>
                ) : null}
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {isMember ? (
        canPost ? (
          <div className="border-t border-gray-100 bg-white shrink-0" style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
            {mode === 'approval' && !isAdmin ? <p className="text-[11px] text-gray-400 text-center pt-2">Admins approve messages before others see them</p> : null}
            <div className="flex items-end gap-2 px-3 pt-2">
              <button onClick={() => setAttachOpen(true)} disabled={uploading} aria-label="Attach" className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-gray-500 active:bg-gray-100 disabled:opacity-40">
                {uploading ? <Loader2 size={20} className="animate-spin" /> : <Paperclip size={21} />}
              </button>
              <input ref={photoInputRef} type="file" accept="image/*,video/*" onChange={pickPhoto} className="hidden" />
              <input ref={fileInputRef} type="file" onChange={pickFile} className="hidden" />
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                placeholder="Message"
                maxLength={4000}
                className="flex-1 min-w-0 bg-gray-100 rounded-full px-4 py-2.5 text-[15px] outline-none"
              />
              <button onClick={handleSend} disabled={sending || !text.trim()} aria-label="Send" className="w-10 h-10 rounded-full bg-brand-purple flex items-center justify-center shrink-0 disabled:opacity-40"><Send size={17} className="text-white" /></button>
            </div>
          </div>
        ) : (
          <div className="px-4 py-3.5 border-t border-gray-100 text-center text-sm text-gray-400 flex items-center justify-center gap-2 shrink-0" style={{ paddingBottom: 'max(14px, env(safe-area-inset-bottom))' }}><Lock size={14} /> Only admins can send messages</div>
        )
      ) : (
        <div className="px-4 py-3 border-t border-gray-100 shrink-0" style={{ paddingBottom: 'max(14px, env(safe-area-inset-bottom))' }}>
          {requested ? (
            <p className="text-center text-sm text-gray-500 py-2">Request sent. An admin will let you in.</p>
          ) : (
            <button onClick={join} disabled={joining} className="w-full bg-brand-purple text-white font-semibold py-3 rounded-full disabled:opacity-40 flex items-center justify-center">
              {joining ? <Loader2 size={18} className="animate-spin" /> : community.is_private ? 'Request to join' : 'Join to send messages'}
            </button>
          )}
        </div>
      )}

      {/* The menu in the corner */}
      {menuOpen ? (
        <BottomSheet onClose={() => setMenuOpen(false)}>
          <SheetAction icon={Info} label="Community info" onClick={() => { setMenuOpen(false); navigate(`/communities/${communityId}/info`) }} />
          <SheetAction icon={ImageIcon} label="Photos, videos and files" onClick={() => { setMenuOpen(false); navigate(`/communities/${communityId}/media`) }} />
          {isAdmin && community.is_private ? <SheetAction icon={Inbox} label="Join requests" sub={requestCount ? `${requestCount} waiting` : undefined} onClick={() => { setMenuOpen(false); navigate(`/communities/${communityId}/requests`) }} /> : null}
          {isAdmin && (mode === 'approval' || pending.length > 0) ? <SheetAction icon={ShieldCheck} label="Messages waiting for approval" sub={pending.length ? `${pending.length} waiting` : 'Nothing waiting'} onClick={() => { setMenuOpen(false); setReviewOpen(true) }} /> : null}
        </BottomSheet>
      ) : null}

      {/* Attach */}
      {attachOpen ? (
        <BottomSheet onClose={() => setAttachOpen(false)}>
          <SheetAction icon={ImageIcon} label="Photo or video" onClick={() => { setAttachOpen(false); photoInputRef.current?.click() }} />
          <SheetAction icon={FileText} label="Document" onClick={() => { setAttachOpen(false); fileInputRef.current?.click() }} />
        </BottomSheet>
      ) : null}

      {/* Tap a message */}
      {sheetMsg ? (
        <BottomSheet onClose={() => setActionMsg(null)}>
          <div className="px-4 pb-2">
            <p className="text-xs font-semibold text-gray-400 truncate">{mineSheet ? 'You' : sheetMsg.sender_name || 'Member'}</p>
            <p className="text-sm text-gray-600 line-clamp-2 break-words">{previewOf(sheetMsg)}</p>
          </div>
          {sheetMsg.content ? <SheetAction icon={Copy} label="Copy" onClick={() => copyText(sheetMsg)} /> : null}
          {!sheetPending ? <SheetAction icon={Forward} label="Forward" onClick={() => { setForwarding(sheetMsg); setActionMsg(null) }} /> : null}
          {isAdmin && !sheetPending ? (
            sheetMsg.pinned_at
              ? <SheetAction icon={PinOff} label="Unpin message" onClick={() => pin(sheetMsg, false)} />
              : <SheetAction icon={Pin} label="Pin message" sub="Shows at the top for everyone" onClick={() => pin(sheetMsg, true)} />
          ) : null}
          {isAdmin && sheetPending ? <SheetAction icon={Check} label="Approve" onClick={() => review([String(sheetMsg.id)], true)} /> : null}
          {isAdmin && sheetPending ? <SheetAction icon={X} label="Turn down" danger onClick={() => review([String(sheetMsg.id)], false)} /> : null}
          {mineSheet ? <SheetAction icon={Trash2} label="Delete for everyone" danger onClick={() => { setConfirm({ kind: 'own', m: sheetMsg }); setActionMsg(null) }} /> : null}
          {isAdmin && !mineSheet && !sheetPending ? <SheetAction icon={Trash2} label="Remove message" sub="Everyone sees that an admin removed it" danger onClick={() => { setConfirm({ kind: 'admin', m: sheetMsg }); setActionMsg(null) }} /> : null}
        </BottomSheet>
      ) : null}

      {confirm?.kind === 'own' ? <ConfirmSheet title="Delete this message?" body="It is deleted for everyone in the community." confirmLabel="Delete" danger onConfirm={() => deleteOwn(confirm.m)} onClose={() => setConfirm(null)} /> : null}
      {confirm?.kind === 'admin' ? <ConfirmSheet title="Remove this message?" body="It is removed for everyone. The chat will show that an admin removed it." confirmLabel="Remove" danger onConfirm={() => removeAsAdmin(confirm.m)} onClose={() => setConfirm(null)} /> : null}

      {reviewOpen ? <CommunityReviewSheet items={pending} busy={reviewBusy} onApprove={(ids) => review(ids, true)} onReject={(ids) => review(ids, false)} onClose={() => setReviewOpen(false)} /> : null}

      {forwarding ? <ForwardPicker onClose={() => setForwarding(null)} onSend={handleForwardSend} /> : null}

      {toast ? <div className="absolute left-1/2 -translate-x-1/2 z-[70] bg-gray-900 text-white text-sm rounded-full px-4 py-2 shadow-lg max-w-[90%] text-center" style={{ bottom: 84 }}>{toast}</div> : null}
    </div>
  )
      }
