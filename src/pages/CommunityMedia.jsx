import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { FileText, Link2 } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'

const tabs = ['Photos', 'Videos', 'Files', 'Links']
const urlRegex = /(https?:\/\/[^\s]+)/g

export default function CommunityMedia() {
  const { communityId } = useParams()
  const [tab, setTab] = useState('Photos')
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadMessages()
  }, [communityId])

  async function loadMessages() {
    setLoading(true)
    const { data } = await supabase
      .from('community_messages')
      .select('*')
      .eq('community_id', communityId)
      .order('created_at', { ascending: false })
    setMessages(data ?? [])
    setLoading(false)
  }

  const photos = messages.filter((m) => m.media_type === 'image')
  const videos = messages.filter((m) => m.media_type === 'video')
  const files = messages.filter((m) => m.media_type === 'file')
  const links = messages.flatMap((m) => (m.content?.match(urlRegex) ?? []).map((url) => ({ id: m.id + url, url, content: m.content })))

  return (
    <div className="app-shell">
      <BackHeader title="Media, Files & Links" />
      <div className="flex px-4 gap-6 border-b border-gray-100">
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`py-2 text-sm font-medium border-b-2 ${tab === t ? 'border-brand-purple text-brand-purple' : 'border-transparent text-gray-400'}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="screen-scroll px-4 pt-3">
        {loading ? (
          <p className="text-center text-gray-400 mt-8">Loading…</p>
        ) : tab === 'Photos' ? (
          photos.length === 0 ? <p className="text-center text-gray-400 mt-8">No photos yet.</p> : (
            <div className="grid grid-cols-3 gap-1.5">{photos.map((p) => <img key={p.id} src={p.media_url} alt="" className="w-full h-24 object-cover rounded-md" />)}</div>
          )
        ) : tab === 'Videos' ? (
          videos.length === 0 ? <p className="text-center text-gray-400 mt-8">No videos yet.</p> : (
            <div className="space-y-2">{videos.map((v) => <video key={v.id} src={v.media_url} controls className="w-full rounded-lg" />)}</div>
          )
        ) : tab === 'Files' ? (
          files.length === 0 ? <p className="text-center text-gray-400 mt-8">No files yet.</p> : (
            <div className="divide-y divide-gray-100">
              {files.map((f) => (
                <a key={f.id} href={f.media_url} target="_blank" rel="noreferrer" className="flex items-center gap-3 py-3">
                  <span className="w-9 h-9 rounded-full bg-brand-light flex items-center justify-center shrink-0"><FileText size={16} className="text-brand-purple" /></span>
                  <p className="text-sm truncate">{f.content || 'Shared file'}</p>
                </a>
              ))}
            </div>
          )
        ) : links.length === 0 ? (
          <p className="text-center text-gray-400 mt-8">No links shared yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {links.map((l) => (
              <a key={l.id} href={l.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 py-3">
                <span className="w-9 h-9 rounded-full bg-brand-light flex items-center justify-center shrink-0"><Link2 size={16} className="text-brand-purple" /></span>
                <p className="text-sm text-brand-purple truncate">{l.url}</p>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
