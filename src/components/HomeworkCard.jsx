import { Paperclip, Users, ChevronRight } from 'lucide-react'
import { Pill, ProgressBar } from './HomeworkBits.jsx'
import { colorFor, dueText, dueTone, num } from '../lib/homeworkUtils.js'

// One assignment in a list. Students and parents see where the work stands; teachers see how many handed in.
export default function HomeworkCard({ a, state, counts, teacher, files = 0, onClick, now }) {
  const color = colorFor(a.subject)
  const toMark = counts ? Math.max(0, counts.turned_in - counts.graded) : 0

  return (
    <button onClick={onClick} className="w-full text-left rounded-2xl border border-gray-100 bg-white flex overflow-hidden active:bg-gray-50 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <span className={`w-1.5 shrink-0 ${color.bar}`} />
      <span className="flex-1 min-w-0 p-3.5">
        <span className="flex items-center gap-2">
          {a.subject ? <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${color.soft} ${color.text}`}>{a.subject}</span> : null}
          {a.class_name ? <span className="inline-flex items-center gap-1 text-[11px] text-gray-400"><Users size={11} /> {a.class_name}</span> : <span className="text-[11px] text-gray-400">Whole school</span>}
          <span className="flex-1" />
          {teacher ? (toMark > 0 ? <Pill className="bg-brand-purple text-white">{toMark} to mark</Pill> : null) : state ? <Pill className={state.pill}>{state.label}</Pill> : null}
        </span>
        <span className="block font-semibold text-[16px] leading-snug mt-1.5">{a.title}</span>
        <span className="flex items-center gap-3 mt-1">
          <span className={`text-xs font-medium ${dueTone(a, state, now)}`}>{dueText(a, now)}</span>
          {a.points ? <span className="text-xs text-gray-400">{num(a.points)} pts</span> : null}
          {files > 0 ? <span className="inline-flex items-center gap-0.5 text-xs text-gray-400"><Paperclip size={12} />{files}</span> : null}
          {teacher && a.author_name ? <span className="text-xs text-gray-400 truncate">{a.author_name}</span> : null}
        </span>
        {teacher && counts ? (
          <span className="block mt-3">
            <ProgressBar value={counts.turned_in} total={counts.assigned} marked={counts.graded} />
            <span className="block text-xs text-gray-500 mt-1.5">
              {a.accepts_work === false ? 'Not collected in the app' : `${counts.turned_in} of ${counts.assigned} handed in${counts.graded ? ` · ${counts.graded} marked` : ''}`}
            </span>
          </span>
        ) : null}
      </span>
      <span className="flex items-center pr-2 text-gray-300"><ChevronRight size={18} /></span>
    </button>
  )
}
