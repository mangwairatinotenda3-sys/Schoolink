import {
  ChevronRight,
  Shield,
  Lock,
  Palette,
  Eye,
  Bell,
  Database,
  HelpCircle,
  RefreshCw,
  UserPlus,
  Users,
  Clock,
  BookOpen,
  DollarSign,
  Trophy,
  Laptop,
  CalendarDays,
  ClipboardList,
  Table,
  BarChart3,
  GraduationCap,
  HeartHandshake,
  UserCheck,
  Globe,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import BackHeader from '../components/BackHeader.jsx'
import BottomNav from '../components/BottomNav.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { canManageStaff, canManageFees, canManageSports, canManageDevices } from '../lib/permissions.js'

const colors = [
  'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-red-500',
  'bg-teal-500', 'bg-indigo-500', 'bg-pink-500', 'bg-amber-500', 'bg-cyan-500',
  'bg-emerald-500', 'bg-rose-500', 'bg-violet-500', 'bg-lime-600', 'bg-sky-500',
]

export default function Settings() {
  const navigate = useNavigate()
  const { signOut, profile, user } = useAuth()

  const name = profile?.full_name || user?.email?.split('@')[0] || 'Your Name'

  const items = [
    { label: 'Account', sub: 'Security, personal information', icon: Shield, to: '/settings/account' },
    { label: 'Privacy', sub: 'Block, visibility, read receipts', icon: Lock, to: '/settings/privacy' },
    { label: 'School Calendar', sub: 'Events, RSVPs', icon: CalendarDays, to: '/calendar' },
    { label: 'Polls & Surveys', sub: 'Vote and see school opinions', icon: BarChart3, to: '/polls' },
    { label: 'Alumni', sub: 'Connect with former students', icon: GraduationCap, to: '/alumni' },
    { label: 'School Achievements', sub: 'Awards, records, milestones', icon: Trophy, to: '/achievements' },
    { label: 'Homework & Assignments', sub: 'View and post assignments', icon: ClipboardList, to: '/assignments' },
    { label: 'Timetable', sub: 'Class schedule by day', icon: Table, to: '/timetable' },
    { label: 'Library', sub: 'Novels, textbooks, past exam papers', icon: BookOpen, to: '/library' },
    ...(canManageFees(profile)
      ? [{ label: 'Bursar Dashboard', sub: 'Fees, income, expenses', icon: DollarSign, to: '/bursar' }]
      : []),
    ...(canManageSports(profile)
      ? [{ label: 'Coach Dashboard', sub: 'Fixtures, teams, results', icon: Trophy, to: '/coach' }]
      : []),
    ...(canManageDevices(profile)
      ? [{ label: 'ICT Dashboard', sub: 'Device management, resources', icon: Laptop, to: '/ict' }]
      : []),
    ...(['Guidance & Counselling', 'Headteacher', 'Deputy Head'].includes(profile?.role)
      ? [{ label: 'Guidance & Counselling', sub: 'Student appointments', icon: HeartHandshake, to: '/counselling' }]
      : []),
    ...(['Receptionist', 'Headteacher', 'Deputy Head'].includes(profile?.role)
      ? [{ label: 'Receptionist Dashboard', sub: 'Visitors, parent appointments', icon: UserCheck, to: '/reception' }]
      : []),
    { label: 'Chat Appearance', sub: 'Theme, wallpaper, chat settings', icon: Palette, to: '/settings/chat-appearance' },
    { label: 'Accessibility', sub: 'Text size, display, contrast', icon: Eye, to: '/settings/accessibility' },
    { label: 'App Language', sub: 'English (United States)', icon: Globe, to: '/settings/language' },
    { label: 'Notifications', sub: 'Message, group & call tones', icon: Bell, to: '/settings/notifications' },
    { label: 'Storage and Data', sub: 'Network usage, auto-download', icon: Database, to: '/settings/storage' },
    { label: 'Staff Directory', sub: 'View everyone at your school', icon: Users, to: '/staff-directory' },
    ...(canManageStaff(profile)
      ? [
          { label: 'Invite a Member', sub: 'Invite staff, parents or others', icon: UserPlus, to: '/invite-member' },
          { label: 'Pending Approvals', sub: 'Review student join requests', icon: Clock, to: '/pending-approvals' },
        ]
      : []),
    { label: 'Help and Feedback', sub: 'Help center, contact us', icon: HelpCircle, to: '/settings/help' },
    { label: 'Updates', sub: 'Check for new updates', icon: RefreshCw, to: '/settings/updates' },
  ]

  return (
    <div className="app-shell">
      <BackHeader title="Settings" />

      <div className="px-4 pt-2 pb-3 flex items-center gap-3 border-b border-gray-100">
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover" />
        ) : (
          <span className="w-14 h-14 rounded-full bg-brand-light flex items-center justify-center text-2xl">🙂</span>
        )}
        <div className="min-w-0">
          <p className="font-semibold truncate">{name}</p>
          {profile?.role ? (
            <span className="inline-block text-[11px] font-medium text-brand-purple bg-brand-light px-2 py-0.5 rounded-full mt-0.5">
              {profile.role}
            </span>
          ) : null}
          {profile?.bio ? <p className="text-xs text-gray-400 truncate mt-1">{profile.bio}</p> : null}
        </div>
      </div>

      <div className="screen-scroll divide-y divide-gray-100 px-4">
        {items.map(({ label, sub, icon: Icon, to }, i) => (
          <button
            key={label}
            onClick={() => to && navigate(to)}
            className="w-full flex items-center justify-between py-3.5"
          >
            <span className="flex items-center gap-3">
              <span className={`w-9 h-9 rounded-full flex items-center justify-center ${colors[i % colors.length]}`}>
                <Icon size={16} className="text-white" />
              </span>
              <span className="text-left">
                <span className="block font-medium text-sm">{label}</span>
                <span className="block text-xs text-gray-400">{sub}</span>
              </span>
            </span>
            <ChevronRight size={18} className="text-gray-300" />
          </button>
        ))}

        <button onClick={signOut} className="w-full text-left py-4 text-red-500 font-medium text-sm">
          Sign Out
        </button>
      </div>
      <BottomNav />
    </div>
  )
  }
