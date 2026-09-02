import { useEffect, useState } from 'react'
import { ChevronRight, UserSquare2, Briefcase, FileText, Users, Link2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav.jsx'
import AvatarUpload from '../components/AvatarUpload.jsx'
import CoverPhotoUpload from '../components/CoverPhotoUpload.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { isPendingApproval, isStaffMember, isSchoolMember } from '../lib/permissions.js'

export default function Profile() {
  const navigate = useNavigate()
  const { profile, user } = useAuth()
  const [stats, setStats] = useState({ posts: 0, followers: 0, following: 0 })
  const [school, setSchool] = useState(null)

  const name = profile?.full_name || user?.email?.split('@')[0] || 'Your Name'
  const role = profile?.role || 'Add your role'
  const links = (profile?.links || '').split('\n').map((l) => l.trim()).filter(Boolean)

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
    ...(isSchoolMember(profile)
      ? [{ label: 'My School Profile', icon: UserSquare2, to: '/school-profile' }]
      : []),
    ...(isStaffMember(profile)
      ? [{ label: 'Professional Dashboard', icon: Briefcase, to: '/dashboard' }]
      : []),
    { label: 'My Posts', icon: FileText, to: '/my-posts' },
    { label: 'Groups & Communities', icon: Users, to: '/communities' },
    ...(isSchoolMember(profile)
      ? [{ label: 'Connections', icon: Link2, to: '/connections/following' }]
      : []),
  ]

  return (
    <div className="app-shell">
      <CoverPhotoUpload />

      <div className="px-4 -mt-10">
        <AvatarUpload />
        <p className="font-semibold text-lg mt-2">{name}</p>
        <p className="text-sm text-gray-500">{role}</p>
        {school ? <p className="text-sm text-gray-500">{school.name} · {school.location}</p> : null}
        {profile?.bio ? <p className="text-sm text-gray-700 mt-2">{profile.bio}</p> : null}
      </div>

      {isPendingApproval(profile) ? (
        <div className="bg-yellow-50 text-yellow-700 text-sm text-center py-2 px-4 mt-3">
          Your student request is awaiting approval from your school's admin.
        </div>
      ) : null}

      <div className="screen-scroll">
        <div className="flex justify-around py-4 border-b border-gray-100 mt-3">
          <div className="text-center">
            <p className="font-bold">{stats.posts}</p>
            <p className="text-xs text-gray-400">Posts</p>
          </div>
          <button onClick={() => navigate('/connections/followers')} className="text-center">
            <p className="font-bold">{stats.followers}</p>
            <p className="text-xs text-gray-400">Followers</p>
          </button>
          <button onClick={() => navigate('/connections/following')} className="text-center">
            <p className="font-bold">{stats.following}</p>
            <p className="text-xs text-gray-400">Following</p>
          </button>
        </div>

        <div className="px-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-sm">Personal Details</p>
            <button onClick={() => navigate('/edit-profile-details')}>
              <ChevronRight size={15} className="text-gray-400" />
            </button>
          </div>
          <div className="mt-2 space-y-2">
            {profile?.location ? (
              <p className="text-sm text-gray-600">{profile.location}</p>
            ) : (
              <p className="text-sm text-gray-400">No location added yet</p>
            )}
          </div>
        </div>

        <div className="px-4 mt-5">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-sm">Links</p>
            <button onClick={() => navigate('/edit-profile-details')}>
              <ChevronRight size={15} className="text-gray-400" />
            </button>
          </div>
          <div className="mt-2 space-y-1">
            {links.length > 0 ? (
              links.map((link) => (
                <a key={link} href={link} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-brand-purple truncate">
                  <Link2 size={15} className="text-gray-400 shrink-0" /> {link}
                </a>
              ))
            ) : (
              <p className="text-sm text-gray-400">No links added yet</p>
            )}
          </div>
        </div>

        {school ? (
          <div className="px-4 mt-5">
            <p className="font-semibold text-sm mb-2">Education</p>
            <div className="flex items-center gap-3 border border-gray-100 rounded-xl p-3">
              <span className="w-9 h-9 rounded-full bg-brand-light flex items-center justify-center shrink-0">
                <UserSquare2 size={18} className="text-brand-purple" />
              </span>
              <div>
                <p className="text-sm font-medium">{school.name}</p>
                <p className="text-xs text-gray-400">{role}</p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="divide-y divide-gray-100 px-4 mt-5">
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
