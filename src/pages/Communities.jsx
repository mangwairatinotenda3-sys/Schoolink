import { useEffect, useState } from 'react'
import { Search, Plus, Users, Lock, MoreVertical, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import BackHeader from '../components/BackHeader.jsx'
import BottomNav from '../components/BottomNav.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

const filters = ['All', 'Joined', 'School', 'Subject', 'Role', 'Private']

export default function Communities() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [communities, setCommunities] = useState([])
  const [myCommunityIds, setMyCommunityIds] = useState(new Set())
  const [adminCommunityIds, setAdminCommunityIds] = useState(new Set())
  const [requestedIds, setRequestedIds] = useState(new Set())
  const [memberCounts, setMemberCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')
  const [openMenuId, setOpenMenuId] = useState(null)

  useEffect(() => {
    loadCommunities()
  }, [])

  async function loadCommunities() {
    setLoading(true)
    const { data: comms } = await supabase.from('communities').select('*').order('created_at', { ascending: false })
    setCommunities(comms ?? [])

    if (comms && comms.length > 0) {
      const counts = {}
      for (const c of comms) {
        const { count } = await supabase.from('community_members').select('*', { count: 'exact', head: true }).eq('community_id', c.id)
        counts[c.id] = count ?? 0
      }
      setMemberCounts(counts)
    }

    if (user) {
      const { data: memberships } = await supabase.from('community_members').select('community_id, role').eq('user_id', user.id)
      setMyCommunityIds(new Set((memberships ?? []).map((m) => m.community_id)))
      setAdminCommunityIds(new Set((memberships ?? []).filter((m) => m.role === 'admin').map((m) => m.community_id)))

      const { data: requests } = await supabase.from('community_join_requests').select('community_id').eq('user_id', user.id).eq('status', 'pending')
      setRequestedIds(new Set((requests ?? []).map((r) => r.community_id)))
    }
    setLoading(false)
  }

  async function handleJoinOrRequest(community) {
    if (community.is_private) {
      await supabase.from('community_join_requests').upsert({ community_id: community.id, user_id: user.id, status: 'pending' })
      setRequestedIds((prev) => new Set(prev).add(community.id))
    } else {
      await supabase.from('community_members').insert({ community_id: community.id, user_id: user.id })
      setMyCommunityIds((prev) => new Set(prev).add(community.id))
    }
  }

  async function handleDelete(communityId) {
    setOpenMenuId(null)
    if (!window.confirm('Delete this community for everyone? This cannot be undone.')) return
    const { error } = await supabase.from('communities').delete().eq('id', communityId)
    if (!error) setCommunities((prev) => prev.filter((c) => c.id !== communityId))
  }

  const filtered = communities.filter((c) => {
    const q = query.toLowerCase().trim()
    const matchesQuery = !q || c.name?.toLowerCase().includes(q) || c.category?.toLowerCase().includes(q)
    const matchesFilter =
      filter === 'All' ? true :
      filter === 'Joined' ? myCommunityIds.has(c.id) :
      filter === 'Private' ? c.is_private :
      c.category === filter
    return matchesQuery && matchesFilter
  })

  const recommended = filtered.filter((c) => !myCommunityIds.has(c.id))
  const joined = filtered.filter((c) => myCommunityIds.has(c.id))

  function CommunityCard({ c }) {
    const isMember = myCommunityIds.has(c.id)
    const isAdmin = adminCommunityIds.has(c.id)
    const requested = requestedIds.has(c.id)

    return (
      <div className="flex items-center gap-3 py-3.5 relative">
        <button onClick={() => isMember && navigate(`/communities/${c.id}`)} className="flex items-center gap-3 flex-1 text-left min-w-0">
          {c.avatar_url ? (
            <img src={c.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
          ) : (
            <span className="w-12 h-12 rounded-full bg-brand-light flex items-center justify-center shrink-0"><Users size={18} className="text-brand-purple" /></span>
          )}
          <div className="min-w-0">
            <p className="font-medium text-sm truncate flex items-center gap-1">
              {c.name}
              {c.is_private ? <Lock size={11} className="text-gray-400 shrink-0" /> : null}
            </p>
            <p className="text-xs text-gray-400 truncate">{memberCounts[c.id] ?? 0} members {c.category ? `· ${c.category}` : ''}</p>
            {c.description ? <p className="text-xs text-gray-400 truncate">{c.description}</p> : null}
          </div>
        </button>

        {!isMember ? (
          <button
            onClick={() => handleJoinOrRequest(c)}
            disabled={requested}
            className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border ${requested ? 'text-gray-400 border-gray-200' : 'text-brand-purple border-brand-purple'}`}
          >
            {requested ? 'Requested' : c.is_private ? 'Request' : 'Join'}
          </button>
        ) : null}

        {isAdmin ? (
          <div className="relative shrink-0">
            <button onClick={() => setOpenMenuId(openMenuId === c.id ? null : c.id)}><MoreVertical size={18} className="text-gray-400" /></button>
            {openMenuId === c.id ? (
              <div className="absolute right-0 top-7 bg-white border border-gray-100 rounded-lg shadow-lg z-10 w-40">
                <button onClick={() => handleDelete(c.id)} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-500">
                  <Trash2 size={14} /> Delete Community
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="app-shell">
      <BackHeader title="Community" />

      <div className="px-4 pt-2 pb-2">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search communities…" className="w-full border border-gray-200 rounded-full pl-9 pr-4 py-2.5 text-sm outline-brand-purple" />
        </div>

        <div className="flex gap-2 overflow-x-auto mt-3 pb-1">
          {filters.map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border ${filter === f ? 'bg-brand-purple text-white border-brand-purple' : 'border-gray-200 text-gray-600'}`}>
              {f}
            </button>
          ))}
        </div>

        <button onClick={() => navigate('/communities/create')} className="mt-3 w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500">
          <Plus size={16} /> Create a Community
        </button>
      </div>

      <div className="screen-scroll px-4">
        {loading ? (
          <p className="text-center text-gray-400 mt-8">Loading…</p>
        ) : (
          <>
            {joined.length > 0 ? (
              <>
                <p className="text-xs font-semibold text-gray-400 uppercase mt-2 mb-1">Communities I'm In</p>
                <div className="divide-y divide-gray-100 mb-4">
                  {joined.map((c) => <CommunityCard key={c.id} c={c} />)}
                </div>
              </>
            ) : null}

            <p className="text-xs font-semibold text-gray-400 uppercase mt-2 mb-1">Recommended</p>
            {recommended.length === 0 ? (
              <p className="text-center text-gray-400 mt-4">No matching communities.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {recommended.map((c) => <CommunityCard key={c.id} c={c} />)}
              </div>
            )}
          </>
        )}
      </div>
      <BottomNav />
    </div>
  )
  }
