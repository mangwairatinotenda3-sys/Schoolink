import { Users, FileText, Heart, MessageCircle, UserPlus, Clock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import BackHeader from '../components/BackHeader.jsx'
import BottomNav from '../components/BottomNav.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useSchoolStats } from '../lib/useSchoolStats.js'
import { canManageStaff, isSchoolMember } from '../lib/permissions.js'

export default function Dashboard() {
  const navigate = useNavigate()
  const { profile, user } = useAuth()
  const { stats, loading } = useSchoolStats(profile?.school_id, user?.id)

  const name = profile?.full_name || user?.email?.split('@')[0] || 'there'

  const statCards = [
    { label: 'School Members', value: stats.members, icon: Users },
    { label: 'Total Posts', value: stats.posts, icon: FileText },
    { label: 'Likes Received', value: stats.likes, icon: Heart },
    { label: 'Comments Received', value: stats.comments, icon: MessageCircle },
    { label: 'Total Followers', value: stats.followers, icon: UserPlus },
    { label: 'Pending Approvals', value: stats.pendingApprovals, icon: Clock, to: '/pending-approvals' },
  ]

  if (!isSchoolMember(profile)) {
    return (
      <div className="flex-1 flex flex-col">
        <BackHeader title="Dashboard" />
        <div className="screen-scroll px-6 flex items-center justify-center text-center text-gray-400">
          You need to belong to a school to view its dashboard.
        </div>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader />
      <div className="screen-scroll px-4">
        <div>
          <p className="text-gray-500 text-sm">Welcome back,</p>
          <h2 className="text-xl font-bold">{name} 👋</h2>
        </div>

        <div className="bg-brand-light rounded-xl p-4 mt-4">
          <p className="font-semibold">
            {canManageStaff(profile) ? 'Professional Dashboard' : 'Your School Activity'}
          </p>
          <p className="text-sm text-gray-500">Real-time overview of your school</p>
        </div>

        {loading ? (
          <p className="text-center text-gray-400 mt-8">Loading stats…</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 mt-4 mb-4">
            {statCards.map(({ label, value, icon: Icon, to }) => (
              <button
                key={label}
                onClick={() => to && navigate(to)}
                disabled={!to}
                className="border border-gray-100 rounded-xl p-4 text-left"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">{label}</p>
                  <Icon size={16} className="text-brand-purple" />
                </div>
                <p className="text-xl font-bold mt-1">{value}</p>
              </button>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  )
      }
