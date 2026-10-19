import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Camera, Copy, Share2, UserPlus, LogOut, Trash2, Pencil, Image as ImageIcon, MessageCircle, User, ShieldCheck, ShieldOff, UserMinus, ChevronRight, Loader2, Inbox, Search, X, Link2, FileText, Play, Lock } from 'lucide-react'
import ZoomImage from '../components/ZoomImage.jsx'
import PersonAvatar from '../components/PersonAvatar.jsx'
import BottomSheet, { SheetAction } from '../components/BottomSheet.jsx'
import { ConfirmSheet } from '../components/FamilySheets.jsx'
import CommunityAddPeople from '../components/CommunityAddPeople.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

// A round action button with its label underneath, like the row under a WhatsApp group's name.
function ActionButton({ icon: Icon, label, onClick }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5 w-20 active:opacity-70">
      <span className="w-full h-14 rounded-full bg-gray-100 flex items-center justify-center"><Icon size={22} className="text-gray-700" /></span>
      <span className="text-[12.5px] text-gray-600">{label}</span>
    </button>
  )
}

const urlRegex = /(https?:\/\/[^\s]+)/g
const MEDIA_TABS = ['Photos', 'Videos', 'Files', 'Links']

// Group info, laid out like WhatsApp: admins run the group, everyone sees who is in it.
export default function CommunityGroupInfo() {
  const { communityId } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const fileRef = useRef(null)

  const [community, setCommunity] = useState(null)
  const [members, setMembers] = useState([])
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sheet, setSheet] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [adding, setAdding] = useState(false)
  const [edit, setEdit] = useState(null)
  const [toast, setToast] = useState('')
  const [tab, setTab] = useState('Members')
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const [mediaRows, setMediaRows] = useState(null)
  const [mediaTab, setMediaTab] = useState('Photos')
  const [viewer, setViewer] = useState(null)
  const searchRef = useRef(null)

  const me = members.find((m) => m.user_id === user.id)
  const isAdmin = me?.role === 'admin'
  const admins = members.filter((m) => m.role === 'admin')
  const sorted = [...members].sort((a, b) => (a.user_id === user.id ? -1 : b.user_id === user.id ? 1 : a.role === b.role ? (a.profiles?.full_name || '').localeCompare(b.profiles?.full_name || '') : a.role === 'admin' ? -1 : 1))

  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(''), 2600)
    return () => clearTimeout(t)
  }, [toast])

  async function loadAll() {
    const { data: comm } = await supabase.from('communities').select('*').eq('id', communityId).maybeSingle()
    setCommunity(comm)
    const { data: rows } = await supabase.from('community_members').select('user_id, role, profiles(full_name, role, avatar_url)').eq('community_id', communityId)
    setMembers(rows ?? [])
    if (comm?.is_private) {
      const { count } = await supabase.from('community_join_requests').select('*', { count: 'exact', head: true }).eq('community_id', communityId).eq('status', 'pending')
      setPendingCount(count ?? 0)
    }
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [communityId])

  // Photos, videos, files and links are only loaded the first time the Media tab is opened.
  useEffect(() => {
    if (tab !== 'Media' || mediaRows) return
    supabase
      .from('community_messages')
      .select('id, media_url, media_type, content, created_at')
      .eq('community_id', communityId)
      .is('removed_at', null)
      .or('status.is.null,status.neq.pending')
      .order('created_at', { ascending: false })
      .limit(400)
      .then(({ data }) => setMediaRows(data ?? []))
  }, [tab, communityId])

  useEffect(() => {
    if (searching) searchRef.current?.focus()
  }, [searching])

  function openSearch() {
    setTab('Members')
    setSearching(true)
  }

  function closeSearch() {
    setSearching(false)
    setQuery('')
  }

  async function run(fn, okText) {
    setSheet(null)
    setConfirm(null)
    setBusy(true)
    const { data, error } = await fn()
    setBusy(false)
    if (error || (data && data.ok === false)) { setToast(error?.message || data?.error || 'Something went wrong. Try again.'); return false }
    if (okText) setToast(okText)
    await loadAll()
    return true
  }

  const setRole = (m, role) => run(() => supabase.rpc('community_set_role', { p_community: String(communityId), p_user: m.user_id, p_role: role }), role === 'admin' ? `${m.profiles?.full_name || 'They'} is now an admin` : 'Admin removed')
  const removeMember = (m) => run(() => supabase.rpc('community_remove_member', { p_community: String(communityId), p_user: m.user_id }), `${m.profiles?.full_name || 'Member'} removed`)
  const POSTING_TEXT = { everyone: 'Everyone can send messages', admins_only: 'Only admins can send messages', approval: 'Messages need an admin to approve them' }
  const setPosting = (mode) => run(() => supabase.rpc('community_update_info', { p_community: String(communityId), p_name: community.name, p_description: community.description || '', p_posting: mode }), POSTING_TEXT[mode])
  const saveInfo = async () => {
    const ok = await run(() => supabase.rpc('community_update_info', { p_community: String(communityId), p_name: edit.name, p_description: edit.description, p_posting: community.posting_mode }), 'Saved')
    if (ok) setEdit(null)
  }

  async function leave() {
    setConfirm(null)
    setBusy(true)
    const { data, error } = await supabase.rpc('community_leave', { p_community: String(communityId) })
    setBusy(false)
    if (error || !data?.ok) { setToast(error?.message || 'Could not leave. Try again.'); return }
    navigate('/communities', { replace: true })
  }

  async function deleteCommunity() {
    setConfirm(null)
    setBusy(true)
    const { data, error } = await supabase.rpc('community_delete', { p_community: String(communityId) })
    setBusy(false)
    if (error || !data?.ok) { setToast(error?.message || data?.error || 'Could not delete. Try again.'); return }
    navigate('/communities', { replace: true })
  }

  async function changePhoto(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `${communityId}/avatar.${ext}`
    const { error: upErr } = await supabase.storage.from('community-media').upload(path, file, { upsert: true })
    if (upErr) { setUploading(false); setToast('Could not upload the picture.'); return }
    const { data } = supabase.storage.from('community-media').getPublicUrl(path)
    const url = `${data.publicUrl}?t=${Date.now()}`
    const { error } = await supabase.from('communities').update({ avatar_url: url }).eq('id', communityId)
    setUploading(false)
    if (error) { setToast('Could not save the picture.'); return }
    setCommunity((c) => ({ ...c, avatar_url: url }))
  }

  function inviteLink() {
    return `${window.location.origin}${window.location.pathname}#/communities/join/${community?.invite_code}`
  }

  async function copyInvite() {
    try { await navigator.clipboard.writeText(inviteLink()); setToast('Invite link copied') } catch { setToast('Could not copy the link') }
  }

  function shareInvite() {
    if (navigator.share) navigator.share({ title: community.name, text: `Join ${community.name} on Schoolink`, url: inviteLink() }).catch(() => {})
    else copyInvite()
  }

  if (loading || !community) {
    return (
      <div className="app-shell">
        <div className="px-3 flex items-center" style={{ height: 56 }}>
          <button onClick={() => navigate(-1)} aria-label="Back" className="w-10 h-10 rounded-full flex items-center justify-center"><ChevronLeft size={24} /></button>
        </div>
        <div className="flex-1 flex items-center justify-center text-gray-400"><Loader2 className="animate-spin" /></div>
      </div>
    )
  }

  const target = sheet?.member
  const creator = members.find((m) => m.user_id === community.created_by)
  const creatorName = community.created_by === user.id ? 'You' : creator?.profiles?.full_name || 'a member'
  const createdOn = community.created_at ? new Date(community.created_at).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : ''
  const q = query.trim().toLowerCase()
  const shown = q ? sorted.filter((m) => (m.user_id === user.id ? 'you' : m.profiles?.full_name || '').toLowerCase().includes(q)) : sorted

  const rows = mediaRows ?? []
  const photos = rows.filter((m) => m.media_type === 'image' && m.media_url)
  const videos = rows.filter((m) => m.media_type === 'video' && m.media_url)
  const files = rows.filter((m) => m.media_type === 'file' && m.media_url)
  const links = rows.flatMap((m) => (m.content?.match(urlRegex) ?? []).map((url) => ({ id: m.id + url, url })))
  const mediaCount = { Photos: photos.length, Videos: videos.length, Files: files.length, Links: links.length }

  return (
    <div className="app-shell relative">
      <div className="flex items-center justify-between px-3 shrink-0" style={{ height: 56 }}>
        <button onClick={() => navigate(-1)} aria-label="Back" className="w-10 h-10 rounded-full flex items-center justify-center"><ChevronLeft size={24} /></button>
        {isAdmin ? <button onClick={() => setEdit({ name: community.name || '', description: community.description || '' })} aria-label="Edit community" className="w-10 h-10 rounded-full flex items-center justify-center"><Pencil size={19} /></button> : <span className="w-10" />}
      </div>

      <div className="flex-1 overflow-y-auto" style={{ paddingBottom: 40 }}>
        <div className="flex flex-col items-center px-6 pb-5">
          <div className="relative">
            {community.avatar_url ? <img src={community.avatar_url} alt="" className="w-36 h-36 rounded-full object-cover" /> : <span className="w-36 h-36 rounded-full bg-brand-light flex items-center justify-center text-5xl">🏘️</span>}
            {isAdmin ? (
              <button onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="Change picture" className="absolute bottom-1 right-1 w-10 h-10 rounded-full bg-brand-purple flex items-center justify-center border-2 border-white">
                {uploading ? <Loader2 size={16} className="animate-spin text-white" /> : <Camera size={17} className="text-white" />}
              </button>
            ) : null}
            <input ref={fileRef} type="file" accept="image/*" onChange={changePhoto} className="hidden" />
          </div>
          <h1 className="font-bold text-[26px] leading-tight mt-4 text-center break-words max-w-full">{community.name}</h1>
          <p className="text-[14px] text-gray-400 mt-1">Community · {members.length} member{members.length === 1 ? '' : 's'}{community.is_private ? ' · Private' : ''}</p>
          {community.description ? <p className="text-[15px] text-gray-600 text-center mt-3 whitespace-pre-wrap break-words max-w-full">{community.description}</p> : null}
        </div>

        <div className="flex justify-center gap-3 px-4 pb-5">
          {isAdmin ? <ActionButton icon={UserPlus} label="Add" onClick={() => setAdding(true)} /> : null}
          <ActionButton icon={Share2} label="Share" onClick={shareInvite} />
          <ActionButton icon={Search} label="Search" onClick={openSearch} />
          <ActionButton icon={ImageIcon} label="Media" onClick={() => setTab('Media')} />
        </div>

        <div className="sticky top-0 z-10 bg-white flex border-y border-gray-100">
          {['Members', 'Media', 'Settings'].map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`flex-1 py-3.5 text-[15px] font-semibold relative ${tab === t ? 'text-brand-purple' : 'text-gray-400'}`}>
              {t}
              {tab === t ? <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-[3px] rounded-full bg-brand-purple" /> : null}
            </button>
          ))}
        </div>

        {tab === 'Members' ? (
          <div className="px-4">
            <div className="flex items-center justify-between py-3 min-h-[52px]">
              {searching ? (
                <div className="flex-1 flex items-center gap-2 bg-gray-100 rounded-full px-4 py-2">
                  <Search size={16} className="text-gray-400 shrink-0" />
                  <input ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search members" className="flex-1 min-w-0 bg-transparent outline-none text-[15px]" />
                  <button onClick={closeSearch} aria-label="Close search"><X size={18} className="text-gray-400" /></button>
                </div>
              ) : (
                <>
                  <p className="text-[14px] text-gray-400">{members.length} member{members.length === 1 ? '' : 's'}</p>
                  <button onClick={openSearch} aria-label="Search members" className="w-9 h-9 flex items-center justify-center"><Search size={20} className="text-gray-500" /></button>
                </>
              )}
            </div>

            {!q && isAdmin ? (
              <button onClick={() => setAdding(true)} className="w-full flex items-center gap-4 py-2.5 text-left active:bg-gray-50">
                <span className="w-11 h-11 rounded-full bg-brand-purple flex items-center justify-center"><UserPlus size={19} className="text-white" /></span>
                <span className="font-medium text-[16px]">Add members</span>
              </button>
            ) : null}
            {!q ? (
              <button onClick={shareInvite} className="w-full flex items-center gap-4 py-2.5 text-left active:bg-gray-50">
                <span className="w-11 h-11 rounded-full bg-brand-purple flex items-center justify-center"><Link2 size={19} className="text-white" /></span>
                <span className="font-medium text-[16px]">Invite to community via link</span>
              </button>
            ) : null}

            {shown.length === 0 ? <p className="text-center text-gray-400 py-10 text-sm">No one matches “{query.trim()}”.</p> : null}
            {shown.map((m) => {
              const mine = m.user_id === user.id
              const person = mine ? { full_name: profile?.full_name, avatar_url: profile?.avatar_url } : m.profiles
              return (
                <button key={m.user_id} onClick={() => !mine && setSheet({ member: m })} disabled={mine} className="w-full flex items-center gap-4 py-2.5 text-left active:bg-gray-50 disabled:active:bg-transparent">
                  <PersonAvatar p={person} size={48} />
                  <span className="flex-1 min-w-0">
                    <span className="block font-medium text-[16px] truncate">{mine ? 'You' : m.profiles?.full_name || 'Schoolink member'}</span>
                    <span className="block text-[13px] text-gray-400 truncate">{(mine ? profile?.role : m.profiles?.role) || 'Member'}</span>
                  </span>
                  {m.role === 'admin' ? <span className="text-[11px] font-medium text-brand-purple bg-brand-light rounded-md px-2 py-1 shrink-0">{m.user_id === community.created_by ? 'Creator' : 'Community Admin'}</span> : null}
                </button>
              )
            })}
          </div>
        ) : null}

        {tab === 'Media' ? (
          <div className="pt-3">
            <div className="flex gap-2 px-4 pb-3 overflow-x-auto">
              {MEDIA_TABS.map((t) => (
                <button key={t} onClick={() => setMediaTab(t)} className={`shrink-0 rounded-full px-4 py-1.5 text-[13.5px] font-semibold ${mediaTab === t ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-600'}`}>
                  {t}{mediaRows ? ` · ${mediaCount[t]}` : ''}
                </button>
              ))}
            </div>
            {!mediaRows ? (
              <div className="py-12 flex justify-center text-gray-400"><Loader2 className="animate-spin" /></div>
            ) : mediaTab === 'Photos' ? (
              photos.length === 0 ? <p className="text-center text-gray-400 py-12 text-sm">No photos yet.</p> : (
                <div className="grid grid-cols-3 gap-px">
                  {photos.map((p) => (
                    <button key={p.id} onClick={() => setViewer({ type: 'image', url: p.media_url })} className="relative bg-gray-100 overflow-hidden" style={{ aspectRatio: '1 / 1' }}>
                      <img src={p.media_url} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )
            ) : mediaTab === 'Videos' ? (
              videos.length === 0 ? <p className="text-center text-gray-400 py-12 text-sm">No videos yet.</p> : (
                <div className="grid grid-cols-3 gap-px">
                  {videos.map((v) => (
                    <button key={v.id} onClick={() => setViewer({ type: 'video', url: v.media_url })} className="relative bg-neutral-800 overflow-hidden" style={{ aspectRatio: '1 / 1' }}>
                      <video src={`${v.media_url}#t=0.1`} preload="metadata" muted playsInline className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
                      <span className="absolute inset-0 flex items-center justify-center"><span className="w-9 h-9 rounded-full bg-black/50 flex items-center justify-center"><Play size={16} fill="white" className="text-white" /></span></span>
                    </button>
                  ))}
                </div>
              )
            ) : mediaTab === 'Files' ? (
              files.length === 0 ? <p className="text-center text-gray-400 py-12 text-sm">No files yet.</p> : (
                <div className="px-4 divide-y divide-gray-100">
                  {files.map((f) => (
                    <a key={f.id} href={f.media_url} target="_blank" rel="noreferrer" className="flex items-center gap-3 py-3">
                      <span className="w-10 h-10 rounded-full bg-brand-light flex items-center justify-center shrink-0"><FileText size={18} className="text-brand-purple" /></span>
                      <span className="min-w-0">
                        <span className="block text-[15px] truncate">{f.content || 'Shared file'}</span>
                        <span className="block text-xs text-gray-400">{new Date(f.created_at).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </span>
                    </a>
                  ))}
                </div>
              )
            ) : links.length === 0 ? (
              <p className="text-center text-gray-400 py-12 text-sm">No links shared yet.</p>
            ) : (
              <div className="px-4 divide-y divide-gray-100">
                {links.map((l) => (
                  <a key={l.id} href={l.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 py-3">
                    <span className="w-10 h-10 rounded-full bg-brand-light flex items-center justify-center shrink-0"><Link2 size={18} className="text-brand-purple" /></span>
                    <span className="text-[15px] text-brand-purple truncate">{l.url}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {tab === 'Settings' ? (
          <div className="pt-1">
            <div className="px-4 py-4">
              <div className="flex items-center gap-4">
                <span className="w-6 flex justify-center"><Lock size={21} className="text-gray-500" /></span>
                <div className="min-w-0">
                  <p className="text-[16px]">Who can send messages</p>
                  <p className="text-[13px] text-gray-400">{POSTING_TEXT[community.posting_mode || 'everyone']}</p>
                </div>
              </div>
              {isAdmin ? (
                <div className="mt-2 ml-10 space-y-0.5">
                  {[['everyone', 'Everyone', 'All members can post'], ['approval', 'Admins approve each message', 'Messages from members wait until an admin approves them'], ['admins_only', 'Only admins', 'Everyone else can read but not post']].map(([k, label, sub]) => {
                    const on = (community.posting_mode || 'everyone') === k
                    return (
                      <button key={k} type="button" disabled={busy} onClick={() => !on && setPosting(k)} className="w-full flex items-center gap-3 py-2 text-left disabled:opacity-50">
                        <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${on ? 'border-brand-purple' : 'border-gray-300'}`}>{on ? <span className="w-2.5 h-2.5 rounded-full bg-brand-purple" /> : null}</span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{label}</span>
                          <span className="block text-xs text-gray-400">{sub}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </div>

            {isAdmin && community.is_private ? (
              <button onClick={() => navigate(`/communities/${communityId}/requests`)} className="w-full flex items-center gap-4 px-4 py-3.5 text-left active:bg-gray-50 border-t border-gray-100">
                <span className="w-6 flex justify-center"><Inbox size={21} className="text-gray-500" /></span>
                <span className="flex-1 text-[16px]">Join requests</span>
                {pendingCount > 0 ? <span className="bg-brand-purple text-white text-xs font-semibold rounded-full px-2 py-0.5">{pendingCount}</span> : null}
                <ChevronRight size={16} className="text-gray-300" />
              </button>
            ) : null}

            <button onClick={copyInvite} className="w-full flex items-center gap-4 px-4 py-3.5 text-left active:bg-gray-50 border-t border-gray-100">
              <span className="w-6 flex justify-center"><Copy size={20} className="text-gray-500" /></span>
              <span className="flex-1 min-w-0">
                <span className="block text-[16px]">Invite link</span>
                <span className="block text-[13px] text-gray-400 truncate">{inviteLink()}</span>
              </span>
            </button>

            <button onClick={() => navigate(`/communities/${communityId}/media`)} className="w-full flex items-center gap-4 px-4 py-3.5 text-left active:bg-gray-50 border-t border-gray-100">
              <span className="w-6 flex justify-center"><ImageIcon size={20} className="text-gray-500" /></span>
              <span className="flex-1 text-[16px]">Media, files and links</span>
              <ChevronRight size={16} className="text-gray-300" />
            </button>

            <div className="border-t border-gray-100 mt-1">
              <button onClick={() => setConfirm('leave')} className="w-full flex items-center gap-4 px-4 py-4 text-red-500 text-[16px]"><span className="w-6 flex justify-center"><LogOut size={21} /></span> Exit community</button>
              {isAdmin ? <button onClick={() => setConfirm('delete')} className="w-full flex items-center gap-4 px-4 py-4 text-red-500 text-[16px]"><span className="w-6 flex justify-center"><Trash2 size={21} /></span> Delete community</button> : null}
            </div>
            <p className="px-4 pt-3 pb-2 text-[13px] text-gray-400">Created by {creatorName}{createdOn ? `, ${createdOn}` : ''}</p>
          </div>
        ) : null}
      </div>

      {viewer ? (
        <div className="fixed inset-0 z-[80] bg-black flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 shrink-0">
            <button onClick={() => setViewer(null)} aria-label="Close" className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center"><X size={20} className="text-white" /></button>
            <a href={viewer.url} target="_blank" rel="noreferrer" className="text-xs text-white/80 underline">Open original</a>
          </div>
          <div className="flex-1 min-h-0 flex items-center justify-center">
            {viewer.type === 'image' ? <ZoomImage src={viewer.url} /> : <video src={viewer.url} controls autoPlay playsInline className="max-h-full max-w-full" />}
          </div>
        </div>
      ) : null}

      {sheet && target ? (
        <BottomSheet onClose={() => setSheet(null)}>
          <div className="flex items-center gap-3 px-4 pb-2">
            <PersonAvatar p={target.profiles} size={44} />
            <div className="min-w-0">
              <p className="font-semibold truncate">{target.profiles?.full_name || 'Schoolink member'}</p>
              <p className="text-xs text-gray-400">{target.role === 'admin' ? 'Admin' : 'Participant'}</p>
            </div>
          </div>
          <SheetAction icon={MessageCircle} label="Message" onClick={() => navigate(`/chats/${target.user_id}`)} />
          <SheetAction icon={User} label="View profile" onClick={() => navigate(`/users/${target.user_id}`)} />
          {isAdmin && target.role !== 'admin' ? <SheetAction icon={ShieldCheck} label="Make group admin" onClick={() => setRole(target, 'admin')} /> : null}
          {isAdmin && target.role === 'admin' && target.user_id !== community.created_by ? <SheetAction icon={ShieldOff} label="Dismiss as admin" onClick={() => setRole(target, 'member')} /> : null}
          {isAdmin && target.user_id !== community.created_by ? <SheetAction icon={UserMinus} label={`Remove ${(target.profiles?.full_name || 'member').split(' ')[0]}`} danger onClick={() => { setSheet(null); setConfirm({ remove: target }) }} /> : null}
        </BottomSheet>
      ) : null}

      {edit ? (
        <BottomSheet onClose={() => setEdit(null)}>
          <div className="px-3">
            <p className="font-semibold text-lg">Edit community</p>
            <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} maxLength={80} placeholder="Name" className="w-full mt-4 bg-gray-100 rounded-xl px-4 py-3 text-[15px] outline-none" />
            <textarea value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} rows={3} maxLength={500} placeholder="Description" className="w-full mt-3 bg-gray-100 rounded-xl px-4 py-3 text-[15px] outline-none resize-none" />
            <button onClick={saveInfo} disabled={busy || edit.name.trim().length < 2} className="w-full mt-4 bg-brand-purple text-white font-semibold py-3.5 rounded-full disabled:opacity-40 flex items-center justify-center">
              {busy ? <Loader2 size={18} className="animate-spin" /> : 'Save'}
            </button>
            <button onClick={() => setEdit(null)} className="w-full mt-1 py-3.5 text-gray-500 font-medium">Cancel</button>
          </div>
        </BottomSheet>
      ) : null}

      {confirm === 'leave' ? (
        <ConfirmSheet title="Exit this community?" body={isAdmin && admins.length <= 1 && members.length > 1 ? 'You are the only admin. The person who joined first will become the admin.' : 'You will stop getting its messages.'} confirmLabel="Exit" danger onConfirm={leave} onClose={() => setConfirm(null)} />
      ) : null}
      {confirm === 'delete' ? (
        <ConfirmSheet title="Delete this community?" body="It is deleted for everyone, with all its messages. This cannot be undone." confirmLabel="Delete" danger onConfirm={deleteCommunity} onClose={() => setConfirm(null)} />
      ) : null}
      {confirm?.remove ? (
        <ConfirmSheet title={`Remove ${confirm.remove.profiles?.full_name || 'this person'}?`} body="They will no longer be in this community." confirmLabel="Remove" danger onConfirm={() => removeMember(confirm.remove)} onClose={() => setConfirm(null)} />
      ) : null}

      {adding ? (
        <CommunityAddPeople
          communityId={communityId}
          meId={user.id}
          schoolId={profile?.school_id}
          memberIds={members.map((m) => m.user_id)}
          onClose={() => setAdding(false)}
          onAdded={(n) => { setAdding(false); setToast(`${n} ${n === 1 ? 'person' : 'people'} added`); loadAll() }}
        />
      ) : null}

      {toast ? <div className="absolute left-1/2 -translate-x-1/2 z-[70] bg-gray-900 text-white text-sm rounded-full px-4 py-2 shadow-lg max-w-[90%] text-center" style={{ bottom: 30 }}>{toast}</div> : null}
    </div>
  )
}
