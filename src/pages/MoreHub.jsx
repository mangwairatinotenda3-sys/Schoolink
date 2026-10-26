import { useNavigate } from 'react-router-dom'
import {
  CalendarDays, BarChart3, ClipboardList, Table, BookOpen, Users, GraduationCap,
  Trophy, Briefcase, MessagesSquare, Award,
} from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import BottomNav from '../components/BottomNav.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { isStaffMember } from '../lib/permissions.js'

// School dashboards (Analytics, Bursar, Coach, ICT, Counselling, Reception,
// Pending approvals, Investor proposals) now live in School dashboard on the school profile.
export default function MoreHub() {
  const navigate = useNavigate()
  const { profile } = useAuth()

  const isParent = profile?.account_type === 'parent' || profile?.role === 'Parent / Guardian'
  const isStudent = profile?.account_type === 'school_member' && profile?.role === 'Student'
  const isFamilyStaff = ['Headteacher', 'Deputy Head', 'Teacher / Tutor', 'Receptionist'].includes(profile?.role)

  const tiles = [
    { label: 'Communities', icon: MessagesSquare, color: 'bg-indigo-500', to: '/communities' },
    { label: 'Calendar', icon: CalendarDays, color: 'bg-blue-500', to: '/calendar' },
    { label: 'Polls', icon: BarChart3, color: 'bg-emerald-500', to: '/polls' },
    { label: 'Assignments', icon: ClipboardList, color: 'bg-orange-500', to: '/assignments' },
    { label: 'Timetable', icon: Table, color: 'bg-purple-500', to: '/timetable' },
    { label: 'Library', icon: BookOpen, color: 'bg-teal-500', to: '/library' },
    { label: 'Alumni', icon: GraduationCap, color: 'bg-rose-500', to: '/alumni' },
    { label: 'Achievements', icon: Trophy, color: 'bg-amber-500', to: '/achievements' },
    ...(profile?.account_type === 'investor'
      ? [{ label: 'My Proposals', icon: Briefcase, color: 'bg-emerald-600', to: '/schools' }]
      : []),
    ...(isStaffMember(profile)
      ? [{ label: 'Exam Results', icon: Award, color: 'bg-red-600', to: '/exam-results' }]
      : []),
    ...(isStudent || isParent
      ? [{ label: 'Report Card', icon: Award, color: 'bg-red-600', to: '/exam-results' }]
      : []),
    ...(isParent
      ? [{ label: 'My Children', icon: Users, color: 'bg-pink-500', to: '/family' }]
      : []),
    ...(isStudent
      ? [{ label: 'My Parents', icon: Users, color: 'bg-pink-500', to: '/family' }]
      : []),
    ...(isFamilyStaff
      ? [{ label: 'Parent Links', icon: Users, color: 'bg-pink-500', to: '/family' }]
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
