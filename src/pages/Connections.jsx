import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function Connections() {
  const { type } = useParams() // 'followers' | 'following'
  const navigate = useNavigate()
  const { user } = useAuth()
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [followingIds, setFollowingIds] = useState(new Set())

  const isFollowers = type === 'followers'

  useEffect(() => {
    loadPeople()
  }, [type])

  async function loadPeople() {
    setLoading(true)

    const { data: relations } = await supabase
      .from('follows')
      .select('follower_id, followed_id')
      .eq(isFollowers ? 'followed_id' : 'follower_id', user.id)

    const otherIds = (relations ?? []).map((r) => (isFollowers ? r.follower_id : r.followed_id))

    if (otherIds.length === 0) {
      setPeople([])
      setLoading(false)
      return
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, role, avatar_url')
      .in('id', otherIds)

    setPeople(profiles ?? [])

    const { data: myFollowing } = await supabase
      .from('follows')
      .select('followed_id')
      .eq('follower_id', user.id)
    setFollowingIds(new Set((myFollowing ?? []).map((f) => f.followed_id)))

    setLoading(false)
  }

  async function toggleFollow(personId) {
    if (followingIds.has(personId)) {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('followed_id', personId)
      setFollowingIds((prev) => {
        const next = new Set(prev)
        next.delete(personId)
        return next
      })
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, followed_id: personId })
      setFollowingIds((prev) => new Set(prev).add(personId))
    }
  }

  return (
    <div className="app-shell">
      <BackHeader title={isFollowers ? 'Followers' : 'Following'} />
      <div className="screen-scroll px-4 pt-2">
        {loading ? (
          <p className="text-center text-gray-400 mt-8">Loading…</p>
        ) : people.length === 0 ? (
          <p className="text-center text-gray-400 mt-8">
            {isFollowers ? "No followers yet." : "You aren't following anyone yet."}
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {people.map((p) => {
              const isMe = p.id === user.id
              const isFollowing = followingIds.has(p.id)
              return (
                <div key={p.id} className="flex items-center justify-between py-3.5">
                  <div className="flex items-center gap-3 min-w-0">
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
                    ) : (
                      <span className="w-11 h-11 rounded-full bg-brand-light flex items-center justify-center text-lg shrink-0">🙂</span>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{p.full_name || 'Schoolink member'}</p>
                      <p className="text-xs text-gray-400 truncate">{p.role}</p>
                    </div>
                  </div>
                  {!isMe ? (
                    <button
                      onClick={() => toggleFollow(p.id)}
                      className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border ${
                        isFollowing ? 'text-gray-400 border-gray-200' : 'text-brand-purple border-brand-purple'
                      }`}
                    >
                      {isFollowing ? 'Following' : 'Follow Back'}
                    </button>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
  }
