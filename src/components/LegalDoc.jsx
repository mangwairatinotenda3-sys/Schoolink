import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import BackHeader from './BackHeader.jsx'

// Shared layout for the Terms and the Privacy Policy: a short summary, quick jump chips, then the sections.
export default function LegalDoc({ title, updated, intro, summary, sections, other }) {
  const navigate = useNavigate()
  const refs = useRef({})

  function jump(i) {
    refs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="app-shell">
      <BackHeader title={title} />
      <div className="screen-scroll pb-10">
        <div className="px-5 pt-1">
          <p className="text-xs text-gray-400">Last updated: {updated}</p>
          {intro ? <p className="text-sm text-gray-600 leading-relaxed mt-3">{intro}</p> : null}

          <div className="mt-4 rounded-2xl bg-brand-light p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-purple mb-2">In short</p>
            <ul className="space-y-2">
              {summary.map((line) => (
                <li key={line} className="flex gap-2.5 text-sm text-gray-700 leading-snug">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-brand-purple shrink-0" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto px-5 mt-4 pb-1" style={{ scrollbarWidth: 'none' }}>
          {sections.map((s, i) => (
            <button key={s.title} onClick={() => jump(i)} className="shrink-0 rounded-full bg-gray-100 text-gray-600 px-3.5 py-1.5 text-xs font-medium">
              {i + 1}. {s.short || s.title}
            </button>
          ))}
        </div>

        <div className="px-5 mt-3">
          {sections.map((s, i) => (
            <section key={s.title} ref={(el) => { refs.current[i] = el }} className="pt-5" style={{ scrollMarginTop: 8 }}>
              <h2 className="font-semibold text-[15px] text-gray-900">{i + 1}. {s.title}</h2>
              {s.lead ? <p className="text-sm text-gray-600 leading-relaxed mt-1.5">{s.lead}</p> : null}
              {s.points ? (
                <ul className="mt-2 space-y-1.5">
                  {s.points.map((p) => (
                    <li key={p} className="flex gap-2.5 text-sm text-gray-600 leading-relaxed">
                      <span className="mt-2 w-1 h-1 rounded-full bg-gray-400 shrink-0" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {s.after ? <p className="text-sm text-gray-600 leading-relaxed mt-2">{s.after}</p> : null}
            </section>
          ))}

          {other ? (
            <button onClick={() => navigate(other.to)} className="mt-8 w-full rounded-xl border border-gray-200 py-3 text-sm font-medium text-brand-purple">
              {other.label}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
  }
