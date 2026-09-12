import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function FavouriteChats() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadFavourites()
  }, [])

  async function loadFavourites() {
    setLoading(true)
    const { data: favs } = await supabase.from('favourite_chats').select('partner_id').eq('user_id', user.id)
    const ids = (favs ?? []).map((f) => f.partner_id)
    if (ids.length > 0) {
      const { data } = await supabase.from('profiles').select('*').in('id', ids)
      setPeople(data ?? [])
    }
    setLoading(false)
  }

  return (
    <div className="app-shell">
      <BackHeader title="Favourite Chats" />
      <div className="screen-scroll px-4 pt-3">
        {loading ? (
          <p className="text-center text-gray-400 mt-8">Loading…</p>
        ) : people.length === 0 ? (
          <p className="text-center text-gray-400 mt-8">No favourites yet — add one from Chat Options.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {people.map((p) => (
              <button key={p.id} onClick={() => navigate(`/chats/${p.id}`)} className="w-full flex items-center gap-3 py-3 text-left">
                {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover" /> : <span className="w-11 h-11 rounded-full bg-brand-light flex items-center justify-center text-lg">🙂</span>}
                <div>
                  <p className="font-medium text-sm">{p.full_name || 'Schoolink member'}</p>
                  <p className="text-xs text-gray-400">{p.role}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
