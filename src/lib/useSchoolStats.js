import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient.js'

export function useSchoolStats(schoolId, userId) {
  const [stats, setStats] = useState({
    members: 0,
    posts: 0,
    likes: 0,
    comments: 0,
    followers: 0,
    pendingApprovals: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!schoolId || !userId) {
      setLoading(false)
      return
    }
    loadStats()
  }, [schoolId, userId])

  async function loadStats() {
    setLoading(true)

    const { data: memberRows } = await supabase
      .from('profiles')
      .select('id')
      .eq('school_id', schoolId)
      .eq('status', 'active')
    const memberIds = (memberRows ?? []).map((m) => m.id)

    const { count: pendingCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('status', 'pending')

    const { data: postRows } = await supabase
      .from('posts')
      .select('id')
      .in('author_id', memberIds.length > 0 ? memberIds : ['00000000-0000-0000-0000-000000000000'])
    const postIds = (postRows ?? []).map((p) => p.id)

    let likesCount = 0
    let commentsCount = 0
    if (postIds.length > 0) {
      const { count: lc } = await supabase
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .in('post_id', postIds)
      likesCount = lc ?? 0

      const { count: cc } = await supabase
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .in('post_id', postIds)
      commentsCount = cc ?? 0
    }

    const { count: followersCount } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .in('followed_id', memberIds.length > 0 ? memberIds : ['00000000-0000-0000-0000-000000000000'])

    setStats({
      members: memberIds.length,
      posts: postIds.length,
      likes: likesCount,
      comments: commentsCount,
      followers: followersCount ?? 0,
      pendingApprovals: pendingCount ?? 0,
    })
    setLoading(false)
  }

  return { stats, loading, refresh: loadStats }
        }
