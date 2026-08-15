import { useEffect, useState } from 'react'
import { Search, Plus, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import BackHeader from '../components/BackHeader.jsx'
import BottomNav from '../components/BottomNav.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function Communities() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [communities, setCommunities] = useState([])
  const [myCommunityIds, setMyCommunityIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    loadCommunities()
  }, [])

  async function loadCommunities() {
    setLoading(true)
    const { data: comms } = await supabase
      .from('communities')
      .select('*')
      .order('created_at', { ascending: false })
    setCommunities(comms ?? [])

    if (user) {
      const { data: memberships } = await supabase
        .from('community_members')
        .select('community_id')
        .eq('user_id', user.id)
      setMyCommunityIds(new Set((memberships ?? []).map((m) => m.community_id)))
    }
    setLoading(false)
  }

  async function toggleJoin(communityId) {
    if (!user) return
    if (myCommunityIds.has(communityId)) {
      await supabase.from('community_members').delete().eq('community_id', communityId).eq('user_id', user.id)
      setMyCommunityIds((prev) => {
        const next = new Set(prev)
        next.delete(communityId)
        return next
      })
    } else {
      await supabase.from('community_members').insert({ community_id: communityId, user_id: user.id })
      setMyCommunityIds((prev) => new Set(prev).add(communityId))
    }
  }

  const filtered = communities.filter((c) => {
    const q = query.toLowerCase().trim()
    return !q || c.name?.toLowerCase().includes(q) || c.category?.toLowerCase().includes(q)
  })

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader title="Communities" />

      <div className="px-4 pt-2 pb-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search communities…"
            className="w-full border border-gray-200 rounded-full pl-9 pr-4 py-2.5 text-sm outline-brand-purple"
          />
        </div>
        <button
          onClick={() => navigate('/communities/create')}
          className="mt-3 w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500"
        >
          <Plus size={16} /> Create a Community
        </button>
      </div>

      <div className="screen-scroll px-4">
        {loading ? (
          <p className="text-center text-gray-400 mt-8">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-400 mt-8">
            {communities.length === 0 ? 'No communities yet — be the first to create one.' : 'No matches.'}
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map((c) => {
              const isMember = myCommunityIds.has(c.id)
              return (
                <div key={c.id} className="flex items-center gap-3 py-3.5">
                  <button
                    onClick={() => navigate(`/communities/${c.id}`)}
                    className="flex items-center gap-3 flex-1 text-left min-w-0"
                  >
                    <span className="w-11 h-11 rounded-full bg-brand-light flex items-center justify-center shrink-0">
                      <Users size={18} className="text-brand-purple" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{c.name}</p>
                      <p className="text-xs text-gray-400 truncate">{c.category || 'General'}</p>
                    </div>
                  </button>
                  <button
                    onClick={() => toggleJoin(c.id)}
                    className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border ${
                      isMember ? 'text-gray-400 border-gray-200' : 'text-brand-purple border-brand-purple'
                    }`}
                  >
                    {isMember ? 'Joined' : 'Join'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  )
    }
