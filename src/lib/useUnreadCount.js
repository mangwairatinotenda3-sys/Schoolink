import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

export function useUnreadCount() {
  const { user } = useAuth()
  const [count, setCount] = useState(0)
  const channelNameRef = useRef(`notifications-count-${Math.random().toString(36).slice(2)}`)

  useEffect(() => {
    if (!user) {
      setCount(0)
      return undefined
    }
    let timer = null
    const load = async () => {
      const { count: unread } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .eq('read', false)
      setCount(unread ?? 0)
    }
    const later = () => {
      clearTimeout(timer)
      timer = setTimeout(load, 250)
    }
    load()

    // New, read, or removed notifications all change the number.
    const channel = supabase
      .channel(channelNameRef.current)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${user.id}` }, later)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${user.id}` }, later)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notifications' }, later)
      .subscribe()

    // The notifications page tells us straight away when you read or clear something.
    window.addEventListener('sl-notifications-changed', later)
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearTimeout(timer)
      supabase.removeChannel(channel)
      window.removeEventListener('sl-notifications-changed', later)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [user?.id])

  return count
            }
