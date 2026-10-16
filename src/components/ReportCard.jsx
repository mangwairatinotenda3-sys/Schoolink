import { useState } from 'react'
import { ChevronDown, Pencil, MessageSquareQuote, Trophy, BookOpen, Award, EyeOff, GraduationCap } from 'lucide-react'
import { groupSubjects, averageOf, gradeFor, tone, ordinal, formatScore, percentOf, normaliseScale } from '../lib/resultsUtils.js'

function Ring({ percent, size = 92 }) {
  const stroke = 8
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const p = percent == null ? 0 : Math.max(0, Math.min(100, percent))
  const t = tone(percent)
  return (
    <span className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E5E7EB" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={t.hex} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${(p / 100) * c} ${c}`} style={{ transition: 'stroke-dasharray 600ms ease' }} />
      </svg>
      <span className="absolute text-center">
        <span className="block text-xl font-bold leading-none">{percent == null ? '—' : Math.round(percent)}<span className="text-xs font-semibold">{percent == null ? '' : '%'}</span></span>
        <span className="block text-[10px] text-gray-400 mt-0.5">average</span>
      </span>
    </span>
  )
}

function Tile({ icon: Icon, label, value, sub }) {
  return (
    <div className="flex-1 min-w-0 rounded-2xl bg-gray-50 px-3 py-2.5">
      <p className="text-[11px] text-gray-400 flex items-center gap-1"><Icon size={12} /> {label}</p>
      <p className="font-bold text-lg leading-tight mt-0.5 truncate">{value}</p>
      {sub ? <p className="text-[11px] text-gray-400 truncate">{sub}</p> : null}
    </div>
  )
}

