import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Send, Paperclip, Users, MoreVertical, Image as ImageIcon, FileText, Copy, Forward, Pin, PinOff,
  Trash2, ShieldCheck, Info, Inbox, Lock, Loader2, X, Check, Reply, Star, Pencil, Phone, Search, BellOff, Bell, ChevronDown, Mic, Plus, Smile,
} from 'lucide-react'
import BottomSheet, { SheetAction } from '../components/BottomSheet.jsx'
import { ConfirmSheet } from '../components/FamilySheets.jsx'
import CommunityMessageBubble, { mentionPattern } from '../components/CommunityMessageBubble.jsx'
import CommunityPinned, { previewOf } from '../components/CommunityPinned.jsx'
import CommunityReviewSheet from '../components/CommunityReviewSheet.jsx'
import CommunityCallSheet from '../components/CommunityCallSheet.jsx'
import PersonAvatar from '../components/PersonAvatar.jsx'
import ForwardPicker from '../components/ForwardPicker.jsx'
import useVoiceRecorder from '../lib/useVoiceRecorder.js'
import EmojiPicker from '../components/EmojiPicker.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏']
const EDIT_WINDOW_MS = 15 * 60 * 1000
const FOREVER = '2099-12-31T00:00:00Z'

function clock(total) {
  const s = Math.max(0, Math.floor(total || 0))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
const MUTE_MS = { '8h': 8 * 3600 * 1000, '1w': 7 * 24 * 3600 * 1000 }

const byTime = (a, b) => new Date(a.created_at) - new Date(b.created_at)
const isMutedNow = (until) => !!until && Date.parse(until) > Date.now()

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

function addReaction(prev, r) {
  const list = prev[r.message_id] ?? []
  if (list.some((x) => x.user_id === r.user_id && x.emoji === r.emoji)) return prev
  return { ...prev, [r.message_id]: [...list, { user_id: r.user_id, emoji: r.emoji }] }
}

function removeReaction(prev, messageId, userId, emoji) {
  return { ...prev, [messageId]: (prev[messageId] ?? []).filter((x) => !(x.user_id === userId && x.emoji === emoji)) }
}

function summarize(list = [], me) {
  const map = new Map()
  for (const r of list) {
    const cur = map.get(r.emoji) || { emoji: r.emoji, count: 0, mine: false }
    cur.count += 1
    if (r.user_id === me) cur.mine = true
    map.set(r.emoji, cur)
  }
  return [...map.values()]
}

export default function CommunityDetail() {
  const { communityId } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const photoInputRef = useRef(null)
  const fileInputRef = useRef(null)
  const inputRef = useRef(null)
  const bottomRef = useRef(null)
  const nearBottom = useRef(true)
  const msgRefs = useRef({})
  const channelRef = useRef(null)
  const lastTypingSent = useRef(0)
  const adminRef = useRef(false)

  const [community, setCommunity] = useState(null)
  const [members, setMembers] = useState([])
  const [myRole, setMyRole] = useState(null)
  const [messages, setMessages] = useState([])
  const [reactions, setReactions] = useState({})
  const [stars, setStars] = useState(() => new Set())
  const [hidden, setHidden] = useState(() => new Set())
  const [unreadAnchor, setUnreadAnchor] = useState(null)
  const [mutedUntil, setMutedUntil] = useState(null)
  const [typing, setTyping] = useState({})
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [editing, setEditing] = useState(null)
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [forwarding, setForwarding] = useState(null)
  const [actionMsg, setActionMsg] = useState(null)
  const [infoMsg, setInfoMsg] = useState(null)
  const [reads, setReads] = useState([])
  const [confirm, setConfirm] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [muteOpen, setMuteOpen] = useState(false)
  const [attachOpen, setAttachOpen] = useState(false)
  const [callOpen, setCallOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewBusy, setReviewBusy] = useState(false)
  const [requestCount, setRequestCount] = useState(0)
  const [requested, setRequested] = useState(false)
  const [joining, setJoining] = useState(false)
  const [highlight, setHighlight] = useState(null)
  const [pendingJump, setPendingJump] = useState(null)
  const [search, setSearch] = useState(null)
  const [starredOnly, setStarredOnly] = useState(false)
  const [showDown, setShowDown] = useState(false)
  const [composerEmoji, setComposerEmoji] = useState(false)
  const [reactPicker, setReactPicker] = useState(null)
  const [toast, setToast] = useState('')

  const voice = useVoiceRecorder({
    onRecorded: (file) => sendVoice(file),
    onError: (msg) => setToast(msg),
  })

  const mode = community?.posting_mode || 'everyone'
  const isMember = !!myRole
  const isAdmin = myRole === 'admin'
  const canPost = isMember && (mode !== 'admins_only' || isAdmin)
  const memberCount = members.length
  adminRef.current = isAdmin

  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(''), 2800)
    return () => clearTimeout(t)
  }, [toast])

  // Typing names fade out after a few seconds without a new keystroke
  useEffect(() => {
    const t = setInterval(() => {
      const cut = Date.now() - 3500
      setTyping((prev) => {
        const next = Object.fromEntries(Object.entries(prev).filter(([, v]) => v.at > cut))
        return Object.keys(next).length === Object.keys(prev).length ? prev : next
      })
    }, 1000)
    return () => clearInterval(t)
  }, [])

  // ---------- Loading ----------
  async function loadAll(first = false) {
    if (first) setLoading(true)
    const [{ data: comm }, { data: rows }] = await Promise.all([
      supabase.from('communities').select('*').eq('id', communityId).maybeSingle(),
      supabase.from('community_members').select('user_id, role, profiles(full_name, role, avatar_url)').eq('community_id', communityId),
    ])
    setCommunity(comm)
    setMembers(rows ?? [])
    const role = (rows ?? []).find((r) => r.user_id === user.id)?.role ?? null
    setMyRole(role)

    let query = supabase.from('community_messages').select('*').eq('community_id', communityId)
    if (role !== 'admin') query = query.or(`status.eq.approved,sender_id.eq.${user.id}`)
    const { data: msgs } = await query.order('created_at', { ascending: false }).limit(300)
    const list = (msgs ?? []).reverse()
    setMessages(list)

    const ids = list.map((m) => m.id)
    if (ids.length) {
      const [{ data: rx }, { data: st }, { data: hd }] = await Promise.all([
        supabase.from('community_reactions').select('message_id, user_id, emoji').eq('community_id', communityId).in('message_id', ids),
        supabase.from('community_stars').select('message_id').eq('user_id', user.id).eq('community_id', communityId),
        supabase.from('community_message_hidden').select('message_id').eq('user_id', user.id),
      ])
      const grouped = {}
      for (const r of rx ?? []) (grouped[r.message_id] ||= []).push({ user_id: r.user_id, emoji: r.emoji })
      setReactions(grouped)
      setStars(new Set((st ?? []).map((s) => s.message_id)))
      setHidden(new Set((hd ?? []).map((h) => h.message_id)))
    }

    if (first) {
      const { data: rd } = await supabase.from('community_reads').select('last_read_at, muted_until')
        .eq('user_id', user.id).eq('community_id', communityId).maybeSingle()
      setMutedUntil(rd?.muted_until ?? null)
      const marker = rd?.last_read_at ? Date.parse(rd.last_read_at) : 0
      const firstUnread = list.find((m) => Date.parse(m.created_at) > marker && m.sender_id !== user.id && m.kind !== 'system')
      setUnreadAnchor(firstUnread?.id ?? null)
    }

    if (role === 'admin' && comm?.is_private) {
      const { count } = await supabase.from('community_join_requests').select('*', { count: 'exact', head: true }).eq('community_id', communityId).eq('status', 'pending')
      setRequestCount(count ?? 0)
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
      .channel(`community-${communityId}-${Math.random().toString(36).slice(2)}`, { config: { broadcast: { self: false } } })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_messages', filter: `community_id=eq.${communityId}` }, (payload) => {
        const m = payload.new
        if (!visibleToMe(m)) return
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m].sort(byTime)))
        if (nearBottom.current) markCommunityRead()
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
        if (id) setMessages((prev) => prev.filter((x) => x.id !== id))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_reactions', filter: `community_id=eq.${communityId}` }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const o = payload.old
          if (o?.message_id) setReactions((prev) => removeReaction(prev, o.message_id, o.user_id, o.emoji))
          return
        }
        const r = payload.new
        if (r?.message_id) setReactions((prev) => addReaction(prev, r))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_members', filter: `community_id=eq.${communityId}` }, () => loadAll())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'communities', filter: `id=eq.${communityId}` }, (payload) => setCommunity((c) => ({ ...c, ...payload.new })))
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (!payload || payload.user_id === user.id) return
        setTyping((t) => ({ ...t, [payload.user_id]: { name: payload.name || 'Someone', at: Date.now() } }))
      })
      .subscribe()
    channelRef.current = channel
    return () => { channelRef.current = null; supabase.removeChannel(channel) }
  }, [communityId])

  useEffect(() => {
    if (nearBottom.current) bottomRef.current?.scrollIntoView({ behavior: loading ? 'auto' : 'smooth' })
  }, [messages.length, loading])

  useEffect(() => {
    if (pendingJump === null || searching) return undefined
    const t = setTimeout(() => { jumpTo(pendingJump); setPendingJump(null) }, 60)
    return () => clearTimeout(t)
  }, [pendingJump, search])

  function onScroll(e) {
    const el = e.currentTarget
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 140
    nearBottom.current = near
    setShowDown(!near)
  }

    // ---------- Derived ----------
  const pinned = useMemo(
    () => messages.filter((m) => m.pinned_at && !m.removed_at && !m.deleted_at).sort((a, b) => new Date(b.pinned_at) - new Date(a.pinned_at)),
    [messages]
  )
  const pending = useMemo(() => messages.filter((m) => m.status === 'pending' && !m.removed_at), [messages])
  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages])
  const pattern = useMemo(() => mentionPattern(members.map((m) => m.profiles?.full_name).filter(Boolean)), [members])
  const adminIds = useMemo(() => new Set(members.filter((m) => m.role === 'admin').map((m) => m.user_id)), [members])
  const visible = useMemo(
    () => messages.filter((m) => !hidden.has(m.id) && (!m.expires_at || Date.parse(m.expires_at) > Date.now())),
    [messages, hidden]
  )
  const typingNames = Object.values(typing).map((v) => v.name)
  const unreadIdx = unreadAnchor ? visible.findIndex((m) => m.id === unreadAnchor) : -1
  const unreadCount = unreadIdx >= 0
    ? visible.slice(unreadIdx).filter((m) => m.sender_id !== user.id && m.kind !== 'system').length
    : 0
  const searching = search !== null
  const q = (search ?? '').trim().toLowerCase()
  const results = searching
    ? visible.filter((m) => m.kind !== 'system'
      && (!starredOnly || stars.has(m.id))
      && (q ? (m.content || '').toLowerCase().includes(q) || (m.sender_name || '').toLowerCase().includes(q) : starredOnly))
    : []
  const mentionMatch = text.match(/@([^\n@]{0,30})$/)
  const mentionOptions = mentionMatch && canPost && !editing
    ? members.filter((m) => m.user_id !== user.id && (m.profiles?.full_name || '').toLowerCase().includes(mentionMatch[1].toLowerCase())).slice(0, 6)
    : []
  const sheetMsg = actionMsg
  const mineSheet = !!sheetMsg && sheetMsg.sender_id === user.id
  const sheetPending = !!sheetMsg && sheetMsg.status === 'pending'
  const sheetLive = !!sheetMsg && !sheetMsg.removed_at && !sheetMsg.deleted_at && sheetMsg.kind !== 'system'
  const canEditMsg = (m) => !!m && m.sender_id === user.id && !m.removed_at && !m.deleted_at && !m.media_url && m.kind === 'user'
    && Date.now() - Date.parse(m.created_at) < EDIT_WINDOW_MS

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

  async function saveEdit(content) {
    const target = editing
    setSending(true)
    const { data, error } = await supabase.rpc('community_edit_message', { p_message: String(target.id), p_content: content })
    setSending(false)
    if (error || !data?.ok) { setToast(error?.message || data?.error || 'Could not edit that.'); return }
    setMessages((prev) => prev.map((m) => (m.id === target.id ? { ...m, content: data.content, edited_at: data.edited_at } : m)))
    setEditing(null)
    setText('')
  }

  async function handleSend() {
    const content = text.trim()
    if (!content || sending || !canPost) return
    if (editing) { await saveEdit(content); return }
    setSending(true)
    const reply = replyTo
    const lower = content.toLowerCase()
    const mentions = members
      .filter((m) => m.user_id !== user.id && m.profiles?.full_name && lower.includes(`@${m.profiles.full_name.toLowerCase()}`))
      .map((m) => m.user_id)
    const fields = { content }
    if (reply) fields.reply_to = reply.id
    if (mentions.length) fields.mentions = mentions
    setText('')
    setReplyTo(null)
    const ok = await sendMessage(fields)
    if (!ok) { setText(content); setReplyTo(reply) }
    setSending(false)
  }

  function onType(value) {
    setText(value)
    const now = Date.now()
    if (now - lastTypingSent.current > 2500 && channelRef.current) {
      lastTypingSent.current = now
      channelRef.current
        .send({ type: 'broadcast', event: 'typing', payload: { user_id: user.id, name: profile?.full_name || 'Someone' } })
        .catch(() => {})
    }
  }

  function pickMention(m) {
    const name = m.profiles?.full_name || 'Member'
    setText((t) => t.replace(/@([^\n@]{0,30})$/, `@${name} `))
    inputRef.current?.focus()
  }

  function insertEmoji(e) {
    const el = inputRef.current
    const start = el?.selectionStart ?? text.length
    const end = el?.selectionEnd ?? text.length
    onType(text.slice(0, start) + e + text.slice(end))
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(start + e.length, start + e.length)
    })
  }

  function startReply(m) {
    setActionMsg(null)
    setEditing(null)
    setReplyTo(m)
    inputRef.current?.focus()
  }

  function startEdit(m) {
    setActionMsg(null)
    setReplyTo(null)
    setEditing(m)
    setText(m.content || '')
    inputRef.current?.focus()
  }

  function cancelComposer() {
    setReplyTo(null)
    setEditing(null)
    setText('')
  }

  async function upload(file, kind) {
    if (!file || !canPost) return
    setUploading(true)
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${communityId}/${user.id}/${Date.now()}-${safe}`
    const { error: upErr } = await supabase.storage.from('community-media').upload(path, file)
    if (upErr) { setUploading(false); setToast('Could not upload that file.'); return }
    const { data } = supabase.storage.from('community-media').getPublicUrl(path)
    const reply = replyTo
    setReplyTo(null)
    const extra = reply ? { reply_to: reply.id } : {}
    if (kind === 'file') await sendMessage({ media_url: data.publicUrl, media_type: 'file', content: file.name, ...extra })
    else await sendMessage({ media_url: data.publicUrl, media_type: file.type.startsWith('video/') ? 'video' : 'image', ...extra })
    setUploading(false)
  }

  const pickPhoto = (e) => { const f = e.target.files?.[0]; e.target.value = ''; upload(f, 'media') }
  const pickFile = (e) => { const f = e.target.files?.[0]; e.target.value = ''; upload(f, 'file') }

  async function sendVoice(file) {
    if (!file || !canPost) return
    setUploading(true)
    const ext = (file.name.split('.').pop() || 'webm').toLowerCase()
    const path = `${communityId}/${user.id}/${Date.now()}-voice.${ext}`
    const { error: upErr } = await supabase.storage.from('community-media').upload(path, file, { contentType: file.type })
    if (upErr) { setUploading(false); setToast('Could not send the voice message.'); return }
    const { data } = supabase.storage.from('community-media').getPublicUrl(path)
    const reply = replyTo
    setReplyTo(null)
    await sendMessage({ media_url: data.publicUrl, media_type: 'audio', ...(reply ? { reply_to: reply.id } : {}) })
    setUploading(false)
  }

  // ---------- Message actions ----------
  const patch = (id, fields) => setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...fields } : m)))

  async function copyText(m) {
    setActionMsg(null)
    try { await navigator.clipboard.writeText(m.content || ''); setToast('Copied') } catch { setToast('Could not copy') }
  }

  async function react(m, emoji) {
    setActionMsg(null)
    const mineNow = (reactions[m.id] ?? []).filter((r) => r.user_id === user.id)
    const same = mineNow.some((r) => r.emoji === emoji)
    for (const r of mineNow) {
      await supabase.from('community_reactions').delete().eq('message_id', m.id).eq('user_id', user.id).eq('emoji', r.emoji)
      setReactions((prev) => removeReaction(prev, m.id, user.id, r.emoji))
    }
    if (same) return
    const { error } = await supabase.from('community_reactions').insert({ message_id: m.id, community_id: communityId, user_id: user.id, emoji })
    if (error) { setToast('Could not react. Try again.'); return }
    setReactions((prev) => addReaction(prev, { message_id: m.id, user_id: user.id, emoji }))
  }

  async function toggleStar(m) {
    setActionMsg(null)
    if (stars.has(m.id)) {
      await supabase.from('community_stars').delete().eq('user_id', user.id).eq('message_id', m.id)
      setStars((s) => { const n = new Set(s); n.delete(m.id); return n })
      setToast('Removed from starred')
    } else {
      await supabase.from('community_stars').insert({ user_id: user.id, message_id: m.id, community_id: communityId })
      setStars((s) => new Set(s).add(m.id))
      setToast('Starred')
    }
  }

  async function deleteForMe(m) {
    setConfirm(null)
    setActionMsg(null)
    await supabase.from('community_message_hidden').insert({ user_id: user.id, message_id: m.id })
    setHidden((h) => new Set(h).add(m.id))
  }

  async function deleteForEveryone(m) {
    setConfirm(null)
    const { data, error } = await supabase.rpc('community_delete_own', { p_message: String(m.id) })
    if (error || !data?.ok) { setToast(error?.message || data?.error || 'Could not delete it.'); return }
    patch(m.id, { content: null, media_url: null, media_type: null, pinned_at: null, deleted_at: new Date().toISOString() })
  }

  async function removeAsAdmin(m) {
    setConfirm(null)
    const { data, error } = await supabase.rpc('community_remove_message', { p_community: String(communityId), p_message: String(m.id) })
    if (error || !data?.ok) { setToast(error?.message || data?.error || 'Could not remove it.'); return }
    patch(m.id, { removed_at: new Date().toISOString(), content: null, media_url: null, media_type: null, pinned_at: null })
    setToast('Message removed')
  }

  async function pin(m, on) {
    setActionMsg(null)
    const { data, error } = await supabase.rpc('community_pin_message', { p_community: String(communityId), p_message: String(m.id), p_pin: on })
    if (error || !data?.ok) { setToast(error?.message || data?.error || 'Could not do that.'); return }
    patch(m.id, { pinned_at: on ? new Date().toISOString() : null })
    setToast(on ? 'Message pinned' : 'Message unpinned')
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

  async function openInfo(m) {
    setActionMsg(null)
    setInfoMsg(m)
    const { data } = await supabase.from('community_reads').select('user_id, last_read_at').eq('community_id', communityId)
    setReads(data ?? [])
  }

  async function setMute(key) {
    setMuteOpen(false)
    setMenuOpen(false)
    const until = key === 'off' ? null : key === 'always' ? FOREVER : new Date(Date.now() + MUTE_MS[key]).toISOString()
    const { error } = await supabase.from('community_reads').upsert(
      { user_id: user.id, community_id: communityId, muted_until: until },
      { onConflict: 'user_id,community_id' }
    )
    if (error) { setToast('Could not change that.'); return }
    setMutedUntil(until)
    setToast(until ? 'Notifications muted' : 'Notifications on')
  }

  function jumpTo(id) {
    const el = msgRefs.current[id]
    if (!el) { setToast('That message is not on screen'); return }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlight(id)
    setTimeout(() => setHighlight(null), 1400)
  }

  function openSearch(starred = false) {
    setMenuOpen(false)
    setSearch('')
    setStarredOnly(starred)
  }

  function closeSearch() {
    setSearch(null)
    setStarredOnly(false)
  }

  function openFromResults(m) {
    closeSearch()
    setPendingJump(m.id)
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

  const subtitle = typingNames.length
    ? (typingNames.length === 1 ? `${typingNames[0]} is typing…` : `${typingNames.length} people are typing…`)
    : [
      `${memberCount} member${memberCount === 1 ? '' : 's'}`,
      mode === 'admins_only' ? 'Only admins can send' : mode === 'approval' ? 'Admins approve messages' : null,
      community.ephemeral_seconds ? 'Disappearing messages' : null,
    ].filter(Boolean).join(' · ')

  const sameDayAs = (a, b) => new Date(a.created_at).toDateString() === new Date(b.created_at).toDateString()

  return (
    <div className="app-shell relative">
      {searching ? (
        <div className="flex items-center gap-2 px-2 py-2 border-b border-gray-100 shrink-0">
          <button onClick={closeSearch} aria-label="Close search" className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 active:bg-gray-100"><ArrowLeft size={20} /></button>
          <div className="flex-1 min-w-0 flex items-center gap-2 bg-gray-100 rounded-full px-3 py-2">
            <Search size={16} className="text-gray-400 shrink-0" />
            <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search this community" className="flex-1 min-w-0 bg-transparent outline-none text-[15px]" />
          </div>
          <button
            onClick={() => setStarredOnly((v) => !v)}
            aria-pressed={starredOnly}
            className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold flex items-center gap-1 ${starredOnly ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            <Star size={13} /> Starred
          </button>
        </div>
      ) : (
        <div className="flex items-center border-b border-gray-100 shrink-0" style={{ minHeight: 60 }}>
          <button onClick={() => navigate('/communities')} aria-label="Back" className="w-11 h-11 ml-1 rounded-full flex items-center justify-center shrink-0 active:bg-gray-100"><ArrowLeft size={22} /></button>
          <button onClick={() => navigate(`/communities/${communityId}/info`)} className="flex items-center gap-3 pr-2 py-2 text-left flex-1 min-w-0">
            {community.avatar_url ? <img src={community.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" /> : <span className="w-10 h-10 rounded-full bg-brand-light flex items-center justify-center shrink-0"><Users size={18} className="text-brand-purple" /></span>}
            <span className="min-w-0">
              <span className="block font-semibold text-[15px] truncate">
                {community.name}
                {isMutedNow(mutedUntil) ? <BellOff size={12} className="inline ml-1.5 text-gray-400" aria-label="Muted" /> : null}
              </span>
              <span className={`block text-xs truncate ${typingNames.length ? 'text-brand-purple font-medium' : 'text-gray-400'}`}>{subtitle}</span>
            </span>
          </button>
          {isMember ? (
            <button onClick={() => setCallOpen(true)} aria-label="Group call" className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 active:bg-gray-100"><Phone size={19} /></button>
          ) : null}
          <button onClick={() => setMenuOpen(true)} aria-label="More" className="w-11 h-11 mr-1 rounded-full flex items-center justify-center shrink-0 active:bg-gray-100 relative">
            <MoreVertical size={20} />
            {isAdmin && (requestCount > 0 || pending.length > 0) ? <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-white" /> : null}
          </button>
        </div>
      )}

      {!searching ? <CommunityPinned pinned={pinned} onJump={(m) => jumpTo(m.id)} /> : null}

      {!searching && isAdmin && pending.length > 0 ? (
        <button onClick={() => setReviewOpen(true)} className="w-full flex items-center gap-3 px-4 py-2.5 bg-amber-50 border-b border-amber-100 text-left active:bg-amber-100">
          <ShieldCheck size={18} className="text-amber-600 shrink-0" />
          <span className="flex-1 text-sm text-amber-800 font-medium">{pending.length} message{pending.length === 1 ? '' : 's'} waiting for approval</span>
          <span className="text-sm font-semibold text-amber-700">Review</span>
        </button>
      ) : null}

      {searching ? (
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {!q && !starredOnly ? <p className="text-center text-gray-400 mt-10 text-sm">Type to search messages in this community.</p> : null}
          {(q || starredOnly) && results.length === 0 ? <p className="text-center text-gray-400 mt-10 text-sm">No messages found.</p> : null}
          {results.map((m) => (
            <button key={m.id} onClick={() => openFromResults(m)} className="w-full text-left px-3 py-2.5 rounded-xl active:bg-gray-100">
              <span className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-brand-purple truncate">{m.sender_id === user.id ? 'You' : m.sender_name || 'Member'}</span>
                <span className="text-[11px] text-gray-400 shrink-0">{new Date(m.created_at).toLocaleDateString([], { day: 'numeric', month: 'short' })}</span>
              </span>
              <span className="block text-sm text-gray-700 truncate">{previewOf(m)}</span>
            </button>
          ))}
        </div>
      ) : (
        <div onScroll={onScroll} className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-1.5 relative">
          {visible.length === 0 ? (
            <p className="text-center text-gray-400 mt-10 text-sm">No messages yet. Say hello!</p>
          ) : (
            visible.map((m, i) => {
              const prev = visible[i - 1]
              const newDay = !prev || !sameDayAs(prev, m)
              const showName = !prev || prev.sender_id !== m.sender_id || newDay || !!prev.removed_at || prev.kind === 'system' || m.kind === 'system'
              const replyTo = m.reply_to ? (byId.get(m.reply_to) || { id: m.reply_to, missing: true }) : null
              return (
                <div key={m.id} ref={(el) => { msgRefs.current[m.id] = el }} className={showName && i > 0 && !newDay ? 'mt-1.5' : ''}>
                  {newDay ? (
                    <p className="text-center my-3"><span className="text-[11px] font-medium text-gray-500 bg-gray-100 rounded-full px-3 py-1">{dayLabel(m.created_at)}</span></p>
                  ) : null}
                  {m.id === unreadAnchor && unreadCount > 0 ? (
                    <p className="text-center my-2"><span className="text-[11px] font-semibold text-brand-purple bg-brand-light rounded-full px-3 py-1">{unreadCount} unread message{unreadCount === 1 ? '' : 's'}</span></p>
                  ) : null}
                  <div className={highlight === m.id ? 'rounded-2xl' : ''}>
                    <CommunityMessageBubble
                      message={m}
                      meId={user.id}
                      isMine={m.sender_id === user.id}
                      senderIsAdmin={adminIds.has(m.sender_id)}
                      showName={showName}
                      highlight={highlight === m.id}
                      onOpen={setActionMsg}
                      replyTo={replyTo}
                      reactions={summarize(reactions[m.id], user.id)}
                      starred={stars.has(m.id)}
                      pattern={pattern}
                      onJump={jumpTo}
                    />
                  </div>
                  {m.status === 'pending' && !m.removed_at ? (
                    <p className={`text-[11px] mt-0.5 ${m.sender_id === user.id ? 'text-right' : ''} text-amber-600`}>Waiting for an admin to approve</p>
                  ) : null}
                </div>
              )
            })
          )}
          <div ref={bottomRef} />
          {showDown ? (
            <button
              onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
              aria-label="Jump to newest"
              className="sticky bottom-2 self-end w-10 h-10 rounded-full bg-white shadow-lg border border-gray-100 flex items-center justify-center"
            >
              <ChevronDown size={20} />
            </button>
          ) : null}
        </div>
      )}

      {isMember ? (
        canPost ? (
          <div className="border-t border-gray-100 bg-white shrink-0" style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
            {mode === 'approval' && !isAdmin ? <p className="text-[11px] text-gray-400 text-center pt-2">Admins approve messages before others see them</p> : null}

            {replyTo ? (
              <div className="flex items-center gap-2 px-3 pt-2">
                <div className="flex-1 min-w-0 border-l-4 border-brand-purple bg-gray-50 rounded-lg px-3 py-1.5">
                  <p className="text-xs font-semibold text-brand-purple truncate">Replying to {replyTo.sender_id === user.id ? 'yourself' : replyTo.sender_name || 'Member'}</p>
                  <p className="text-sm text-gray-600 truncate">{previewOf(replyTo)}</p>
                </div>
                <button onClick={cancelComposer} aria-label="Cancel reply" className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"><X size={18} /></button>
              </div>
            ) : null}

            {editing ? (
              <div className="flex items-center gap-2 px-3 pt-2">
                <div className="flex-1 min-w-0 border-l-4 border-amber-400 bg-amber-50 rounded-lg px-3 py-1.5">
                  <p className="text-xs font-semibold text-amber-700 flex items-center gap-1"><Pencil size={12} /> Editing message</p>
                </div>
                <button onClick={cancelComposer} aria-label="Cancel edit" className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"><X size={18} /></button>
              </div>
            ) : null}

            {mentionOptions.length ? (
              <div className="mx-3 mt-2 bg-white border border-gray-100 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                {mentionOptions.map((m) => (
                  <button key={m.user_id} onClick={() => pickMention(m)} className="w-full flex items-center gap-3 px-3 py-2 text-left active:bg-gray-100">
                    <PersonAvatar p={m.profiles} size={28} />
                    <span className="text-sm font-medium truncate">{m.profiles?.full_name || 'Member'}</span>
                  </button>
                ))}
              </div>
            ) : null}

            {composerEmoji && !voice.recording ? (
              <div className="mx-3 mt-2 rounded-xl border border-gray-100 bg-white">
                <EmojiPicker onPick={insertEmoji} height={230} />
              </div>
            ) : null}

            {voice.recording ? (
              <div className="flex items-center gap-3 px-3 pt-2">
                <button onClick={voice.cancel} aria-label="Cancel recording" className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0"><Trash2 size={18} className="text-red-400" /></button>
                <span className="flex-1 flex items-center gap-2 text-sm font-medium text-red-500"><span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />Recording {clock(voice.seconds)}</span>
                <button onClick={voice.stop} aria-label="Send voice message" className="w-10 h-10 rounded-full bg-brand-purple flex items-center justify-center shrink-0"><Send size={17} className="text-white" /></button>
              </div>
            ) : (
            <div className="flex items-end gap-2 px-3 pt-2">
              <button onClick={() => setAttachOpen(true)} disabled={uploading || !!editing} aria-label="Attach" className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-gray-500 active:bg-gray-100 disabled:opacity-40">
                {uploading ? <Loader2 size={20} className="animate-spin" /> : <Paperclip size={21} />}
              </button>
              <button onClick={() => setComposerEmoji((v) => !v)} aria-label={composerEmoji ? 'Close emojis' : 'Emojis'} aria-pressed={composerEmoji} className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 active:bg-gray-100 ${composerEmoji ? 'text-brand-purple' : 'text-gray-500'}`}>
                <Smile size={21} />
              </button>
              <input ref={photoInputRef} type="file" accept="image/*,video/*" onChange={pickPhoto} className="hidden" />
              <input ref={fileInputRef} type="file" onChange={pickFile} className="hidden" />
              <input
                ref={inputRef}
                value={text}
                onChange={(e) => onType(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                placeholder={editing ? 'Edit your message' : 'Message'}
                maxLength={4000}
                className="flex-1 min-w-0 bg-gray-100 rounded-full px-4 py-2.5 text-[15px] outline-none"
              />
              {text.trim() || editing ? (
                <button onClick={handleSend} disabled={sending || !text.trim()} aria-label={editing ? 'Save edit' : 'Send'} className="w-10 h-10 rounded-full bg-brand-purple flex items-center justify-center shrink-0 disabled:opacity-40">
                  {editing ? <Check size={18} className="text-white" /> : <Send size={17} className="text-white" />}
                </button>
              ) : (
                <button onClick={voice.start} disabled={uploading} aria-label="Record voice message" className="w-10 h-10 rounded-full bg-brand-purple flex items-center justify-center shrink-0 disabled:opacity-40 active:scale-95 transition-transform">
                  <Mic size={18} className="text-white" />
                </button>
              )}
            </div>
            )}
          </div>
        ) : (
          <div className="px-4 py-3.5 border-t border-gray-100 text-center text-sm text-gray-400 flex items-center justify-center gap-2 shrink-0" style={{ paddingBottom: 'max(14px, env(safe-area-inset-bottom))' }}>
            <Lock size={14} /> Only admins can send messages
          </div>
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

      {/* Community menu */}
      {menuOpen ? (
        <BottomSheet onClose={() => setMenuOpen(false)}>
          <SheetAction icon={Info} label="Community info" onClick={() => { setMenuOpen(false); navigate(`/communities/${communityId}/info`) }} />
          <SheetAction icon={ImageIcon} label="Photos, videos and files" onClick={() => { setMenuOpen(false); navigate(`/communities/${communityId}/media`) }} />
          <SheetAction icon={Search} label="Search messages" onClick={() => openSearch(false)} />
          <SheetAction icon={Star} label="Starred messages" onClick={() => openSearch(true)} />
          <SheetAction
            icon={isMutedNow(mutedUntil) ? Bell : BellOff}
            label={isMutedNow(mutedUntil) ? 'Notifications muted' : 'Mute notifications'}
            sub={isMutedNow(mutedUntil) ? 'Tap to change' : undefined}
            onClick={() => { setMenuOpen(false); setMuteOpen(true) }}
          />
          {isAdmin && community.is_private ? <SheetAction icon={Inbox} label="Join requests" sub={requestCount ? `${requestCount} waiting` : undefined} onClick={() => { setMenuOpen(false); navigate(`/communities/${communityId}/requests`) }} /> : null}
          {isAdmin && (mode === 'approval' || pending.length > 0) ? <SheetAction icon={ShieldCheck} label="Messages waiting for approval" sub={pending.length ? `${pending.length} waiting` : 'Nothing waiting'} onClick={() => { setMenuOpen(false); setReviewOpen(true) }} /> : null}
        </BottomSheet>
      ) : null}

      {muteOpen ? (
        <BottomSheet onClose={() => setMuteOpen(false)}>
          <p className="px-4 pb-2 font-semibold">Mute notifications</p>
          <SheetAction icon={BellOff} label="8 hours" onClick={() => setMute('8h')} />
          <SheetAction icon={BellOff} label="1 week" onClick={() => setMute('1w')} />
          <SheetAction icon={BellOff} label="Always" onClick={() => setMute('always')} />
          {isMutedNow(mutedUntil) ? <SheetAction icon={Bell} label="Unmute" onClick={() => setMute('off')} /> : null}
        </BottomSheet>
      ) : null}

      {attachOpen ? (
        <BottomSheet onClose={() => setAttachOpen(false)}>
          <SheetAction icon={ImageIcon} label="Photo or video" onClick={() => { setAttachOpen(false); photoInputRef.current?.click() }} />
          <SheetAction icon={FileText} label="Document" onClick={() => { setAttachOpen(false); fileInputRef.current?.click() }} />
        </BottomSheet>
      ) : null}

{/* Message actions */}
      {sheetMsg ? (
        <BottomSheet onClose={() => setActionMsg(null)}>
          <div className="px-4 pb-2">
            <p className="text-xs font-semibold text-gray-400 truncate">{mineSheet ? 'You' : sheetMsg.sender_name || 'Member'}</p>
            <p className="text-sm text-gray-600 line-clamp-2 break-words">{previewOf(sheetMsg)}</p>
          </div>
          {sheetLive && !sheetPending ? (
            <div className="flex items-center justify-around px-2 pb-3">
              {QUICK_REACTIONS.map((e) => {
                const on = (reactions[sheetMsg.id] ?? []).some((r) => r.user_id === user.id && r.emoji === e)
                return (
                  <button key={e} onClick={() => react(sheetMsg, e)} aria-label={`React ${e}`} className={`w-11 h-11 rounded-full text-2xl flex items-center justify-center ${on ? 'bg-brand-light' : ''}`}>{e}</button>
                )
              })}
              <button onClick={() => { setActionMsg(null); setReactPicker(sheetMsg) }} aria-label="More reactions" className="w-11 h-11 rounded-full flex items-center justify-center bg-gray-100 text-gray-600"><Plus size={20} /></button>
            </div>
          ) : null}
          {canPost && sheetLive && !sheetPending ? <SheetAction icon={Reply} label="Reply" onClick={() => startReply(sheetMsg)} /> : null}
          {sheetMsg.content ? <SheetAction icon={Copy} label="Copy" onClick={() => copyText(sheetMsg)} /> : null}
          {sheetLive && !sheetPending ? <SheetAction icon={Forward} label="Forward" onClick={() => { setForwarding(sheetMsg); setActionMsg(null) }} /> : null}
          {sheetLive && !sheetPending ? (
            <SheetAction icon={Star} label={stars.has(sheetMsg.id) ? 'Remove from starred' : 'Star message'} onClick={() => toggleStar(sheetMsg)} />
          ) : null}
          {mineSheet && canEditMsg(sheetMsg) ? <SheetAction icon={Pencil} label="Edit message" sub="Within 15 minutes" onClick={() => startEdit(sheetMsg)} /> : null}
          {isAdmin && sheetLive && !sheetPending ? (
            sheetMsg.pinned_at
              ? <SheetAction icon={PinOff} label="Unpin message" onClick={() => pin(sheetMsg, false)} />
              : <SheetAction icon={Pin} label="Pin message" sub="Shows at the top for everyone" onClick={() => pin(sheetMsg, true)} />
          ) : null}
          {isAdmin && sheetPending ? <SheetAction icon={Check} label="Approve" onClick={() => review([String(sheetMsg.id)], true)} /> : null}
          {isAdmin && sheetPending ? <SheetAction icon={X} label="Turn down" danger onClick={() => review([String(sheetMsg.id)], false)} /> : null}
          {mineSheet && sheetLive ? <SheetAction icon={Info} label="Message info" onClick={() => openInfo(sheetMsg)} /> : null}
          <SheetAction icon={Trash2} label="Delete for me" onClick={() => { setConfirm({ kind: 'me', m: sheetMsg }); setActionMsg(null) }} />
          {mineSheet && sheetLive ? <SheetAction icon={Trash2} label="Delete for everyone" danger onClick={() => { setConfirm({ kind: 'own', m: sheetMsg }); setActionMsg(null) }} /> : null}
          {isAdmin && !mineSheet && sheetLive && !sheetPending ? <SheetAction icon={Trash2} label="Remove message" sub="Everyone sees that an admin removed it" danger onClick={() => { setConfirm({ kind: 'admin', m: sheetMsg }); setActionMsg(null) }} /> : null}
        </BottomSheet>
      ) : null}

      {/* Full emoji list to react with */}
      {reactPicker ? (
        <BottomSheet onClose={() => setReactPicker(null)}>
          <p className="px-4 pb-2 font-semibold">React</p>
          <EmojiPicker height={300} selected={(reactions[reactPicker.id] ?? []).find((r) => r.user_id === user.id)?.emoji ?? null} onPick={(e) => { const target = reactPicker; setReactPicker(null); react(target, e) }} />
        </BottomSheet>
      ) : null}

      {/* Message info: who has read it */}
      {infoMsg ? (
        <BottomSheet onClose={() => setInfoMsg(null)}>
          <div className="px-4 pb-3">
            <p className="font-semibold">Message info</p>
            <p className="text-xs text-gray-400">Sent {new Date(infoMsg.created_at).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
            <p className="text-sm text-gray-600 line-clamp-2 break-words mt-1">{previewOf(infoMsg)}</p>
          </div>
          {(() => {
            const others = members.filter((m) => m.user_id !== infoMsg.sender_id)
            const withTime = others.map((m) => ({ m, at: reads.find((r) => r.user_id === m.user_id)?.last_read_at ?? null }))
            const seen = withTime.filter((x) => x.at && Date.parse(x.at) >= Date.parse(infoMsg.created_at))
            const unseen = withTime.filter((x) => !seen.includes(x))
            const row = (x, label) => (
              <div key={x.m.user_id} className="flex items-center gap-3 px-4 py-2">
                <PersonAvatar p={x.m.profiles} size={36} />
                <span className="flex-1 min-w-0 truncate text-[15px]">{x.m.user_id === user.id ? 'You' : x.m.profiles?.full_name || 'Member'}</span>
                {label ? <span className="text-xs text-gray-400 shrink-0">{label}</span> : null}
              </div>
            )
            return (
              <>
                <p className="px-4 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">Read by {seen.length}</p>
                {seen.map((x) => row(x, new Date(x.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })))}
                <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">Not read yet · {unseen.length}</p>
                {unseen.map((x) => row(x, ''))}
              </>
            )
          })()}
        </BottomSheet>
      ) : null}

      {confirm?.kind === 'me' ? <ConfirmSheet title="Delete for you?" body="It is hidden from your view only. Others still see it." confirmLabel="Delete for me" danger onConfirm={() => deleteForMe(confirm.m)} onClose={() => setConfirm(null)} /> : null}
      {confirm?.kind === 'own' ? <ConfirmSheet title="Delete for everyone?" body="It is deleted for everyone in the community." confirmLabel="Delete" danger onConfirm={() => deleteForEveryone(confirm.m)} onClose={() => setConfirm(null)} /> : null}
      {confirm?.kind === 'admin' ? <ConfirmSheet title="Remove this message?" body="It is removed for everyone. The chat will show that an admin removed it." confirmLabel="Remove" danger onConfirm={() => removeAsAdmin(confirm.m)} onClose={() => setConfirm(null)} /> : null}

      {callOpen ? <CommunityCallSheet members={members.filter((m) => m.user_id !== user.id)} onClose={() => setCallOpen(false)} /> : null}
      {reviewOpen ? <CommunityReviewSheet items={pending} busy={reviewBusy} onApprove={(ids) => review(ids, true)} onReject={(ids) => review(ids, false)} onClose={() => setReviewOpen(false)} /> : null}
      {forwarding ? <ForwardPicker onClose={() => setForwarding(null)} onSend={handleForwardSend} /> : null}

      {toast ? <div className="absolute left-1/2 -translate-x-1/2 z-[70] bg-gray-900 text-white text-sm rounded-full px-4 py-2 shadow-lg max-w-[90%] text-center" style={{ bottom: 84 }}>{toast}</div> : null}
    </div>
  )
      }
