import { useEffect, useState } from 'react'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function LoginHistory() {
  const { user } = useAuth()
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('login_history')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => {
        setHistory(data ?? [])
        setLoading(false)
      })
  }, [])

  return (
    <div className="app-shell">
      <BackHeader title="Login History" />
      <div className="screen-scroll px-6 pt-3">
        {loading ? (
          <p className="text-center text-gray-400 mt-8">Loading…</p>
        ) : history.length === 0 ? (
          <p className="text-center text-gray-400 mt-8">No login history recorded yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {history.map((h) => (
              <div key={h.id} className="py-3">
                <p className="text-sm font-medium capitalize">{h.method || 'Sign in'}</p>
                <p className="text-xs text-gray-400">{new Date(h.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
