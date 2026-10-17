import { FileText, Video, X, Download, Loader2 } from 'lucide-react'
import { kindOf, openFile, sizeText } from '../lib/homeworkUtils.js'

// Small pieces shared by the homework screens.

export function Switch({ on, onChange, label, sub, disabled }) {
  return (
    <button type="button" role="switch" aria-checked={on} disabled={disabled} onClick={() => onChange(!on)} className="w-full flex items-center gap-3 py-3 text-left disabled:opacity-40">
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-medium">{label}</span>
        {sub ? <span className="block text-xs text-gray-400 mt-0.5">{sub}</span> : null}
      </span>
      <span className={`relative w-12 h-7 rounded-full shrink-0 transition-colors ${on ? 'bg-brand-purple' : 'bg-gray-200'}`}>
        <span className="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all" style={{ left: on ? 22 : 2 }} />
      </span>
    </button>
  )
}

export function Pill({ className = '', children }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${className}`}>{children}</span>
}

export function SectionTitle({ children, count, tone = 'text-gray-500' }) {
  return (
    <p className={`px-1 pt-5 pb-2 text-xs font-semibold uppercase tracking-wide ${tone}`}>
      {children}{count != null ? <span className="ml-1.5 font-medium opacity-70">{count}</span> : null}
    </p>
  )
}

export function ProgressBar({ value, total, marked = 0 }) {
  const t = Math.max(total, 1)
  const pct = Math.min(100, Math.round((value / t) * 100))
  const mk = Math.min(pct, Math.round((marked / t) * 100))
  return (
    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden relative">
      <div className="absolute inset-y-0 left-0 rounded-full bg-brand-purple/30" style={{ width: `${pct}%` }} />
      <div className="absolute inset-y-0 left-0 rounded-full bg-emerald-500" style={{ width: `${mk}%` }} />
    </div>
  )
}

// One attached or handed-in file
export function FileRow({ file, onRemove, busy }) {
  const kind = kindOf(file)
  const Icon = kind === 'video' ? Video : FileText
  const url = file.url || file.file_url
  const name = file.name || file.file_name || 'File'
  const clickable = !!url && !onRemove
  const body = (
    <>
      {kind === 'image' && url ? (
        <img src={url} alt="" className="w-11 h-11 rounded-lg object-cover shrink-0 bg-gray-100" />
      ) : (
        <span className="w-11 h-11 rounded-lg bg-brand-light flex items-center justify-center shrink-0"><Icon size={19} className="text-brand-purple" /></span>
      )}
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium truncate">{name}</span>
        <span className="block text-xs text-gray-400">{[kind === 'image' ? 'Photo' : kind === 'video' ? 'Video' : 'File', sizeText(file.size)].filter(Boolean).join(' · ')}{!url ? ' · waiting to upload' : ''}</span>
      </span>
    </>
  )
  if (clickable) {
    return (
      <button onClick={() => openFile(url, name)} className="w-full flex items-center gap-3 rounded-xl bg-gray-50 p-2 pr-3 text-left active:bg-gray-100">
        {body}
        <Download size={16} className="text-gray-400 shrink-0" />
      </button>
    )
  }
  return (
    <div className="w-full flex items-center gap-3 rounded-xl bg-gray-50 p-2 pr-2 text-left">
      {body}
      {onRemove ? (
        <button onClick={onRemove} disabled={busy} aria-label={`Remove ${name}`} className="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 active:bg-gray-200 disabled:opacity-40">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <X size={17} />}
        </button>
      ) : null}
    </div>
  )
}

export function FileList({ files, onRemove }) {
  if (!files?.length) return null
  return (
    <div className="space-y-2">
      {files.map((f, i) => <FileRow key={`${f.url || f.file_url || f.name}-${i}`} file={f} onRemove={onRemove ? () => onRemove(f, i) : undefined} />)}
    </div>
  )
}

export function Empty({ icon: Icon, title, text, action, onAction }) {
  return (
    <div className="flex flex-col items-center text-center px-10 pt-20">
      <span className="w-20 h-20 rounded-full bg-brand-light flex items-center justify-center mb-4"><Icon size={34} className="text-brand-purple" /></span>
      <p className="font-semibold text-lg">{title}</p>
      {text ? <p className="text-sm text-gray-400 mt-1">{text}</p> : null}
      {action ? <button onClick={onAction} className="mt-5 bg-brand-purple text-white font-semibold rounded-full px-7 py-3">{action}</button> : null}
    </div>
  )
}

export function Toast({ text }) {
  if (!text) return null
  return <div className="absolute left-1/2 -translate-x-1/2 z-[70] bg-gray-900 text-white text-sm rounded-full px-4 py-2 shadow-lg max-w-[90%] text-center" style={{ bottom: 30 }}>{text}</div>
        }
