import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MessageSquare, MapPin } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import PostCard from '../components/PostCard.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { isSchoolMember } from '../lib/permissions.js'
import { useIsOnline } from '../lib/presence.jsx'

export default function PublicProfile() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isOnline = useIsOnline(userId)

  const [person, setPerson] = useState(null)
  const [posts, setPosts] = useState([])
  const [isFollowing, setIsFollowing] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const isMe = userId === user.id

  useEffect(() => {
    loadPerson()
  }, [userId])

  async function loadPerson() {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    setPerson(data)

    if (data && isSchoolMember(data)) {
      const { data: postRows } = await supabase.from('posts').select('*').eq('author_id', userId).order('created_at', { ascending: false })
      setPosts(postRows ?? [])
    }

    const { count } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('followed_id', userId)
    setFollowerCount(count ?? 0)

    if (!isMe) {
      const { data: followRow } = await supabase.from('follows').select('*').eq('follower_id', user.id).eq('followed_id', userId).maybeSingle()
      setIsFollowing(!!followRow)
    }
    setLoading(false)
  }

  async function toggleFollow() {
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('followed_id', userId)
      setIsFollowing(false)
      setFollowerCount((c) => c - 1)
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, followed_id: userId })
      setIsFollowing(true)
      setFollowerCount((c) => c + 1)
    }
  }

  if (loading) {
    return (
      <div className="app-shell">
        <BackHeader title="Profile" />
        <div className="screen-scroll flex items-center justify-center text-gray-400">Loading…</div>
      </div>
    )
  }

  if (!person) {
    return (
      <div className="app-shell">
        <BackHeader title="Profile" />
        <div className="screen-scroll flex items-center justify-center text-gray-400">User not found.</div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <BackHeader title={person.username ? `@${person.username}` : 'Profile'} />
      <div className="screen-scroll px-4 pt-3">
        <div className="flex flex-col items-center">
          <span className="relative">
            {person.avatar_url ? (
              <img src={person.avatar_url} alt="" className="w-20 h-20 rounded-full object-cover" />
            ) : (
              <span className="w-20 h-20 rounded-full bg-brand-light flex items-center justify-center text-2xl">🙂</span>
            )}
            {isOnline ? <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-green-500 border-2 border-white" /> : null}
          </span>
          <p className="font-bold text-lg mt-2">{person.full_name || 'Schoolink member'}</p>
          {person.username ? <p className="text-sm text-gray-400">@{person.username}</p> : null}
          <span className="text-[11px] bg-brand-light text-brand-purple px-2 py-0.5 rounded-full mt-1">{person.role || person.account_type}</span>
          {person.location ? (
            <p className="text-sm text-gray-500 flex items-center gap-1 mt-2"><MapPin size={13} /> {person.location}</p>
          ) : null}
          {person.bio ? <p className="text-sm text-gray-600 text-center mt-2 max-w-xs">{person.bio}</p> : null}
        </div>

        <p className="text-center text-sm text-gray-400 mt-3">{followerCount} follower{followerCount !== 1 ? 's' : ''}</p>

        {!isMe ? (
          <div className="flex gap-2 mt-4">
            <button
              onClick={toggleFollow}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-medium ${
                isFollowing ? 'bg-brand-navy text-white' : 'border border-brand-purple text-brand-purple'
              }`}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </button>
            {isFollowing ? (
              <button onClick={() => navigate(`/chats/${userId}`)} className="flex-1 flex items-center justify-center gap-1.5 border border-gray-200 rounded-xl py-2.5 text-sm font-medium">
                <MessageSquare size={15} /> Message
              </button>
            ) : null}
          </div>
        ) : null}

        {isSchoolMember(person) ? (
          <div className="mt-5">
            <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Posts</p>
            {posts.length === 0 ? (
              <p className="text-center text-gray-400 mt-4">No posts yet.</p>
            ) : (
              <div className="space-y-3 pb-6">
                {posts.map((p) => <PostCard key={p.id} post={p} onDeleted={(id) => setPosts((prev) => prev.filter((x) => x.id !== id))} />)}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
