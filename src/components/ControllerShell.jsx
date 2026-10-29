import { Navigate, useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'

// Colours for the whole control center. Inline styles keep them the same whatever theme a normal user has picked.
export const ctl = {
  bg: '#0B1020',
  gradient: '#0B1020', // kept so older screens still work; the background is flat now
  card: '#131A2C',
  raised: '#1B2338',
  border: '#222D45',
  text: '#E6E9F2',
  muted: '#8C97AD',
  faint: '#5B667E',
  accent: '#5B5BD6',
  accentSoft: 'rgba(91,91,214,0.16)',
  accentText: '#A5B4FC',
  good: '#22C55E',
  bad: '#EF4444',
  warn: '#F59E0B',
}

// Static placeholder block for skeleton screens (no animation)
export function CtlBlock({ className = '', style }) {
  return <div className={className} style={{ background: ctl.raised, borderRadius: 10, ...style }} />
}

// Static placeholder card with rows, used while a list loads
export function CtlSkeletonRows({ rows = 3 }) {
  return (
    <div style={{ background: ctl.card, border: `1px solid ${ctl.border}`, borderRadius: 16, overflow: 'hidden' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5" style={{ borderTop: i ? `1px solid ${ctl.border}` : 'none' }}>
          <CtlBlock style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0 }} />
          <div className="flex-1 min-w-0">
            <CtlBlock style={{ height: 12, width: '55%' }} />
            <CtlBlock style={{ height: 10, width: '75%', marginTop: 8 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// Page frame for every control-center screen. It also keeps normal users out:
// anyone without a team role is sent back to the normal app.
//   header={false}  -> hide the plain title bar (the home screen draws its own)
//   floating        -> a button that floats at the bottom centre
export default function ControllerShell({ title, allow, back = true, right = null, header = true, floating = null, children }) {
  const navigate = useNavigate()
  const { user, teamRole, teamLoading } = useAuth()

  if (!user) return <Navigate to="/" replace />
  if (teamLoading) {
    return (
      <div className="app-shell" style={{ background: ctl.bg }}>
        <div className="screen-scroll px-4 py-4" aria-busy="true">
          <CtlSkeletonRows rows={4} />
        </div>
      </div>
    )
  }
  if (!teamRole) return <Navigate to="/home" replace />

  const denied = allow && !allow.includes(teamRole)

  return (
    <div className="app-shell" style={{ background: ctl.bg, color: ctl.text }}>
      {header ? (
        <div className="flex items-center gap-2 px-4 pt-4 pb-3" style={{ borderBottom: `1px solid ${ctl.border}` }}>
          {back ? (
            <button
              onClick={() => navigate('/controller')}
              aria-label="Back"
              style={{ color: ctl.muted, width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <ChevronLeft size={22} />
            </button>
          ) : null}
          <h1 className="font-semibold text-base flex-1" style={{ color: ctl.text }}>{title}</h1>
          {right}
        </div>
      ) : null}
      <div className="screen-scroll px-4 py-4" style={{ background: 'transparent', paddingBottom: floating ? 120 : undefined }}>
        {denied ? (
          <p className="text-center mt-10 text-sm" style={{ color: ctl.muted }}>
            Your role doesn't have access to this section.
          </p>
        ) : children}
      </div>
      {floating ? (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 20, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ pointerEvents: 'auto' }}>{floating}</div>
        </div>
      ) : null}
    </div>
  )
  }
