import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, X, Loader2, Search, Lock } from 'lucide-react'

// One shared look for every school dashboard (Analytics, Bursar, Coach, ICT, Counselling, Reception).

export const INPUT =
  'w-full border border-gray-200 rounded-xl px-3.5 py-3 text-[15px] outline-none focus:border-brand-purple bg-white'

const TONES = {
  green: 'bg-green-50 text-green-700',
  amber: 'bg-amber-50 text-amber-700',
  red: 'bg-red-50 text-red-600',
  blue: 'bg-blue-50 text-blue-700',
  gray: 'bg-gray-100 text-gray-600',
  purple: 'bg-brand-light text-brand-purple',
}

export function money(n) {
  const v = Number(n || 0)
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function Pill({ tone = 'gray', children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${TONES[tone] || TONES.gray} ${className}`}>
      {children}
    </span>
  )
}

// Dark banner at the top of a dashboard: back button, icon, title, optional ledger of numbers.
export function DashHero({ title, subtitle, icon: Icon, stats, right }) {
  const navigate = useNavigate()
  return (
    <div className="relative overflow-hidden shrink-0" style={{ background: 'linear-gradient(135deg, #241B4E 0%, #3A2A86 62%, #5B3FD0 100%)' }}>
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <g fill="none" stroke="#fff" strokeOpacity="0.09" strokeWidth="1.2">
          <circle cx="380" cy="20" r="70" />
          <circle cx="380" cy="20" r="110" />
          <circle cx="380" cy="20" r="150" />
          <path d="M-10 170 C 80 130, 150 210, 260 160" />
        </g>
      </svg>
      <div className="relative px-4 pt-4 pb-5 text-white">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate(-1)} aria-label="Go back" className="w-9 h-9 -ml-1 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.14)' }}>
            <ChevronLeft size={21} color="#fff" />
          </button>
          {right || null}
        </div>
        <div className="flex items-center gap-3 mt-4">
          {Icon ? (
            <span className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.14)' }}>
              <Icon size={24} color="#fff" />
            </span>
          ) : null}
          <div className="min-w-0">
            <h1 className="text-[22px] font-extrabold tracking-tight leading-tight" style={{ color: '#fff' }}>{title}</h1>
            {subtitle ? <p className="text-[13px] mt-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>{subtitle}</p> : null}
          </div>
        </div>
        {stats && stats.length ? (
          <div className="grid gap-2 mt-5" style={{ gridTemplateColumns: `repeat(${Math.min(stats.length, 4)}, minmax(0, 1fr))` }}>
            {stats.map((s) => (
              <div key={s.label} className="rounded-2xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.12)' }}>
                <p className="text-[20px] font-extrabold tracking-tight leading-none tabular-nums" style={{ color: '#fff' }}>{s.value}</p>
                <p className="text-[10px] uppercase tracking-[0.1em] mt-1.5" style={{ color: 'rgba(255,255,255,0.65)' }}>{s.label}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function SectionTitle({ children, action }) {
  return (
    <div className="flex items-baseline justify-between mt-6 mb-2 px-0.5">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400">{children}</p>
      {action || null}
    </div>
  )
}

// Horizontal pill tabs, used as filters.
export function Tabs({ items, value, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto -mx-4 px-4 py-1" style={{ scrollbarWidth: 'none' }}>
      {items.map((t) => {
        const on = value === t.key
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={`shrink-0 h-9 px-4 rounded-full text-[13px] font-semibold flex items-center gap-1.5 border ${on ? 'bg-brand-navy text-white border-brand-navy' : 'bg-white text-gray-500 border-gray-200'}`}
          >
            {t.label}
            {typeof t.count === 'number' ? <span className={`text-[11px] ${on ? 'text-white/70' : 'text-gray-400'}`}>{t.count}</span> : null}
          </button>
        )
      })}
    </div>
  )
}

export function SearchBox({ value, onChange, placeholder = 'Search' }) {
  return (
    <div className="relative">
      <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${INPUT} pl-10 rounded-full`} />
    </div>
  )
}

export function Card({ children, className = '', onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag onClick={onClick} className={`w-full text-left rounded-2xl border border-gray-100 bg-white p-4 ${className}`}>
      {children}
    </Tag>
  )
}

