import { Navigate, useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'

// Colours for the whole control center. Inline styles are used on purpose:
// they stay the same whatever theme a normal user has picked.
export const ctl = {
  bg: '#0B1020',
  gradient: 'linear-gradient(180deg, #0A0E2A 0%, #10124A 55%, #0B1020 100%)',
  card: '#151B2E',
  border: '#243049',
  text: '#E5E7EB',
  muted: '#94A3B8',
  accent: '#6366F1',
  good: '#22C55E',
  bad: '#EF4444',
  warn: '#F59E0B',
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
      <div className="app-shell flex items-center justify-center" style={{ background: ctl.gradient, color: ctl.muted }}>
        Loading…
      </div>
    )
  }
  if (!teamRole) return <Navigate to="/home" replace />

  const denied = allow && !allow.includes(teamRole)

  return (
    <div className="app-shell" style={{ background: ctl.gradient, color: ctl.text }}>
      {header ? (
        <div className="flex items-center gap-2 px-4 pt-4 pb-3" style={{ borderBottom: `1px solid ${ctl.border}` }}>
          {back ? (
            <button onClick={() => navigate('/controller')} style={{ color: ctl.muted }}>
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
