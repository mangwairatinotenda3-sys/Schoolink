import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, MoreVertical, MessageSquare, Share2, Link2, Ban, Eye, CircleDot, Lock, UserCheck, UserPlus, ShieldCheck } from 'lucide-react'
import BottomSheet, { SheetAction } from '../components/BottomSheet.jsx'
import ProfileHeader from '../components/ProfileHeader.jsx'
import ProfileContent from '../components/ProfileContent.jsx'
import AvatarViewer from '../components/AvatarViewer.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { isSchoolMember } from '../lib/permissions.js'
import { canViewStatus } from '../lib/statusUtils.js'
import { useIsOnline } from '../lib/presence.jsx'

function profileLink(id) {
  return `${window.location.href.split('#')[0]}#/users/${id}`
}

function Skeleton() {
  return (
    <div className="animate-pulse">
      <div className="w-full bg-gray-200" style={{ aspectRatio: '3 / 1', minHeight: 132 }} />
      <div className="px-4" style={{ marginTop: -46 }}>
        <div className="w-[104px] h-[104px] rounded-full bg-gray-300 border-4 border-white" />
        <div className="h-5 w-40 bg-gray-200 rounded mt-4" />
        <div className="h-3.5 w-24 bg-gray-100 rounded mt-2" />
        <div className="h-3.5 w-3/4 bg-gray-100 rounded mt-4" />
      </div>
    </div>
  )
}

