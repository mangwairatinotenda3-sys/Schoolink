import { useEffect, useState } from 'react'
import { Heart, MessageCircle, UserPlus, CheckCircle } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import BottomNav from '../components/BottomNav.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

const icons = {
  like: { icon: Heart, color: 'text-red-500' },
  comment: { icon: MessageCircle, color: 'text-blue-500' },
  follow: { icon: UserPlus, color: 'text-brand-purple' },
  approval: { icon: CheckCircle, color: 'text-green-500' },
}

const messages = {
  like: (name) => `${name || 'Someone'} liked your post`,
  comment: (name) => `${name || 'Someone'} commented on your post`,
  follow: (name) => `${name || 'Someone'} started following you`,
  approval: () => `Your request to join the school was approved`,
}

function timeAgo(dateString) {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

export default function Notifications() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    loadNotifications()
  }, [user])

  async function loadNotifications() {
    setLoading(true)
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    setItems(data ?? [])
    setLoading(false)

    const unreadIds = (data ?? []).filter((n) => !n.read).map((n) => n.id)
    if (unreadIds.length > 0) {
      await supabase.from('notifications').update({ read: true }).in('id', unreadIds)
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader title="Notifications" />
      <div className="screen-scroll px-4">
        {loading ? (
          <p className="text-center text-gray-400 mt-8">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-center text-gray-400 mt-8">No notifications yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {items.map((n) => {
              const config = icons[n.type] ?? icons.follow
              const Icon = config.icon
              return (
                <div key={n.id} className={`flex items-center gap-3 py-3.5 ${n.read ? '' : 'bg-brand-light/50'}`}>
                  <span className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                    <Icon size={16} className={config.color} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm truncate">{messages[n.type]?.(n.actor_name) ?? 'New notification'}</p>
                    <p className="text-xs text-gray-400">{timeAgo(n.created_at)}</p>
                  </div>
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