export function Empty({ icon: Icon, title, text, action }) {
  return (
    <div className="flex flex-col items-center text-center px-8 py-12">
      {Icon ? (
        <span className="w-16 h-16 rounded-3xl bg-brand-light flex items-center justify-center mb-4">
          <Icon size={28} className="text-brand-purple" />
        </span>
      ) : null}
      <p className="font-bold text-brand-navy">{title}</p>
      {text ? <p className="text-sm text-gray-500 mt-1 leading-snug">{text}</p> : null}
      {action || null}
    </div>
  )
}

export function Denied({ title, text }) {
  const navigate = useNavigate()
  return (
    <div className="app-shell">
      <div className="flex items-center gap-3 px-4 py-4">
        <button onClick={() => navigate(-1)} aria-label="Go back"><ChevronLeft size={22} /></button>
        <h1 className="font-semibold text-lg">{title}</h1>
      </div>
      <div className="screen-scroll px-8 flex flex-col items-center justify-center text-center">
        <span className="w-16 h-16 rounded-3xl bg-gray-100 flex items-center justify-center mb-4"><Lock size={26} className="text-gray-400" /></span>
        <p className="text-gray-500 text-sm leading-snug">{text}</p>
      </div>
    </div>
  )
}

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-bold uppercase tracking-[0.1em] text-gray-400 mb-1.5">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-gray-400 mt-1">{hint}</span> : null}
    </label>
  )
}

// Round add button floating above the content.
export function Fab({ onClick, icon: Icon, label, lift = 0 }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="absolute right-4 z-20 h-14 pl-4 pr-5 rounded-full text-white font-semibold text-[15px] flex items-center gap-2"
      style={{ bottom: 20 + lift, background: 'linear-gradient(135deg, #6D4DFF, #8B5CF6)', boxShadow: '0 8px 22px rgba(109,77,255,0.45)' }}
    >
      <Icon size={22} color="#fff" strokeWidth={2.5} /> {label}
    </button>
  )
}

// Bottom sheet used for every "add" form.
export function Sheet({ open, title, onClose, children, footer }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[520px] bg-white rounded-t-3xl max-h-[90dvh] flex flex-col">
        <div className="px-5 pt-3 shrink-0">
          <span className="block w-10 h-1.5 rounded-full bg-gray-200 mx-auto mb-3" />
          <div className="flex items-center justify-between pb-2">
            <p className="text-lg font-extrabold tracking-tight text-brand-navy">{title}</p>
            <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><X size={16} className="text-gray-500" /></button>
          </div>
        </div>
        <div className="px-5 pb-3 overflow-y-auto space-y-3.5">{children}</div>
        {footer ? <div className="px-5 pt-2 pb-5 shrink-0 border-t border-gray-100">{footer}</div> : null}
      </div>
    </div>
  )
}

export function PrimaryButton({ children, busy, disabled, onClick, className = '' }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || busy}
      className={`w-full h-12 rounded-2xl bg-brand-purple text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50 ${className}`}
    >
      {busy ? <Loader2 size={18} className="animate-spin" /> : children}
    </button>
  )
}

// Simple row used inside lists: round icon, two lines of text, something on the right.
export function Row({ icon: Icon, tone = 'purple', title, sub, right, onClick, children }) {
  const toneBg = { purple: 'bg-brand-light text-brand-purple', green: 'bg-green-50 text-green-600', amber: 'bg-amber-50 text-amber-600', red: 'bg-red-50 text-red-500', blue: 'bg-blue-50 text-blue-600', gray: 'bg-gray-100 text-gray-500' }[tone] || 'bg-brand-light text-brand-purple'
  const Tag = onClick ? 'button' : 'div'
  return (
    <div className="rounded-2xl border border-gray-100 bg-white">
      <Tag onClick={onClick} className="w-full text-left flex items-center gap-3 p-3.5">
        {Icon ? (
          <span className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${toneBg}`}><Icon size={20} /></span>
        ) : null}
        <span className="flex-1 min-w-0">
          <span className="block font-semibold text-[15px] text-brand-navy truncate">{title}</span>
          {sub ? <span className="block text-xs text-gray-400 mt-0.5 truncate">{sub}</span> : null}
        </span>
        {right || null}
      </Tag>
      {children ? <div className="px-3.5 pb-3.5">{children}</div> : null}
    </div>
  )
}

// Horizontal bar used by the analytics page and the progress bars on other dashboards.
export function Bar({ value, max, tone = '#6D4DFF' }) {
  const pct = max > 0 ? Math.max(3, Math.round((value / max) * 100)) : 0
  return (
    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${value > 0 ? pct : 0}%`, background: tone }} />
    </div>
  )
}