export default function PublicProfile() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const { user, profile: me } = useAuth()
  const online = useIsOnline(userId)

  const [person, setPerson] = useState(null)
  const [school, setSchool] = useState(null)
  const [stats, setStats] = useState({ posts: 0, followers: 0, following: 0 })
  const [isFollowing, setIsFollowing] = useState(false)
  const [followsMe, setFollowsMe] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [statusFlags, setStatusFlags] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [sheet, setSheet] = useState(null)
  const [viewing, setViewing] = useState(null)
  const [solid, setSolid] = useState(false)
  const [toast, setToast] = useState('')

  const isMe = userId === user?.id

  useEffect(() => {
    if (isMe) navigate('/profile', { replace: true })
  }, [isMe])

  useEffect(() => {
    if (!user || isMe) return undefined
    let cancelled = false
    async function load() {
      setLoading(true)
      setSolid(false)
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
      if (cancelled) return
      setPerson(data)
      if (!data) { setLoading(false); return }

      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const [posts, followers, following, mine, theirs, block, schoolRes, statuses] = await Promise.all([
        supabase.from('posts').select('*', { count: 'exact', head: true }).eq('author_id', userId),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('followed_id', userId),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
        supabase.from('follows').select('follower_id').eq('follower_id', user.id).eq('followed_id', userId).maybeSingle(),
        supabase.from('follows').select('follower_id').eq('follower_id', userId).eq('followed_id', user.id).maybeSingle(),
        supabase.from('blocked_users').select('blocked_id').eq('blocker_id', user.id).eq('blocked_id', userId).maybeSingle(),
        data.school_id ? supabase.from('schools').select('name, location').eq('id', data.school_id).maybeSingle() : Promise.resolve({ data: null }),
        supabase.from('statuses').select('*').eq('user_id', userId).gt('created_at', cutoff).order('created_at', { ascending: true }),
      ])
      if (cancelled) return
      setStats({ posts: posts.count ?? 0, followers: followers.count ?? 0, following: following.count ?? 0 })
      setIsFollowing(!!mine.data)
      setFollowsMe(!!theirs.data)
      setBlocked(!!block.data)
      setSchool(schoolRes.data)

      const visible = (statuses.data ?? []).filter((s) => canViewStatus(s, me, user.id))
      let seen = new Set()
      if (visible.length) {
        const { data: views } = await supabase.from('status_views').select('status_id').eq('viewer_id', user.id).in('status_id', visible.map((s) => s.id))
        seen = new Set((views ?? []).map((v) => v.status_id))
      }
      if (cancelled) return
      setStatusFlags(visible.slice(0, 12).map((s) => seen.has(s.id)))
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [userId, user?.id])

  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(''), 2200)
    return () => clearTimeout(t)
  }, [toast])

  async function follow() {
    if (busy) return
    setBusy(true)
    setIsFollowing(true)
    setStats((s) => ({ ...s, followers: s.followers + 1 }))
    const { error } = await supabase.from('follows').insert({ follower_id: user.id, followed_id: userId })
    if (error) {
      setIsFollowing(false)
      setStats((s) => ({ ...s, followers: s.followers - 1 }))
      setToast("Couldn't follow. Try again.")
    }
    setBusy(false)
  }

  async function unfollow() {
    setSheet(null)
    setBusy(true)
    setIsFollowing(false)
    setStats((s) => ({ ...s, followers: Math.max(0, s.followers - 1) }))
    const { error } = await supabase.from('follows').delete().eq('follower_id', user.id).eq('followed_id', userId)
    if (error) {
      setIsFollowing(true)
      setStats((s) => ({ ...s, followers: s.followers + 1 }))
      setToast("Couldn't unfollow. Try again.")
    }
    setBusy(false)
  }

  async function toggleBlock() {
    setSheet(null)
    if (blocked) {
      const { error } = await supabase.from('blocked_users').delete().eq('blocker_id', user.id).eq('blocked_id', userId)
      if (!error) { setBlocked(false); setToast('Unblocked') }
      return
    }
    const { error } = await supabase.from('blocked_users').insert({ blocker_id: user.id, blocked_id: userId })
    if (error) { setToast("Couldn't block. Try again."); return }
    if (isFollowing) await supabase.from('follows').delete().eq('follower_id', user.id).eq('followed_id', userId)
    setBlocked(true)
    setIsFollowing(false)
    setToast(`Blocked ${person?.full_name?.split(' ')[0] || 'this person'}`)
  }

  async function share() {
    const url = profileLink(userId)
    try {
      if (navigator.share) {
        await navigator.share({ title: person?.full_name || 'Schoolink profile', url })
        return
      }
      await navigator.clipboard.writeText(url)
      setToast('Profile link copied')
    } catch { /* cancelled */ }
  }

  async function copyLink() {
    setSheet(null)
    try {
      await navigator.clipboard.writeText(profileLink(userId))
      setToast('Profile link copied')
    } catch { setToast("Couldn't copy the link") }
  }

  const barBtn = `w-10 h-10 rounded-full flex items-center justify-center ${solid ? 'text-gray-800' : 'text-white bg-black/35 backdrop-blur'}`
  const topBar = (title) => (
    <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-3 transition-colors duration-200" style={{ height: 56, background: solid ? 'var(--surface, #fff)' : 'transparent', boxShadow: solid ? '0 1px 0 rgba(0,0,0,.06)' : 'none' }}>
      <button onClick={() => navigate(-1)} aria-label="Back" className={barBtn}><ChevronLeft size={22} /></button>
      <p className={`font-semibold truncate px-2 transition-opacity ${solid ? 'opacity-100' : 'opacity-0'}`}>{title}</p>
      {person ? <button onClick={() => setSheet('more')} aria-label="More" className={barBtn}><MoreVertical size={20} /></button> : <span className="w-10" />}
    </div>
  )

  if (loading) {
    return <div className="app-shell relative">{topBar('')}<div className="screen-scroll"><Skeleton /></div></div>
  }

  if (!person) {
    return (
      <div className="app-shell relative">
        {topBar('')}
        <div className="screen-scroll flex flex-col items-center justify-center text-center px-10">
          <span className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4"><UserCheck size={32} className="text-gray-400" /></span>
          <p className="font-semibold text-lg">Profile not found</p>
          <p className="text-sm text-gray-400 mt-1">This person may have left Schoolink.</p>
          <button onClick={() => navigate(-1)} className="mt-5 bg-brand-purple text-white text-sm font-medium rounded-full px-6 py-2.5">Go back</button>
        </div>
      </div>
    )
  }

  const sameSchool = !!me?.school_id && me.school_id === person.school_id
  const locked = person.profile_visibility === 'school_only' && !sameSchool
  const shown = locked ? { id: person.id, full_name: person.full_name, username: person.username, avatar_url: person.avatar_url, role: person.role, cover_url: person.cover_url } : person
  const canSeePosts = isSchoolMember(person) && !locked && !blocked
  const firstName = person.full_name?.split(' ')[0] || 'them'

  const actions = blocked ? (
    <button onClick={toggleBlock} className="flex items-center gap-1.5 border border-gray-300 rounded-full px-4 py-2 text-sm font-semibold">Unblock</button>
  ) : (
    <>
      {isFollowing ? (
        <button onClick={() => setSheet('unfollow')} disabled={busy} className="flex items-center gap-1.5 border border-gray-300 rounded-full px-4 py-2 text-sm font-semibold"><UserCheck size={16} /> Following</button>
      ) : (
        <button onClick={follow} disabled={busy} className="flex items-center gap-1.5 bg-brand-purple text-white rounded-full px-5 py-2 text-sm font-semibold"><UserPlus size={16} /> {followsMe ? 'Follow back' : 'Follow'}</button>
      )}
      {isFollowing ? (
        <button onClick={() => navigate(`/chats/${userId}`)} aria-label="Message" className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center"><MessageSquare size={17} /></button>
      ) : null}
    </>
  )

  return (
    <div className="app-shell relative">
      {topBar(person.full_name)}

      <div className="screen-scroll" onScroll={(e) => { const s = e.currentTarget.scrollTop > 150; if (s !== solid) setSolid(s) }}>
        <ProfileHeader
          person={shown}
          userId={userId}
          isMe={false}
          school={locked ? null : school}
          stats={stats}
          statusFlags={locked || blocked ? [] : statusFlags}
          online={online && person.show_online_status !== false && !locked}
          followsYou={followsMe}
          joined={locked ? null : person.created_at}
          showStats={!locked}
          onAvatar={() => {
            if (statusFlags.length && !locked && !blocked) navigate(`/statuses/${userId}`, { state: { queue: [userId] } })
            else if (person.avatar_url) setViewing(person.avatar_url)
          }}
          onCover={() => person.cover_url && setViewing(person.cover_url)}
          actions={actions}
        />

        {blocked ? (
          <div className="mx-4 mt-4 rounded-2xl bg-gray-50 p-5 text-center">
            <Ban size={26} className="mx-auto text-gray-400" />
            <p className="font-semibold mt-2">You blocked {firstName}</p>
            <p className="text-sm text-gray-400 mt-1">They can't message you, and you won't see their posts.</p>
          </div>
        ) : locked ? (
          <div className="mx-4 mt-4 rounded-2xl bg-gray-50 p-6 text-center">
            <Lock size={26} className="mx-auto text-gray-400" />
            <p className="font-semibold mt-2">This profile is private</p>
            <p className="text-sm text-gray-400 mt-1">Only people from {firstName}'s school can see more.</p>
          </div>
        ) : (
          <div className="mt-3">
            <ProfileContent userId={userId} person={person} school={school} isMe={false} canSeePosts={canSeePosts} joined={person.created_at} />
          </div>
        )}
      </div>

      {toast ? <div className="absolute left-1/2 -translate-x-1/2 z-30 bg-gray-900 text-white text-sm rounded-full px-4 py-2 shadow-lg whitespace-nowrap" style={{ bottom: 40 }}>{toast}</div> : null}

      {sheet === 'unfollow' ? (
        <BottomSheet onClose={() => setSheet(null)}>
          <p className="font-semibold text-lg px-4 pt-2">Unfollow {person.full_name}?</p>
          <p className="text-sm text-gray-500 px-4 mt-1">You can follow them again any time.</p>
          <button onClick={unfollow} className="w-[calc(100%-16px)] mx-2 mt-5 bg-red-500 text-white font-semibold py-3.5 rounded-full">Unfollow</button>
          <button onClick={() => setSheet(null)} className="w-full mt-1 py-3.5 text-gray-600 font-medium">Cancel</button>
        </BottomSheet>
      ) : null}

      {sheet === 'more' ? (
        <BottomSheet onClose={() => setSheet(null)}>
          {person.avatar_url && !locked ? <SheetAction icon={Eye} label="View profile photo" onClick={() => { setSheet(null); setViewing(person.avatar_url) }} /> : null}
          {statusFlags.length && !locked && !blocked ? <SheetAction icon={CircleDot} label="View status" onClick={() => { setSheet(null); navigate(`/statuses/${userId}`, { state: { queue: [userId] } }) }} /> : null}
          <SheetAction icon={Share2} label="Share profile" onClick={() => { setSheet(null); share() }} />
          <SheetAction icon={Link2} label="Copy profile link" onClick={copyLink} />
          <SheetAction icon={blocked ? ShieldCheck : Ban} danger={!blocked} label={blocked ? `Unblock ${firstName}` : `Block ${firstName}`} sub={blocked ? undefined : "They won't be able to message you."} onClick={blocked ? toggleBlock : () => setSheet('block')} />
        </BottomSheet>
      ) : null}

      {sheet === 'block' ? (
        <BottomSheet onClose={() => setSheet(null)}>
          <p className="font-semibold text-lg px-4 pt-2">Block {person.full_name}?</p>
          <p className="text-sm text-gray-500 px-4 mt-1">They won't be able to message you, and you will stop following them. You can unblock them at any time.</p>
          <button onClick={toggleBlock} className="w-[calc(100%-16px)] mx-2 mt-5 bg-red-500 text-white font-semibold py-3.5 rounded-full">Block</button>
          <button onClick={() => setSheet(null)} className="w-full mt-1 py-3.5 text-gray-600 font-medium">Cancel</button>
        </BottomSheet>
      ) : null}

      {viewing ? <AvatarViewer imageUrl={viewing} onClose={() => setViewing(null)} /> : null}
    </div>
  )
        }
