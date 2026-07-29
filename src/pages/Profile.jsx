import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, UserSquare2, Briefcase, FileText, Users, Bookmark, Link2, User, Clock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav.jsx'
import AvatarUpload from '../components/AvatarUpload.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { canManageStaff, isPendingApproval } from '../lib/permissions.js'

export default function Profile() {
  const navigate = useNavigate()
  const { profile, user } = useAuth()
  const [stats, setStats] = useState({ posts: 0, followers: 0, following: 0 })
  const [school, setSchool] = useState(null)

  const name = profile?.full_name || user?.email?.split('@')[0] || 'Your Name'
  const role = profile?.role || 'Add your role'

  useEffect(() => {
    if (!user) return
    loadStats()
  }, [user])

  useEffect(() => {
    if (!profile?.school_id) {
      setSchool(null)
      return
    }
    supabase
      .from('schools')
      .select('name, location')
      .eq('id', profile.school_id)
      .maybeSingle()
      .then(({ data }) => setSchool(data))
  }, [profile?.school_id])

  async function loadStats() {
    const [{ count: postsCount }, { count: followersCount }, { count: followingCount }] = await Promise.all([
      supabase.from('posts').select('*', { count: 'exact', head: true }).eq('author_id', user.id),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('followed_id', user.id),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', user.id),
    ])
    setStats({
      posts: postsCount ?? 0,
      followers: followersCount ?? 0,
      following: followingCount ?? 0,
    })
  }

  const menuItems = [
    { label: 'My School Profile', icon: UserSquare2, to: '/school-profile' },
    { label: 'Professional Dashboard', icon: Briefcase, to: '/dashboard' },
    { label: 'My Posts', icon: FileText },
    { label: 'Groups & Communities', icon: Users },
    { label: 'Staff Directory', icon: Users, to: '/staff-directory' },
    ...(canManageStaff(profile)
      ? [{ label: 'Pending Approvals', icon: Clock, to: '/pending-approvals' }]
      : []),
    { label: 'Saved Items', icon: Bookmark, to: '/saved' },
    { label: 'Connections', icon: Link2 },
    { label: 'Account Information', icon: User, to: '/settings' },
  ]

  return (
    <div className="flex-1 flex flex-col">
      <div className="bg-brand-navy text-white px-4 pt-4 pb-6">
        <button onClick={() => navigate(-1)}>
          <ChevronLeft size={22} />
        </button>
        <div className="flex flex-col items-center mt-2">
          <AvatarUpload />
          <p className="font-semibold mt-2">{name}</p>
          <p className="text-sm text-white/70">{role}</p>
          <p className="text-sm text-white/70">{school?.name || 'No school yet'}</p>
          <p className="text-xs text-white/50">{school?.location || ''}</p>
        </div>
      </div>

      {isPendingApproval(profile) ? (
        <div className="bg-yellow-50 text-yellow-700 text-sm text-center py-2 px-4">
          Your student request is awaiting approval from your school's admin.
        </div>
      ) : null}

      <div className="screen-scroll">
        <div className="flex justify-around py-4 border-b border-gray-100">
          <div className="text-center">
            <p className="font-bold">{stats.posts}</p>
            <p className="text-xs text-gray-400">Posts</p>
          </div>
          <div className="text-center">
            <p className="font-bold">{stats.followers}</p>
            <p className="text-xs text-gray-400">Followers</p>
          </div>
          <div className="text-center">
            <p className="font-bold">{stats.following}</p>
            <p className="text-xs text-gray-400">Following</p>
          </div>
        </div>

        <div className="divide-y divide-gray-100 px-4">
          {menuItems.map(({ label, icon: Icon, to }) => (
            <button
              key={label}
              onClick={() => to && navigate(to)}
              className="w-full flex items-center justify-between py-4"
            >
              <span className="flex items-center gap-3">
                <Icon size={18} className="text-brand-purple" />
                <span className="font-medium text-sm">{label}</span>
              </span>
              <ChevronRight size={18} className="text-gray-300" />
            </button>
          ))}
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
