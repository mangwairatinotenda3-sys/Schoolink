import { TrendingUp, TrendingDown, Minus, Star, AlertTriangle } from 'lucide-react'
import { averageOf, groupSubjects, listTerms, sortTermKeys, termKey, termLabel, tone, round1 } from '../lib/resultsUtils.js'

function Spark({ values, color }) {
  const pts = values.filter((v) => v != null)
  if (pts.length < 2) return <span className="w-16 h-6 inline-block" />
  const w = 64
  const h = 24
  const step = w / (values.length - 1)
  const path = values.map((v, i) => (v == null ? null : `${i * step},${h - 2 - (Math.max(0, Math.min(100, v)) / 100) * (h - 4)}`)).filter(Boolean)
  return (
    <svg width={w} height={h} aria-hidden="true">
      <polyline points={path.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={path[path.length - 1].split(',')[0]} cy={path[path.length - 1].split(',')[1]} r="2.5" fill={color} />
    </svg>
  )
}

// How a student is doing over time: average for each term and a line for every subject.
export default function ProgressView({ rows, scale }) {
  const keys = sortTermKeys(listTerms(rows), false)
  if (keys.length === 0) {
    return <p className="text-center text-sm text-gray-400 py-14">Progress shows up once results are in.</p>
  }
  const byTerm = keys.map((k) => ({ key: k, rows: rows.filter((r) => termKey(r) === k) }))
  const avgs = byTerm.map((t) => ({ key: t.key, avg: averageOf(t.rows) }))
  const last = avgs[avgs.length - 1]
  const prev = avgs.length > 1 ? avgs[avgs.length - 2] : null
  const diff = last?.avg != null && prev?.avg != null ? round1(last.avg - prev.avg) : null

  const allSubjects = [...new Set(rows.map((r) => (r.subject || '').trim().toLowerCase()))]
  const trends = allSubjects.map((name) => {
    const series = byTerm.map((t) => averageOf(t.rows.filter((r) => (r.subject || '').trim().toLowerCase() === name)))
    const shown = rows.find((r) => (r.subject || '').trim().toLowerCase() === name)?.subject || name
    const latest = [...series].reverse().find((v) => v != null) ?? null
    return { name: shown, series, latest }
  }).filter((t) => t.latest != null).sort((a, b) => b.latest - a.latest)

  const best = trends.slice(0, 2)
  const weak = trends.filter((t) => t.latest < 50).slice(-2).reverse()
  const maxBar = 100

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Average by term</p>
            <p className="text-3xl font-bold mt-1">{last?.avg != null ? `${Math.round(last.avg)}%` : '—'}</p>
          </div>
          {diff != null ? (
            <span className={`inline-flex items-center gap-1 text-sm font-semibold rounded-full px-3 py-1 ${diff > 0 ? 'bg-green-100 text-green-700' : diff < 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
              {diff > 0 ? <TrendingUp size={15} /> : diff < 0 ? <TrendingDown size={15} /> : <Minus size={15} />}
              {diff > 0 ? '+' : ''}{diff}% since {termLabel(prev.key)}
            </span>
          ) : null}
        </div>
        <div className="flex items-end gap-3 mt-5" style={{ height: 130 }}>
          {avgs.map((a) => (
            <div key={a.key} className="flex-1 min-w-0 flex flex-col items-center justify-end h-full">
              <span className="text-xs font-semibold mb-1">{a.avg != null ? Math.round(a.avg) : ''}</span>
              <div className="w-full max-w-[44px] rounded-t-lg" style={{ height: `${a.avg != null ? Math.max(4, (a.avg / maxBar) * 100) : 4}%`, background: tone(a.avg).hex, transition: 'height 500ms ease' }} />
            </div>
          ))}
        </div>
        <div className="flex gap-3 mt-2">
          {avgs.map((a) => <p key={a.key} className="flex-1 text-center text-[10px] text-gray-400 leading-tight">{termLabel(a.key).replace(' ', ' ')}</p>)}
        </div>
      </div>

      {(best.length || weak.length) ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-green-50 p-4">
            <p className="text-xs font-semibold text-green-700 flex items-center gap-1.5"><Star size={14} /> Strongest</p>
            {best.map((b) => <p key={b.name} className="text-sm font-medium mt-1.5 truncate">{b.name} <span className="text-gray-400 font-normal">{Math.round(b.latest)}%</span></p>)}
          </div>
          <div className="rounded-2xl bg-amber-50 p-4">
            <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5"><AlertTriangle size={14} /> Needs attention</p>
            {weak.length ? weak.map((b) => <p key={b.name} className="text-sm font-medium mt-1.5 truncate">{b.name} <span className="text-gray-400 font-normal">{Math.round(b.latest)}%</span></p>) : <p className="text-sm text-gray-500 mt-1.5">Nothing below 50%.</p>}
          </div>
        </div>
      ) : null}

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 px-5 pt-4 pb-2">Subjects over time</p>
        {trends.map((t) => (
          <div key={t.name} className="flex items-center gap-3 px-5 py-3 border-t border-gray-50 first:border-0">
            <p className="flex-1 min-w-0 text-sm font-medium truncate">{t.name}</p>
            <Spark values={t.series} color={tone(t.latest).hex} />
            <span className={`text-sm font-semibold w-11 text-right ${tone(t.latest).text}`}>{Math.round(t.latest)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
