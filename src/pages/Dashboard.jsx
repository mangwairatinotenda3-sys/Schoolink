import { ChevronDown, Users, TrendingUp, Heart, Eye } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import BottomNav from '../components/BottomNav.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const stats = [
  { label: 'Visitors', value: '2.4K', change: '+18% this week', icon: Users },
  { label: 'Engagement', value: '1.1K', change: '+25% this week', icon: TrendingUp },
  { label: 'Followers', value: '1.2K', change: '+15% this week', icon: Heart },
  { label: 'Post Views', value: '5.6K', change: '+30% this week', icon: Eye },
]

export default function Dashboard() {
  const { profile, user } = useAuth()
  const name = profile?.full_name || user?.email?.split('@')[0] || 'there'

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader />
      <div className="screen-scroll px-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-sm">Welcome back,</p>
            <h2 className="text-xl font-bold">{name} 👋</h2>
          </div>
          <ChevronDown className="text-gray-400" />
        </div>

        <div className="bg-brand-light rounded-xl p-4 mt-4">
          <p className="font-semibold">Professional Dashboard</p>
          <p className="text-sm text-gray-500">Overview of your school activity</p>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          {stats.map(({ label, value, change, icon: Icon }) => (
            <div key={label} className="border border-gray-100 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">{label}</p>
                <Icon size={16} className="text-brand-purple" />
              </div>
              <p className="text-xl font-bold mt-1">{value}</p>
              <p className="text-xs text-green-500">{change}</p>
            </div>
          ))}
        </div>
      </div>
      <BottomNav />
    </div>
  )
  }
