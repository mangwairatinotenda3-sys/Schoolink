import { useNavigate } from 'react-router-dom'
import {
  CalendarDays, BarChart3, ClipboardList, Table, BookOpen, Users, GraduationCap,
  Trophy, Briefcase, DollarSign, Laptop, HeartHandshake, UserCheck, UserPlus,
  Clock, Bookmark, MessagesSquare, Award,
} from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import BottomNav from '../components/BottomNav.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { canManageStaff, canManageFees, canManageSports, canManageDevices, isStaffMember } from '../lib/permissions.js'

export default function MoreHub() {
  const navigate = useNavigate()
  const { profile } = useAuth()

  const tiles = [
    { label: 'Saved', icon: Bookmark, color: 'bg-gray-500', to: '/saved' },
    { label: 'Communities', icon: MessagesSquare, color: 'bg-indigo-500', to: '/communities' },
    { label: 'Calendar', icon: CalendarDays, color: 'bg-blue-500', to: '/calendar' },
    { label: 'Polls', icon: BarChart3, color: 'bg-emerald-500', to: '/polls' },
    { label: 'Assignments', icon: ClipboardList, color: 'bg-orange-500', to: '/assignments' },
    { label: 'Timetable', icon: Table, color: 'bg-purple-500', to: '/timetable' },
    { label: 'Library', icon: BookOpen, color: 'bg-teal-500', to: '/library' },
    { label: 'Alumni', icon: GraduationCap, color: 'bg-rose-500', to: '/alumni' },
    { label: 'Achievements', icon: Trophy, color: 'bg-amber-500', to: '/achievements' },
    { label: 'Staff Directory', icon: Users, color: 'bg-sky-500', to: '/staff-directory' },
    { label: 'Browse Schools', icon: MessagesSquare, color: 'bg-blue-600', to: '/schools' },
    { label: 'Search', icon: Users, color: 'bg-slate-500', to: '/search' },
    ...(profile?.account_type === 'investor'
      ? [{ label: 'My Proposals', icon: Briefcase, color: 'bg-emerald-600', to: '/schools' }]
      : []),
    ...(canManageStaff(profile)
      ? [{ label: 'Investor Proposals', icon: Briefcase, color: 'bg-emerald-700', to: '/proposals' }]
      : []),
    ...(isStaffMember(profile)
      ? [{ label: 'Exam Results', icon: Award, color: 'bg-red-600', to: '/exam-results' }]
      : []),
    ...(isStaffMember(profile) ? [{ label: 'Analytics', icon: BarChart3, color: 'bg-violet-500', to: '/dashboard' }] : []),
    ...(canManageFees(profile) ? [{ label: 'Bursar', icon: DollarSign, color: 'bg-green-600', to: '/bursar' }] : []),
    ...(canManageSports(profile) ? [{ label: 'Coach', icon: Trophy, color: 'bg-orange-600', to: '/coach' }] : []),
    ...(canManageDevices(profile) ? [{ label: 'ICT', icon: Laptop, color: 'bg-cyan-600', to: '/ict' }] : []),
    ...(['Guidance & Counselling', 'Headteacher', 'Deputy Head'].includes(profile?.role)
      ? [{ label: 'Counselling', icon: HeartHandshake, color: 'bg-pink-500', to: '/counselling' }]
      : []),
    ...(['Receptionist', 'Headteacher', 'Deputy Head'].includes(profile?.role)
      ? [{ label: 'Reception', icon: UserCheck, color: 'bg-lime-600', to: '/reception' }]
      : []),
    ...(canManageStaff(profile)
      ? [
          { label: 'Invite Member', icon: UserPlus, color: 'bg-brand-purple', to: '/invite-member' },
          { label: 'Pending Approvals', icon: Clock, color: 'bg-red-500', to: '/pending-approvals' },
        ]
      : []),
  ]

  return (
    <div className="app-shell">
      <BackHeader title="More" />
      <div className="screen-scroll px-4 pt-3">
        <div className="grid grid-cols-3 gap-3">
          {tiles.map(({ label, icon: Icon, color, to }) => (
            <button
              key={label}
              onClick={() => navigate(to)}
              className="flex flex-col items-center gap-2 py-4 border border-gray-100 rounded-xl"
            >
              <span className={`w-11 h-11 rounded-full ${color} flex items-center justify-center`}>
                <Icon size={18} className="text-white" />
              </span>
              <span className="text-xs font-medium text-center">{label}</span>
            </button>
          ))}
        </div>
      </div>
      <BottomNav />
    </div>
  )
  }
