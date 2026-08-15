import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Users, Send } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function CommunityDetail() {
  const { communityId } = useParams()
  const { user, profile } = useAuth()

  const [community, setCommunity] = useState(null)
  const [members, setMembers] = useState([])
  const [posts, setPosts] = useState([])
  const [isMember, setIsMember] = useState(false)
  const [tab, setTab] = useState('feed')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAll()
  }, [communityId])

  async function loadAll() {
    setLoading(true)

    const { data: comm } = await supabase
      .from('communities')
      .select('*')
      .eq('id', communityId)
      .maybeSingle()
    setCommunity(comm)

    const { data: memberRows } = await supabase
      .from('community_members')
      .select('user_id, profiles(full_name, role)')
      .eq('community_id', communityId)
    setMembers(memberRows ?? [])
    setIsMember((memberRows ?? []).some((m) => m.user_id === user?.id))

    const { data: postRows } = await supabase
      .from('community_posts')
      .select('*')
      .eq('community_id', communityId)
      .order('created_at', { ascending: false })
    setPosts(postRows ?? [])

    setLoading(false)
  }

  async function handleJoin() {
    await supabase.from('community_members').insert({ community_id: communityId, user_id: user.id })
    setIsMember(true)
    loadAll()
  }

  async function handleLeave() {
    await supabase.from('community_members').delete().eq('community_id', communityId).eq('user_id', user.id)
    setIsMember(false)
    loadAll()
  }

  async function handlePost() {
    if (!text.trim() || sending) return
    setSending(true)
    const { error } = await supabase.from('community_posts').insert({
      community_id: communityId,
      author_id: user.id,
      author_name: profile?.full_name || user.email,
      author_role: profile?.role || '',
      content: text,
    })
    setSending(false)
    if (!error) {
      setText('')
      loadAll()
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col">
        <BackHeader title="Community" />
        <div className="screen-scroll px-4 flex items-center justify-center text-gray-400">Loading…</div>
      </div>
    )
  }

  if (!community) {
    return (
      <div className="flex-1 flex flex-col">
        <BackHeader title="Community" />
        <div className="screen-scroll px-4 flex items-center justify-center text-gray-400">Not found.</div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader title={community.name} />

      <div className="px-4 pb-2">
        <p className="text-sm text-gray-500">{community.description}</p>
        <div className="flex items-center justify-between mt-3">
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <Users size={14} /> {members.length} members
          </span>
          <button
            onClick={isMember ? handleLeave : handleJoin}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border ${
              isMember ? 'text-gray-400 border-gray-200' : 'text-brand-purple border-brand-purple'
            }`}
          >
            {isMember ? 'Leave' : 'Join'}
          </button>
        </div>
      </div>

      <div className="flex px-4 gap-6 border-b border-gray-100">
        {['feed', 'members'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`py-2 text-sm font-medium border-b-2 capitalize ${
              tab === t ? 'border-brand-purple text-brand-purple' : 'border-transparent text-gray-400'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="screen-scroll px-4 pt-3">
        {tab === 'feed' ? (
          <>
            {isMember ? (
              <div className="flex items-center gap-2 mb-4">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Share something with the community…"
                  className="flex-1 border border-gray-200 rounded-full px-4 py-2.5 text-sm outline-brand-purple"
                />
                <button
                  onClick={handlePost}
                  disabled={sending}
                  className="w-10 h-10 rounded-full bg-brand-purple flex items-center justify-center shrink-0 disabled:opacity-60"
                >
                  <Send size={16} className="text-white" />
                </button>
              </div>
            ) : null}

            {posts.length === 0 ? (
              <p className="text-center text-gray-400 mt-8">No posts yet.</p>
            ) : (
              <div className="space-y-3">
                {posts.map((p) => (
                  <div key={p.id} className="border border-gray-100 rounded-xl p-3">
                    <p className="font-semibold text-sm">{p.author_name}</p>
                    <p className="text-xs text-gray-400 mb-1">{p.author_role}</p>
                    <p className="text-sm">{p.content}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="divide-y divide-gray-100">
            {members.map((m) => (
              <div key={m.user_id} className="py-3">
                <p className="font-medium text-sm">{m.profiles?.full_name || 'Schoolink member'}</p>
                <p className="text-xs text-gray-400">{m.profiles?.role || ''}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
        }
