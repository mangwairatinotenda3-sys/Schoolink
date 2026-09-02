import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Send, Image as ImageIcon, Users } from 'lucide-react'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import CommunityMessageBubble from '../components/CommunityMessageBubble.jsx'

export default function CommunityDetail() {
  const { communityId } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const fileInputRef = useRef(null)
  const bottomRef = useRef(null)

  const [community, setCommunity] = useState(null)
  const [memberCount, setMemberCount] = useState(0)
  const [isMember, setIsMember] = useState(false)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAll()

    const channel = supabase
      .channel(`community-${communityId}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'community_messages', filter: `community_id=eq.${communityId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [communityId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadAll() {
    setLoading(true)

    const { data: comm } = await supabase.from('communities').select('*').eq('id', communityId).maybeSingle()
    setCommunity(comm)

    const { count } = await supabase
      .from('community_members')
      .select('*', { count: 'exact', head: true })
      .eq('community_id', communityId)
    setMemberCount(count ?? 0)

    const { data: myMembership } = await supabase
      .from('community_members')
      .select('user_id')
      .eq('community_id', communityId)
      .eq('user_id', user.id)
      .maybeSingle()
    setIsMember(!!myMembership)

    const { data: msgs } = await supabase
      .from('community_messages')
      .select('*')
      .eq('community_id', communityId)
      .order('created_at', { ascending: true })
      .limit(200)
    setMessages(msgs ?? [])

    setLoading(false)
  }

  async function handleJoin() {
    await supabase.from('community_members').insert({ community_id: communityId, user_id: user.id })
    setIsMember(true)
    loadAll()
  }

  async function handleSend() {
    if (!text.trim() || sending || !isMember) return
    setSending(true)
    const content = text
    setText('')
    await supabase.from('community_messages').insert({
      community_id: communityId,
      sender_id: user.id,
      sender_name: profile?.full_name || user.email,
      content,
    })
    setSending(false)
  }

  async function handleMediaChange(e) {
    const file = e.target.files?.[0]
    if (!file || !isMember) return
    setUploading(true)

    const isVideo = file.type.startsWith('video/')
    const ext = file.name.split('.').pop()
    const path = `${communityId}/${user.id}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage.from('community-media').upload(path, file)
    if (!uploadError) {
      const { data } = supabase.storage.from('community-media').getPublicUrl(path)
      await supabase.from('community_messages').insert({
        community_id: communityId,
        sender_id: user.id,
        sender_name: profile?.full_name || user.email,
        media_url: data.publicUrl,
        media_type: isVideo ? 'video' : 'image',
      })
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleDeleted(id) {
    setMessages((prev) => prev.filter((m) => m.id !== id))
  }

  if (loading || !community) {
    return (
      <div className="app-shell">
        <div className="screen-scroll flex items-center justify-center text-gray-400">Loading…</div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <button
        onClick={() => navigate(`/communities/${communityId}/info`)}
        className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 text-left"
      >
        {community.avatar_url ? (
          <img src={community.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
        ) : (
          <span className="w-10 h-10 rounded-full bg-brand-light flex items-center justify-center">
            <Users size={18} className="text-brand-purple" />
          </span>
        )}
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">{community.name}</p>
          <p className="text-xs text-gray-400">{memberCount} members</p>
        </div>
      </button>

      <div className="screen-scroll px-4 py-3 flex flex-col gap-2">
        {messages.length === 0 ? (
          <p className="text-center text-gray-400 mt-8">No messages yet. Say hello!</p>
        ) : (
          messages.map((m) => (
            <CommunityMessageBubble
              key={m.id}
              message={m}
              isMine={m.sender_id === user.id}
              onDeleted={handleDeleted}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {isMember ? (
        <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-100">
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            <ImageIcon size={20} className={uploading ? 'text-gray-300' : 'text-brand-purple'} />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleMediaChange} className="hidden" />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Message the group… use @Name to mention"
            className="flex-1 border border-gray-200 rounded-full px-4 py-2.5 text-sm outline-brand-purple"
          />
          <button
            onClick={handleSend}
            disabled={sending}
            className="w-10 h-10 rounded-full bg-brand-purple flex items-center justify-center shrink-0 disabled:opacity-60"
          >
            <Send size={16} className="text-white" />
          </button>
        </div>
      ) : (
        <div className="px-4 py-3 border-t border-gray-100">
          <button onClick={handleJoin} className="w-full bg-brand-purple text-white font-medium py-3 rounded-xl text-sm">
            Join to send messages
          </button>
        </div>
      )}
    </div>
  )
}
