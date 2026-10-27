import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X, PenSquare, Sparkles, Image as ImageIcon, Video, FileText, Megaphone, CalendarPlus, BarChart3, ClipboardList, ChevronRight,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { isSchoolMember, isStaffMember } from '../lib/permissions.js'

// The "+" menu: one place to start anything new.
export default function CreateSheet({ open, onClose }) {
  const navigate = useNavigate()
  const { profile, user } = useAuth()
  const [draft, setDraft] = useState('')

  useEffect(() => {
    if (!open) return
    try {
      const saved = JSON.parse(localStorage.getItem(`schoolink_post_draft_${user?.id || 'x'}`) || 'null')
      setDraft(saved?.content?.trim() || '')
    } catch {
      setDraft('')
    }
  }, [open, user?.id])

  if (!open) return null

  const member = isSchoolMember(profile)
  const staff = isStaffMember(profile)

  function go(path) {
    onClose()
    navigate(path)
  }

  const quick = [
    { label: 'Photos', icon: ImageIcon, color: '#16A34A', bg: '#DCFCE7', to: '/add-post?mode=photo', school: true },
    { label: 'Video', icon: Video, color: '#DC2626', bg: '#FEE2E2', to: '/add-post?mode=video', school: true },
    { label: 'File', icon: FileText, color: '#2563EB', bg: '#DBEAFE', to: '/add-post?mode=file', school: true },
    { label: 'Notice', icon: Megaphone, color: '#D97706', bg: '#FEF3C7', to: '/add-post?mode=announcement', school: true },
  ].filter((q) => member || !q.school)

  const staffTools = [
    { label: 'Event', sub: 'Add it to the school calendar', icon: CalendarPlus, to: '/calendar/create' },
    { label: 'Poll', sub: 'Ask your school a question', icon: BarChart3, to: '/polls' },
    { label: 'Homework', sub: 'Set work for a class', icon: ClipboardList, to: '/assignments' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(10,6,40,0.55)' }} onClick={onClose}>
      <style>{`@keyframes sl-sheet-up{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}html[data-motion="reduce"] .sl-sheet{animation:none!important}`}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        className="sl-sheet w-full max-w-[520px] bg-white rounded-t-[28px] px-5 pt-3 pb-8 max-h-[92dvh] overflow-y-auto"
        style={{ animation: 'sl-sheet-up 220ms ease-out' }}
      >
        <span className="block w-10 h-1.5 rounded-full bg-gray-200 mx-auto mb-3" />
        <div className="flex items-center justify-between">
          <p className="text-[22px] font-extrabold tracking-tight text-brand-navy">Create</p>
          <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center"><X size={18} className="text-gray-500" /></button>
        </div>

        {draft && member ? (
          <button onClick={() => go('/add-post')} className="w-full mt-4 flex items-center gap-3 rounded-2xl border border-brand-purple/30 bg-brand-light px-4 py-3 text-left">
            <span className="w-10 h-10 rounded-xl bg-white flex items-center justify-center"><PenSquare size={18} className="text-brand-purple" /></span>
            <span className="flex-1 min-w-0">
              <span className="block text-[11px] font-bold uppercase tracking-[0.1em] text-brand-purple">Continue your draft</span>
              <span className="block text-sm text-brand-navy truncate">{draft}</span>
            </span>
            <ChevronRight size={17} className="text-brand-purple" />
          </button>
        ) : null}

        <div className="grid grid-cols-2 gap-3 mt-4">
          {member ? (
            <button
              onClick={() => go('/add-post')}
              className="relative overflow-hidden rounded-3xl p-4 text-left h-[132px] flex flex-col justify-between"
              style={{ background: 'linear-gradient(135deg, #4B2FD0, #8B5CF6)' }}
            >
              <span className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)' }}><PenSquare size={22} color="#fff" /></span>
              <span>
                <span className="block text-[17px] font-extrabold" style={{ color: '#fff' }}>Post</span>
                <span className="block text-xs" style={{ color: 'rgba(255,255,255,0.78)' }}>Write something for your school</span>
              </span>
            </button>
          ) : null}
          <button
            onClick={() => go('/statuses/create')}
            className={`relative overflow-hidden rounded-3xl p-4 text-left h-[132px] flex flex-col justify-between ${member ? '' : 'col-span-2'}`}
            style={{ background: 'linear-gradient(135deg, #F97316, #EC4899)' }}
          >
            <span className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.22)' }}><Sparkles size={22} color="#fff" /></span>
            <span>
              <span className="block text-[17px] font-extrabold" style={{ color: '#fff' }}>Status</span>
              <span className="block text-xs" style={{ color: 'rgba(255,255,255,0.85)' }}>Share a moment</span>
            </span>
          </button>
        </div>

        {quick.length > 0 ? (
          <>
            <p className="mt-6 mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400">Jump straight in</p>
            <div className="grid grid-cols-4 gap-2">
              {quick.map(({ label, icon: Icon, color, bg, to }) => (
                <button key={label} onClick={() => go(to)} className="flex flex-col items-center gap-2 py-3 rounded-2xl border border-gray-100">
                  <span className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: bg }}><Icon size={21} color={color} /></span>
                  <span className="text-xs font-semibold text-brand-navy">{label}</span>
                </button>
              ))}
            </div>
          </>
        ) : null}

        {staff ? (
          <>
            <p className="mt-6 mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400">For staff</p>
            <div className="rounded-2xl border border-gray-100 divide-y divide-gray-100">
              {staffTools.map(({ label, sub, icon: Icon, to }) => (
                <button key={label} onClick={() => go(to)} className="w-full flex items-center gap-3 p-3.5 text-left">
                  <span className="w-10 h-10 rounded-xl bg-brand-light flex items-center justify-center"><Icon size={19} className="text-brand-purple" /></span>
                  <span className="flex-1">
                    <span className="block text-[15px] font-semibold text-brand-navy">{label}</span>
                    <span className="block text-xs text-gray-400">{sub}</span>
                  </span>
                  <ChevronRight size={17} className="text-gray-300" />
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
