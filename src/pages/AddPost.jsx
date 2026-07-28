import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { isSchoolMember } from '../lib/permissions.js'

export default function AddPost() {
  const navigate = useNavigate()
  const { profile, user } = useAuth()
  const [content, setContent] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handlePost() {
    if (!content.trim()) return
    setBusy(true)
    setError('')
    const { error: insertError } = await supabase.from('posts').insert({
      author_id: user.id,
      author_name: profile?.full_name || user.email,
      author_role: profile?.role || '',
      content,
    })
    setBusy(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    navigate('/home')
  }

  if (!isSchoolMember(profile)) {
    return (
      <div className="flex-1 flex flex-col">
        <BackHeader title="Create Post" />
        <div className="screen-scroll px-6 flex flex-col items-center justify-center text-center gap-2">
          <p className="text-gray-500">
            Only school staff members can post. Join a school with an invite code from Settings to unlock posting.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader title="Create Post" />
      <div className="flex-1 flex flex-col px-4 pt-2">
        <textarea
          autoFocus
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What's on your mind?"
          rows={8}
          className="border border-gray-200 rounded-xl p-4 outline-brand-purple resize-none"
        />
        {error ? <p className="text-red-500 text-sm mt-2">{error}</p> : null}
        <button
          onClick={handlePost}
          disabled={busy}
          className="mt-4 w-full bg-brand-purple text-white font-medium py-3.5 rounded-xl disabled:opacity-60"
        >
          {busy ? 'Posting…' : 'Post'}
        </button>
      </div>
    </div>
  )
      }
