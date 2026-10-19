import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Settings, Share2, Landmark, Bookmark, Pencil, Eye, Camera, Trash2, X, Check, Image as ImageIcon, CircleDot } from 'lucide-react'
import BottomNav from '../components/BottomNav.jsx'
import BottomSheet, { SheetAction } from '../components/BottomSheet.jsx'
import ProfileHeader from '../components/ProfileHeader.jsx'
import ProfileContent from '../components/ProfileContent.jsx'
import AvatarViewer from '../components/AvatarViewer.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { isPendingApproval, isSchoolMember } from '../lib/permissions.js'
import { useIsOnline } from '../lib/presence.jsx'
import { useProfilePhotos } from '../lib/useProfilePhotos.jsx'

const TIP_KEY = 'sl_profile_tip_hidden'

function profileLink(id) {
  return `${window.location.href.split('#')[0]}#/users/${id}`
}

export default function Profile() {
  const navigate = useNavigate()
  const { profile, user } = useAuth()
  const isOnline = useIsOnline(user?.id)
  const photos = useProfilePhotos()
  const scrollRef = useRef(null)

  const [stats, setStats] = useState({ posts: 0, followers: 0, following: 0 })
  const [school, setSchool] = useState(null)
  const [statusCount, setStatusCount] = useState(0)
  const [sheet, setSheet] = useState(null)
  const [viewing, setViewing] = useState(null)
  const [solid, setSolid] = useState(false)
  const [toast, setToast] = useState('')
  const [tipHidden, setTipHidden] = useState(() => {
    try { return localStorage.getItem(TIP_KEY) === '1' } catch { return false }
  })

  const isMember = isSchoolMember(profile)
  const name = profile?.full_name || user?.email?.split('@')[0] || 'Your name'

  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase.from('posts').select('*', { count: 'exact', head: true }).eq('author_id', user.id),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('followed_id', user.id),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', user.id),
    ]).then(([a, b, c]) => setStats({ posts: a.count ?? 0, followers: b.count ?? 0, following: c.count ?? 0 }))
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    supabase.from('statuses').select('id').eq('user_id', user.id).gt('created_at', cutoff).then(({ data }) => setStatusCount((data ?? []).length))
  }, [user?.id])

  useEffect(() => {
    if (!profile?.school_id) { setSchool(null); return }
    supabase.from('schools').select('name, location').eq('id', profile.school_id).maybeSingle().then(({ data }) => setSchool(data))
  }, [profile?.school_id])

  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(''), 2200)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (photos.error) setToast(photos.error)
  }, [photos.error])

  function onScroll(e) {
    const s = e.currentTarget.scrollTop > 150
    if (s !== solid) setSolid(s)
  }

  async function share() {
    const url = profileLink(user.id)
    try {
      if (navigator.share) {
        await navigator.share({ title: name, text: `${name} on Schoolink`, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setToast('Profile link copied')
    } catch { /* cancelled */ }
  }

  // What is still missing from the profile.
  const todo = [
    { key: 'photo', label: 'Profile photo', done: !!profile?.avatar_url, run: () => photos.pick('avatar') },
    { key: 'cover', label: 'Cover photo', done: !!profile?.cover_url, run: () => photos.pick('cover') },
    { key: 'bio', label: 'Bio', done: !!profile?.bio, run: () => navigate('/edit-profile-details') },
    { key: 'username', label: 'Username', done: !!profile?.username, run: () => navigate('/edit-profile-details') },
    { key: 'location', label: 'Location', done: !!profile?.location, run: () => navigate('/edit-profile-details') },
  ]
  const doneCount = todo.filter((t) => t.done).length
  const showTip = !tipHidden && doneCount < todo.length

  function hideTip() {
    setTipHidden(true)
    try { localStorage.setItem(TIP_KEY, '1') } catch { /* ignore */ }
  }

  const barBtn = `w-10 h-10 rounded-full flex items-center justify-center ${solid ? 'text-gray-800' : 'text-white bg-black/35 backdrop-blur'}`

  return (
    <div className="app-shell relative">
      {/* Floating bar: clear over the cover, solid once you scroll */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-3 transition-colors duration-200" style={{ height: 56, background: solid ? 'var(--surface, #fff)' : 'transparent', boxShadow: solid ? '0 1px 0 rgba(0,0,0,.06)' : 'none' }}>
        <button onClick={() => navigate(-1)} aria-label="Back" className={barBtn}><ChevronLeft size={22} /></button>
        <p className={`font-semibold truncate px-2 transition-opacity ${solid ? 'opacity-100' : 'opacity-0'}`}>{name}</p>
        <div className="flex items-center gap-2">
          <button onClick={share} aria-label="Share profile" className={barBtn}><Share2 size={19} /></button>
          <button onClick={() => navigate('/settings')} aria-label="Settings" className={barBtn}><Settings size={19} /></button>
        </div>
      </div>

      <div className="screen-scroll" ref={scrollRef} onScroll={onScroll}>
        <ProfileHeader
          person={profile}
          userId={user?.id}
          isMe
          school={isMember ? school : null}
          stats={stats}
          statusFlags={Array.from({ length: Math.min(statusCount, 12) }, () => false)}
          online={isOnline}
          joined={profile?.created_at || user?.created_at}
          showStats={isMember}
          onFollowers={() => navigate('/connections/followers')}
          onFollowing={() => navigate('/connections/following')}
          onAvatar={() => setSheet('avatar')}
          onCover={() => setSheet('cover')}
          actions={(
            <button onClick={() => navigate('/edit-profile-details')} className="flex items-center gap-1.5 border border-gray-300 rounded-full px-4 py-2 text-sm font-semibold active:bg-gray-50">
              <Pencil size={15} /> Edit profile
            </button>
          )}
        />

        {isPendingApproval(profile) ? (
          <div className="bg-yellow-50 text-yellow-700 text-sm text-center py-2.5 px-4">Your request is waiting for your school's admin to approve it.</div>
        ) : null}

        <div className="px-4 pt-3 grid grid-cols-2 gap-2">
          {isMember ? (
            <button onClick={() => navigate('/school-profile')} className="flex items-center justify-center gap-2 bg-brand-light text-brand-purple rounded-xl py-3 text-sm font-semibold"><Landmark size={17} /> My school</button>
          ) : null}
          <button onClick={() => navigate('/saved')} className={`flex items-center justify-center gap-2 bg-gray-100 text-gray-700 rounded-xl py-3 text-sm font-semibold ${isMember ? '' : 'col-span-2'}`}><Bookmark size={17} /> Saved</button>
        </div>

        {showTip ? (
          <div className="mx-4 mt-3 rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-[15px]">Complete your profile</p>
                <p className="text-xs text-gray-400 mt-0.5">{doneCount} of {todo.length} done</p>
              </div>
              <button onClick={hideTip} aria-label="Hide" className="text-gray-300 -mr-1 -mt-1 p-1"><X size={18} /></button>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full mt-3 overflow-hidden"><div className="h-full bg-brand-purple rounded-full transition-all" style={{ width: `${(doneCount / todo.length) * 100}%` }} /></div>
            <div className="flex flex-wrap gap-2 mt-3">
              {todo.map((t) => (
                <button key={t.key} onClick={t.done ? undefined : t.run} className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1.5 ${t.done ? 'bg-green-50 text-green-600' : 'bg-brand-light text-brand-purple'}`}>
                  {t.done ? <Check size={13} strokeWidth={3} /> : <CircleDot size={13} />} {t.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-2">
          <ProfileContent
            userId={user?.id}
            person={profile}
            school={isMember ? school : null}
            isMe
            canSeePosts={isMember}
            joined={profile?.created_at || user?.created_at}
            onPostsCount={(d) => setStats((s) => ({ ...s, posts: Math.max(0, s.posts + d) }))}
          />
          {!isMember ? <p className="text-center text-gray-400 text-sm px-8 pb-8">Follow people from their posts or the Chats tab to start conversations with them.</p> : null}
        </div>
      </div>

      {toast ? <div className="absolute left-1/2 -translate-x-1/2 z-30 bg-gray-900 text-white text-sm rounded-full px-4 py-2 shadow-lg" style={{ bottom: 90 }}>{toast}</div> : null}

      {sheet === 'avatar' ? (
        <BottomSheet onClose={() => setSheet(null)}>
          {profile?.avatar_url ? <SheetAction icon={Eye} label="View photo" onClick={() => { setSheet(null); setViewing(profile.avatar_url) }} /> : null}
          {statusCount > 0 ? <SheetAction icon={CircleDot} label="View my status" onClick={() => { setSheet(null); navigate(`/statuses/${user.id}`) }} /> : null}
          <SheetAction icon={Camera} label={profile?.avatar_url ? 'Change photo' : 'Add a photo'} onClick={() => { setSheet(null); photos.pick('avatar') }} />
          {profile?.avatar_url ? <SheetAction icon={Trash2} danger label="Remove photo" onClick={() => { setSheet(null); photos.remove('avatar') }} /> : null}
        </BottomSheet>
      ) : null}

      {sheet === 'cover' ? (
        <BottomSheet onClose={() => setSheet(null)}>
          {profile?.cover_url ? <SheetAction icon={Eye} label="View cover photo" onClick={() => { setSheet(null); setViewing(profile.cover_url) }} /> : null}
          <SheetAction icon={ImageIcon} label={profile?.cover_url ? 'Change cover photo' : 'Add a cover photo'} onClick={() => { setSheet(null); photos.pick('cover') }} />
          {profile?.cover_url ? <SheetAction icon={Trash2} danger label="Remove cover photo" onClick={() => { setSheet(null); photos.remove('cover') }} /> : null}
        </BottomSheet>
      ) : null}

      {viewing ? <AvatarViewer imageUrl={viewing} onClose={() => setViewing(null)} /> : null}
      {photos.element}
      <BottomNav />
    </div>
  )
        }
