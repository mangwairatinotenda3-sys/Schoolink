import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Camera, Copy, Share2, UserPlus, LogOut, Trash2, Pencil, Image as ImageIcon, MessageCircle, User, ShieldCheck, ShieldOff, UserMinus, ChevronRight, Loader2, Inbox } from 'lucide-react'
import ScreenHeader from '../components/ScreenHeader.jsx'
import PersonAvatar from '../components/PersonAvatar.jsx'
import BottomSheet, { SheetAction } from '../components/BottomSheet.jsx'
import { ConfirmSheet } from '../components/FamilySheets.jsx'
import CommunityAddPeople from '../components/CommunityAddPeople.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

function Toggle({ on, onChange, label, sub, busy }) {
  return (
    <button type="button" role="switch" aria-checked={on} disabled={busy} onClick={() => onChange(!on)} className="w-full flex items-center gap-3 py-3.5 text-left disabled:opacity-50">
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-medium">{label}</span>
        {sub ? <span className="block text-xs text-gray-400 mt-0.5">{sub}</span> : null}
      </span>
      <span className={`relative w-12 h-7 rounded-full shrink-0 transition-colors ${on ? 'bg-brand-purple' : 'bg-gray-200'}`}>
        <span className="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all" style={{ left: on ? 22 : 2 }} />
      </span>
    </button>
  )
}

function QuickAction({ icon: Icon, label, onClick }) {
  return (
    <button onClick={onClick} className="flex-1 flex flex-col items-center gap-1.5 rounded-2xl border border-gray-100 py-3 active:bg-gray-50">
      <Icon size={20} className="text-brand-purple" />
      <span className="text-xs font-medium text-gray-700">{label}</span>
    </button>
  )
}

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
  const setPosting = (adminsOnly) => run(() => supabase.rpc('community_update_info', { p_community: String(communityId), p_name: community.name, p_description: community.description || '', p_posting: adminsOnly ? 'admins_only' : 'everyone' }), adminsOnly ? 'Only admins can send messages' : 'Everyone can send messages')
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
        <ScreenHeader title="Group info" onBack={() => navigate(-1)} />
        <div className="flex-1 flex items-center justify-center text-gray-400"><Loader2 className="animate-spin" /></div>
      </div>
    )
  }

  const target = sheet?.member

  return (
    <div className="app-shell relative">
      <ScreenHeader
        title="Group info"
        onBack={() => navigate(-1)}
        right={isAdmin ? <button onClick={() => setEdit({ name: community.name || '', description: community.description || '' })} aria-label="Edit group" className="w-10 h-10 rounded-full flex items-center justify-center"><Pencil size={19} /></button> : null}
      />

      <div className="flex-1 overflow-y-auto px-4" style={{ paddingBottom: 40 }}>
        <div className="flex flex-col items-center pt-5 pb-4">
          <div className="relative">
            {community.avatar_url ? <img src={community.avatar_url} alt="" className="w-28 h-28 rounded-full object-cover" /> : <span className="w-28 h-28 rounded-full bg-brand-light flex items-center justify-center text-4xl">🏘️</span>}
            {isAdmin ? (
              <button onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="Change picture" className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-brand-purple flex items-center justify-center border-2 border-white">
                {uploading ? <Loader2 size={15} className="animate-spin text-white" /> : <Camera size={16} className="text-white" />}
              </button>
            ) : null}
            <input ref={fileRef} type="file" accept="image/*" onChange={changePhoto} className="hidden" />
          </div>
          <p className="font-bold text-2xl mt-4 text-center break-words max-w-full">{community.name}</p>
          <p className="text-sm text-gray-400 mt-0.5">Community · {members.length} participant{members.length === 1 ? '' : 's'}{community.is_private ? ' · Private' : ''}</p>
          {community.description ? <p className="text-[15px] text-gray-700 text-center mt-3 whitespace-pre-wrap break-words">{community.description}</p> : null}
        </div>

        <div className="flex gap-2.5">
          {isAdmin ? <QuickAction icon={UserPlus} label="Add" onClick={() => setAdding(true)} /> : null}
          <QuickAction icon={Share2} label="Share link" onClick={shareInvite} />
          <QuickAction icon={ImageIcon} label="Media" onClick={() => navigate(`/communities/${communityId}/media`)} />
        </div>

        {isAdmin ? (
          <div className="mt-4 rounded-2xl border border-gray-100 px-4 divide-y divide-gray-50">
            <Toggle on={community.posting_mode === 'admins_only'} busy={busy} onChange={setPosting} label="Only admins can send messages" sub="Everyone else can read but not post" />
            {community.is_private ? (
              <button onClick={() => navigate(`/communities/${communityId}/requests`)} className="w-full flex items-center gap-3 py-3.5 text-left">
                <Inbox size={19} className="text-gray-500" />
                <span className="flex-1 text-[15px] font-medium">Join requests</span>
                {pendingCount > 0 ? <span className="bg-brand-purple text-white text-xs font-semibold rounded-full px-2 py-0.5">{pendingCount}</span> : null}
                <ChevronRight size={16} className="text-gray-300" />
              </button>
            ) : null}
          </div>
        ) : null}

        <button onClick={copyInvite} className="mt-4 w-full flex items-center gap-3 rounded-2xl border border-gray-100 px-4 py-3.5 text-left active:bg-gray-50">
          <Copy size={18} className="text-gray-500 shrink-0" />
          <span className="flex-1 min-w-0">
            <span className="block text-[15px] font-medium">Invite link</span>
            <span className="block text-xs text-gray-400 truncate">{inviteLink()}</span>
          </span>
        </button>

        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mt-6 mb-1 px-1">{members.length} participants</p>
        {isAdmin ? (
          <button onClick={() => setAdding(true)} className="w-full flex items-center gap-3 py-3 text-left active:bg-gray-50">
            <span className="w-11 h-11 rounded-full bg-brand-purple flex items-center justify-center"><UserPlus size={19} className="text-white" /></span>
            <span className="font-medium text-[15px]">Add participants</span>
          </button>
        ) : null}
        <div>
          {sorted.map((m) => {
            const mine = m.user_id === user.id
            const person = mine ? { full_name: profile?.full_name, avatar_url: profile?.avatar_url } : m.profiles
            return (
              <button key={m.user_id} onClick={() => !mine && setSheet({ member: m })} disabled={mine} className="w-full flex items-center gap-3 py-2.5 text-left active:bg-gray-50 disabled:active:bg-transparent">
                <PersonAvatar p={person} size={44} />
                <span className="flex-1 min-w-0">
                  <span className="block font-medium text-[15px] truncate">{mine ? 'You' : m.profiles?.full_name || 'Schoolink member'}</span>
                  <span className="block text-xs text-gray-400 truncate">{(mine ? profile?.role : m.profiles?.role) || 'Member'}</span>
                </span>
                {m.role === 'admin' ? <span className="text-[11px] font-semibold text-brand-purple bg-brand-light rounded-full px-2.5 py-1 shrink-0">{m.user_id === community.created_by ? 'Creator · Admin' : 'Admin'}</span> : null}
              </button>
            )
          })}
        </div>

        <div className="h-px bg-gray-100 my-4" />
        <button onClick={() => setConfirm('leave')} className="w-full flex items-center gap-3 text-red-500 py-3.5 font-medium"><LogOut size={19} /> Exit community</button>
        {isAdmin ? <button onClick={() => setConfirm('delete')} className="w-full flex items-center gap-3 text-red-600 py-3.5 font-medium"><Trash2 size={19} /> Delete community</button> : null}
      </div>

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
