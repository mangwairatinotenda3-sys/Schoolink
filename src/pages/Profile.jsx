import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, Pencil, Share2, FileText, Link2, GraduationCap, Users, Landmark } from 'lucide-react'
import AvatarUpload from '../components/AvatarUpload.jsx'
import BottomNav from '../components/BottomNav.jsx'
import PostCard from '../components/PostCard.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { isPendingApproval, isSchoolMember } from '../lib/permissions.js'
import { useIsOnline } from '../lib/presence.jsx'

const tabs = ['Posts', 'About']

export default function Profile() {
  const navigate = useNavigate()
  const { profile, user } = useAuth()
  const isOnline = useIsOnline(user?.id)
  const [stats, setStats] = useState({ posts: 0, followers: 0, following: 0 })
  const [school, setSchool] = useState(null)
  const [activeTab, setActiveTab] = useState('Posts')
  const [posts, setPosts] = useState([])
  const [postsLoading, setPostsLoading] = useState(true)

  const name = profile?.full_name || user?.email?.split('@')[0] || 'Your Name'
  const role = profile?.role || 'Schoolink member'
  const links = (profile?.links || '').split('\n').map((l) => l.trim()).filter(Boolean)
  const isMember = isSchoolMember(profile)

  useEffect(() => {
    if (!user) return
    loadStats()
    loadPosts()
  }, [user])

  useEffect(() => {
    if (!profile?.school_id) {
      setSchool(null)
      return
    }
    supabase.from('schools').select('name, location').eq('id', profile.school_id).maybeSingle().then(({ data }) => setSchool(data))
  }, [profile?.school_id])

  async function loadStats() {
    const [{ count: postsCount }, { count: followersCount }, { count: followingCount }] = await Promise.all([
      supabase.from('posts').select('*', { count: 'exact', head: true }).eq('author_id', user.id),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('followed_id', user.id),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', user.id),
    ])
    setStats({ posts: postsCount ?? 0, followers: followersCount ?? 0, following: followingCount ?? 0 })
  }

  async function loadPosts() {
    setPostsLoading(true)
    const { data } = await supabase.from('posts').select('*').eq('author_id', user.id).order('created_at', { ascending: false })
    setPosts(data ?? [])
    setPostsLoading(false)
  }

  function handleShare() {
    const url = window.location.href
    if (navigator.share) navigator.share({ title: name, url })
    else navigator.clipboard?.writeText(url)
  }

  return (
    <div className="app-shell">
      <div className="bg-brand-navy text-white px-4 pt-4 pb-6">
        <button onClick={() => navigate(-1)} className="text-white/80">‹ Back</button>

        <div className="flex flex-col items-center mt-2">
          <div className="relative">
            <span className="w-24 h-24 rounded-full bg-white p-1 flex items-center justify-center">
              <AvatarUpload />
            </span>
            {isOnline ? (
              <span className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-green-500 border-2 border-brand-navy flex items-center justify-center">
                <span className="w-2 h-2 rounded-full bg-white" />
              </span>
            ) : null}
          </div>

          <p className="font-bold text-lg mt-3">{name}</p>
          <span className="text-[11px] bg-brand-purple/30 px-2 py-0.5 rounded-full mt-1">{role}</span>
          {isMember && school ? (
            <p className="text-sm text-white/70 flex items-center gap-1 mt-2">
              <MapPin size={13} /> {school.name}
              {isOnline ? <span className="text-green-400 ml-1">· Online</span> : null}
            </p>
          ) : null}
          {profile?.bio ? <p className="text-sm text-white/70 text-center mt-2 max-w-xs">{profile.bio}</p> : null}
        </div>

        <div className="grid grid-cols-3 gap-2 mt-5 text-center">
          <div>
            <span className="w-9 h-9 rounded-full bg-purple-500/30 mx-auto flex items-center justify-center mb-1"><FileText size={16} /></span>
            <p className="font-bold text-sm">{stats.posts}</p>
            <p className="text-[10px] text-white/50">Posts</p>
          </div>
          <button onClick={() => navigate('/connections/followers')}>
            <span className="w-9 h-9 rounded-full bg-green-500/30 mx-auto flex items-center justify-center mb-1"><Users size={16} /></span>
            <p className="font-bold text-sm">{stats.followers}</p>
            <p className="text-[10px] text-white/50">Followers</p>
          </button>
          <button onClick={() => navigate('/connections/following')}>
            <span className="w-9 h-9 rounded-full bg-blue-500/30 mx-auto flex items-center justify-center mb-1"><Users size={16} /></span>
            <p className="font-bold text-sm">{stats.following}</p>
            <p className="text-[10px] text-white/50">Following</p>
          </button>
        </div>
      </div>

      {isPendingApproval(profile) ? (
        <div className="bg-yellow-50 text-yellow-700 text-sm text-center py-2 px-4">
          Your student request is awaiting approval from your school's admin.
        </div>
      ) : null}

      <div className="screen-scroll px-4">
        <div className="flex gap-2 mt-3">
          <button onClick={() => navigate('/edit-profile-details')} className="flex-1 flex items-center justify-center gap-1.5 border border-gray-200 rounded-xl py-2.5 text-sm font-medium">
            <Pencil size={15} /> Edit Profile
          </button>
          <button onClick={handleShare} className="flex-1 flex items-center justify-center gap-1.5 border border-brand-purple text-brand-purple rounded-xl py-2.5 text-sm font-medium">
            <Share2 size={15} /> Share Profile
          </button>
        </div>

        {isMember ? (
          <button onClick={() => navigate('/school-profile')} className="w-full flex items-center justify-center gap-1.5 bg-brand-light text-brand-purple rounded-xl py-2.5 text-sm font-medium mt-2">
            <Landmark size={15} /> My School
          </button>
        ) : null}

        <div className="flex gap-5 mt-4 border-b border-gray-100">
          {tabs.map((t) => (
            <button key={t} onClick={() => setActiveTab(t)} className={`pb-2 text-sm font-medium border-b-2 ${activeTab === t ? 'border-brand-purple text-brand-purple' : 'border-transparent text-gray-400'}`}>
              {t}
            </button>
          ))}
        </div>

        <div className="py-4 pb-6">
          {activeTab === 'Posts' ? (
            postsLoading ? (
              <p className="text-center text-gray-400 mt-6">Loading…</p>
            ) : posts.length === 0 ? (
              <p className="text-center text-gray-400 mt-6">You haven't posted anything yet.</p>
            ) : (
              <div className="space-y-3">
                {posts.map((p) => (
                  <PostCard key={p.id} post={p} onDeleted={(id) => setPosts((prev) => prev.filter((x) => x.id !== id))} />
                ))}
              </div>
            )
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Location</p>
                <p className="text-sm text-gray-600">{profile?.location || 'Not set'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Links</p>
                {links.length > 0 ? (
                  links.map((link) => (
                    <a key={link} href={link} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-brand-purple truncate">
                      <Link2 size={14} className="shrink-0" /> {link}
                    </a>
                  ))
                ) : (
                  <p className="text-sm text-gray-400">No links added</p>
                )}
              </div>
              {isMember && school ? (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Education</p>
                  <div className="flex items-center gap-3 border border-gray-100 rounded-xl p-3">
                    <span className="w-9 h-9 rounded-full bg-brand-light flex items-center justify-center shrink-0"><GraduationCap size={18} className="text-brand-purple" /></span>
                    <div>
                      <p className="text-sm font-medium">{school.name}</p>
                      <p className="text-xs text-gray-400">{role}</p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  )
    }
