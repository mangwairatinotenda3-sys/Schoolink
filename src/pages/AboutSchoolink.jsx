import { useNavigate } from 'react-router-dom'
import { GraduationCap, MessageSquare, Users, Library, CalendarDays, ShieldCheck, HelpCircle, FileText, RefreshCw, ChevronRight } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import MetaBadge from '../components/MetaBadge.jsx'

const features = [
  { icon: Users, title: 'One app, many schools', text: 'Every school has its own members, posts and identity.' },
  { icon: MessageSquare, title: 'Chats and communities', text: 'Real-time messages and group spaces for classes, clubs and teams.' },
  { icon: Library, title: 'A library that crosses borders', text: 'Novels, textbooks and past papers in one place.' },
  { icon: CalendarDays, title: 'Calendar, timetables, assignments', text: 'What is happening and what is due, in one view.' },
  { icon: ShieldCheck, title: 'Trusted by design', text: 'Roles are enforced in the database, and verified schools and people carry the blue badge.' },
]

const links = [
  { label: 'Help & Support', icon: HelpCircle, to: '/settings/help' },
  { label: 'Terms of Service', icon: FileText, to: '/terms' },
  { label: 'Privacy Policy', icon: ShieldCheck, to: '/privacy' },
]

export default function AboutSchoolink() {
  const navigate = useNavigate()

  return (
    <div className="app-shell">
      <BackHeader title="About Schoolink" dark />
      <div className="screen-scroll">
        <div
          className="flex flex-col items-center text-center px-6 py-8"
          style={{ background: 'linear-gradient(160deg, #1B1450, #4F46E5)', color: '#fff' }}
        >
          <span
            className="flex items-center justify-center"
            style={{ width: 72, height: 72, borderRadius: 22, background: 'linear-gradient(135deg, #8B5CF6, #4F46E5)' }}
          >
            <GraduationCap size={40} color="#fff" />
          </span>
          <p className="flex items-center gap-2 mt-3" style={{ fontSize: 26, fontWeight: 800 }}>
            Schoolink <MetaBadge size={22} />
          </p>
          <p style={{ fontSize: 13, color: '#C7D2FE' }}>Connect &nbsp;•&nbsp; Learn &nbsp;•&nbsp; Grow</p>
          <p style={{ fontSize: 14, color: '#E0E7FF', marginTop: 14 }}>
            Where every school finds its voice, and every voice finds its school.
          </p>
        </div>

        <div className="px-5 pt-5">
          <p className="font-semibold">What is Schoolink?</p>
          <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
            Schoolink is a social platform built around how a school actually works: Headteachers who need oversight,
            teachers who need to reach their students, students who need to find their people, and parents who just
            want to know what is going on.
          </p>

          <div className="mt-5 space-y-3">
            {features.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex items-start gap-3">
                <span className="w-10 h-10 rounded-xl bg-brand-light flex items-center justify-center shrink-0">
                  <Icon size={18} className="text-brand-purple" />
                </span>
                <div>
                  <p className="text-sm font-medium">{title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{text}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 divide-y divide-gray-100 border border-gray-100 rounded-2xl">
            {links.map(({ label, icon: Icon, to }) => (
              <button key={to} onClick={() => navigate(to)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left">
                <Icon size={18} className="text-brand-purple" />
                <span className="flex-1 text-sm">{label}</span>
                <ChevronRight size={16} className="text-gray-300" />
              </button>
            ))}
          </div>

          <button
            onClick={() => window.location.reload()}
            className="w-full mt-4 flex items-center justify-center gap-2 border border-brand-purple text-brand-purple font-medium py-2.5 rounded-xl text-sm"
          >
            <RefreshCw size={16} /> Check for updates
          </button>

          <p className="text-center text-xs text-gray-400 mt-6 mb-4">
            Made for the schools that never quite fit into someone else's app.
          </p>
        </div>
      </div>
    </div>
  )
}