// A report card for one student for one term. Looks the same for students, parents and teachers.
export default function ReportCard({ student, school, term, rows, scale, summary, remarks, className, canEdit, onEditRow, onEditRemarks }) {
  const [open, setOpen] = useState(null)
  const sc = normaliseScale(scale)
  const subjects = groupSubjects(rows, sc)
  const average = summary?.average ?? averageOf(rows)
  const overall = gradeFor(average, sc)
  const t = tone(average)
  const hasRemarks = remarks?.teacher_remark || remarks?.head_remark

  return (
    <div id="report-card-print" className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 text-white" style={{ background: 'linear-gradient(135deg, var(--brand-purple, #6C4CE0), #241B4E)' }}>
        <div className="flex items-center gap-3">
          {school?.logo_url ? <img src={school.logo_url} alt="" className="w-11 h-11 rounded-xl object-cover bg-white" /> : <span className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center"><GraduationCap size={22} /></span>}
          <div className="min-w-0">
            <p className="font-semibold leading-tight truncate">{school?.name || 'School'}</p>
            <p className="text-xs text-white/70">Student report card</p>
          </div>
          <span className="ml-auto text-xs font-semibold bg-white/20 rounded-full px-3 py-1 shrink-0">{term}</span>
        </div>
        <div className="flex items-center gap-3 mt-4">
          {student?.avatar_url ? <img src={student.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover ring-2 ring-white/40" /> : <span className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-xl font-bold">{(student?.full_name || '?').slice(0, 1).toUpperCase()}</span>}
          <div className="min-w-0">
            <p className="text-lg font-bold leading-tight truncate">{student?.full_name || 'Student'}</p>
            <p className="text-sm text-white/70">{className ? `Class ${className}` : 'Student'}</p>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="px-5 py-4 flex items-center gap-4">
        <Ring percent={average} />
        <div className="flex-1 min-w-0 grid grid-cols-1 gap-2">
          <div className="flex gap-2">
            <Tile icon={Award} label="Overall" value={overall?.grade || '—'} sub={overall?.label} />
            <Tile icon={Trophy} label="Position" value={summary?.class_position ? ordinal(summary.class_position) : '—'} sub={summary?.class_size ? `of ${summary.class_size}` : 'not ranked'} />
          </div>
          <p className={`text-xs ${t.text}`}><BookOpen size={12} className="inline -mt-0.5 mr-1" />{subjects.length} subject{subjects.length === 1 ? '' : 's'} this term</p>
        </div>
      </div>

      {/* Subjects */}
      <div className="border-t border-gray-100">
        {subjects.length === 0 ? <p className="text-center text-sm text-gray-400 py-10">No results for this term yet.</p> : null}
        {subjects.map((s) => {
          const st = tone(s.percent)
          const isOpen = open === s.subject
          return (
            <div key={s.subject} className="border-b border-gray-50 last:border-0">
              <button onClick={() => setOpen(isOpen ? null : s.subject)} className="w-full text-left px-5 py-3.5 active:bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[15px] truncate flex items-center gap-1.5">{s.subject}{s.hasDraft ? <EyeOff size={13} className="text-amber-500 shrink-0" /> : null}</p>
                    {s.percent != null ? (
                      <div className="h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden"><div className={`h-full rounded-full ${st.bar}`} style={{ width: `${Math.min(100, s.percent)}%`, transition: 'width 500ms ease' }} /></div>
                    ) : null}
                  </div>
                  <span className="text-sm font-semibold w-12 text-right shrink-0">{s.percent != null ? `${Math.round(s.percent)}%` : ''}</span>
                  <span className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold shrink-0 ${st.bg} ${st.text}`}>{s.grade || '—'}</span>
                  <ChevronDown size={16} className={`text-gray-300 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
                {s.comment && !isOpen ? <p className="text-xs text-gray-400 mt-1.5 line-clamp-1">“{s.comment}”</p> : null}
              </button>
              {isOpen ? (
                <div className="px-5 pb-3 -mt-1">
                  {s.comment ? <p className="text-sm text-gray-600 bg-gray-50 rounded-xl px-3 py-2 mb-2">“{s.comment}”</p> : null}
                  {s.rows.map((r) => {
                    const p = percentOf(r)
                    return (
                      <div key={r.id} className="flex items-center gap-3 py-2 text-sm">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{r.assessment || 'Exam'}{r.published === false ? <span className="ml-2 text-[10px] font-semibold text-amber-600 bg-amber-50 rounded px-1.5 py-0.5">Not published</span> : null}</p>
                          <p className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString([], { day: 'numeric', month: 'short' })}</p>
                        </div>
                        <span className="font-semibold">{formatScore(r)}</span>
                        <span className={`text-xs font-bold rounded-md px-1.5 py-0.5 ${tone(p).bg} ${tone(p).text}`}>{p != null ? gradeFor(p, sc)?.grade : r.grade || ''}</span>
                        {canEdit ? <button onClick={() => onEditRow(r)} aria-label="Edit" className="w-8 h-8 -mr-2 rounded-full flex items-center justify-center text-gray-400 active:bg-gray-100"><Pencil size={15} /></button> : null}
                      </div>
                    )
                  })}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

      {/* Remarks */}
      {hasRemarks || canEdit ? (
        <div className="border-t border-gray-100 px-5 py-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 flex items-center gap-1.5"><MessageSquareQuote size={14} /> Remarks</p>
            {canEdit ? <button onClick={onEditRemarks} className="text-xs font-semibold text-brand-purple">{hasRemarks ? 'Edit' : 'Add'}</button> : null}
          </div>
          {remarks?.teacher_remark ? <div className="mb-2"><p className="text-[11px] text-gray-400">Class teacher</p><p className="text-sm text-gray-700 whitespace-pre-wrap">{remarks.teacher_remark}</p></div> : null}
          {remarks?.head_remark ? <div><p className="text-[11px] text-gray-400">Headteacher</p><p className="text-sm text-gray-700 whitespace-pre-wrap">{remarks.head_remark}</p></div> : null}
          {!hasRemarks ? <p className="text-sm text-gray-400">No remarks yet.</p> : null}
        </div>
      ) : null}

      {/* Key */}
      <div className="border-t border-gray-100 px-5 py-3 bg-gray-50/60">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Grading key</p>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500">
          {sc.filter((r, i) => i === 0 || r.grade !== sc[i - 1].grade).map((r, i, arr) => (
            <span key={`${r.grade}-${r.min}`}><b className="text-gray-700">{r.grade}</b> {i === arr.length - 1 ? `below ${arr[i - 1]?.min ?? 0}%` : `${r.min}%+`}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
