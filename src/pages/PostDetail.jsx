import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import BackHeader from '../components/BackHeader.jsx'
import PostCard from '../components/PostCard.jsx'
import { supabase } from '../lib/supabaseClient.js'

export default function PostDetail() {
  const { postId } = useParams()
  const navigate = useNavigate()
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    loadPost()
  }, [postId])

  async function loadPost() {
    setLoading(true)
    const { data } = await supabase.from('posts').select('*').eq('id', postId).maybeSingle()
    if (!data) {
      setNotFound(true)
    } else {
      setPost(data)
    }
    setLoading(false)
  }

  function handleDeleted() {
    navigate('/home', { replace: true })
  }

  return (
    <div className="app-shell">
      <BackHeader title="Post" />
      <div className="screen-scroll px-4 pt-3">
        {loading ? (
          <p className="text-center text-gray-400 mt-8">Loading…</p>
        ) : notFound ? (
          <p className="text-center text-gray-400 mt-8">This post no longer exists.</p>
        ) : (
          <PostCard post={post} onDeleted={handleDeleted} expandComments />
        )}
      </div>
    </div>
  )
         }
