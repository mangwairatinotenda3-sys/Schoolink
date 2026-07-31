import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

const PresenceContext = createContext(new Set())

export function PresenceProvider({ children }) {
  const { user } = useAuth()
  const [onlineIds, setOnlineIds] = useState(new Set())

  useEffect(() => {
    if (!user) {
      setOnlineIds(new Set())
      return
    }

    const channel = supabase.channel('presence:global', {
      config: { presence: { key: user.id } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        setOnlineIds(new Set(Object.keys(state)))
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online_at: new Date().toISOString() })
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  return <PresenceContext.Provider value={onlineIds}>{children}</PresenceContext.Provider>
}

export function useIsOnline(userId) {
  const onlineIds = useContext(PresenceContext)
  return userId ? onlineIds.has(userId) : false
}
