import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

export function useUnreadCount() {
  const { user } = useAuth()
  const [count, setCount] = useState(0)
  const channelNameRef = useRef(`notifications-count-${Math.random().toString(36).slice(2)}`)

  useEffect(() => {
    if (!user) return
    loadCount()

    const channel = supabase
      .channel(channelNameRef.current)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${user.id}` },
        () => loadCount()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  async function loadCount() {
    const { count: unread } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .eq('read', false)
    setCount(unread ?? 0)
  }

  return count
  }
