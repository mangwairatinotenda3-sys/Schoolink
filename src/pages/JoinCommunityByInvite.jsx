import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function JoinCommunityByInvite() {
  const { inviteCode } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [error, setError] = useState('')

  useEffect(() => {
    joinCommunity()
  }, [inviteCode, user])

  async function joinCommunity() {
    if (!user) return
    const { data: community } = await supabase
      .from('communities')
      .select('id')
      .eq('invite_code', inviteCode)
      .maybeSingle()

    if (!community) {
      setError('This invite link is invalid or has expired.')
      return
    }

    await supabase
      .from('community_members')
      .upsert({ community_id: community.id, user_id: user.id }, { onConflict: 'community_id,user_id', ignoreDuplicates: true })

    navigate(`/communities/${community.id}`, { replace: true })
  }

  return (
    <div className="app-shell">
      <div className="flex-1 flex items-center justify-center px-6 text-center">
        {error ? <p className="text-gray-500">{error}</p> : <p className="text-gray-400">Joining community…</p>}
      </div>
    </div>
  )
}
