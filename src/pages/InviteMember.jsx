import { useEffect, useState } from 'react'
import { Copy, Share2, RefreshCw, X, Check, Loader2, Users, UserPlus } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { ConfirmSheet } from '../components/FamilySheets.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { canManageStaff } from '../lib/permissions.js'
import { joinLink } from '../lib/links.js'

const ROLES = ['Deputy Head', 'Teacher / Tutor', 'Bursar', 'Librarian', 'ICT Administrator', 'Receptionist', 'Guidance & Counselling', 'School Coach']

function when(d) {
  if (!d) return ''
  const days = Math.max(0, Math.ceil((new Date(d) - Date.now()) / 86400000))
  return days <= 1 ? 'expires today' : `expires in ${days} days`
}

function LinkButtons({ code, school, onToast }) {
  const link = joinLink(code)
  async function copy() {
    try { await navigator.clipboard.writeText(link); onToast('Link copied') } catch { onToast('Could not copy') }
  }
  function share() {
    if (navigator.share) navigator.share({ title: `Join ${school || 'our school'} on Schoolink`, text: `Join ${school || 'our school'} on Schoolink. Code: ${code}`, url: link }).catch(() => {})
    else copy()
  }
  return (
    <div className="flex gap-2 mt-3">
      <button onClick={copy} className="flex-1 flex items-center justify-center gap-1.5 border border-gray-200 rounded-full py-2.5 text-sm font-medium bg-white"><Copy size={14} /> Copy link</button>
      <button onClick={share} className="flex-1 flex items-center justify-center gap-1.5 bg-brand-purple text-white rounded-full py-2.5 text-sm font-medium"><Share2 size={14} /> Share</button>
    </div>
  )
}

export default function InviteMember() {
  const { profile } = useAuth()
  const allowed = canManageStaff(profile)

  const [loading, setLoading] = useState(true)
  const [school, setSchool] = useState('')
  const [studentCode, setStudentCode] = useState('')
  const [approval, setApproval] = useState(false)
  const [invites, setInvites] = useState([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState(ROLES[1])
  const [fresh, setFresh] = useState(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(''), 2200)
    return () => clearTimeout(t)
  }, [toast])

  async function load() {
    const [{ data: ov }, { data: list }] = await Promise.all([supabase.rpc('invite_overview'), supabase.rpc('list_staff_invites')])
    if (ov?.ok) { setSchool(ov.school_name || ''); setStudentCode(ov.student_code || ''); setApproval(!!ov.approval) }
    setInvites(Array.isArray(list) ? list : [])
    setLoading(false)
  }

  useEffect(() => { if (allowed) load(); else setLoading(false) }, [allowed])

  async function makeStudentCode() {
    setConfirm(false)
    setBusy('code')
    const { data, error: err } = await supabase.rpc('regenerate_student_code')
    setBusy('')
    if (err || !data?.ok) { setToast(err?.message || data?.error || 'Could not make a link'); return }
    setStudentCode(data.code)
    setToast('New link ready')
  }

  async function toggleApproval() {
    const next = !approval
    setApproval(next)
    const { data, error: err } = await supabase.rpc('set_student_approval', { p_on: next })
    if (err || !data?.ok) { setApproval(!next); setToast('Could not change this') }
  }

  async function makeStaffInvite() {
    setBusy('staff')
    setError('')
    const { data, error: err } = await supabase.rpc('create_staff_invite', { p_role: role, p_email: email.trim() || null })
    setBusy('')
    if (err || !data?.ok) { setError(err?.message || data?.error || 'Could not make the invite'); return }
    setFresh({ code: data.code, role: data.role })
    setEmail('')
    load()
  }

  async function cancelInvite(inv) {
    setInvites((prev) => prev.filter((x) => x.id !== inv.id))
    if (fresh?.code === inv.code) setFresh(null)
    await supabase.rpc('revoke_invite', { p_id: inv.id })
  }

  if (!allowed) {
    return (
      <div className="flex-1 flex flex-col">
        <BackHeader title="Invite a member" />
        <div className="flex-1 flex items-center justify-center px-8 text-center text-gray-400">Only a Headteacher or Deputy Head can invite people to the school.</div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col relative">
      <BackHeader title="Invite a member" />
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-gray-400"><Loader2 className="animate-spin" /></div>
      ) : (
        <div className="screen-scroll px-4 pb-10">
          <section className="rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-full bg-brand-light flex items-center justify-center"><Users size={18} className="text-brand-purple" /></span>
              <div className="min-w-0">
                <p className="font-semibold">Student link</p>
                <p className="text-xs text-gray-400 truncate">Anyone with it joins {school || 'your school'} as a student</p>
              </div>
            </div>

            {studentCode ? (
              <div className="mt-4 bg-brand-light rounded-xl p-3 text-center">
                <p className="text-2xl font-mono font-bold tracking-widest text-brand-purple">{studentCode}</p>
                <LinkButtons code={studentCode} school={school} onToast={setToast} />
              </div>
            ) : (
              <p className="text-sm text-gray-500 mt-3">No link yet. Make one and share it with your students.</p>
            )}

            <button type="button" onClick={toggleApproval} className="w-full flex items-center gap-3 mt-4 text-left">
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium">I approve each student</span>
                <span className="block text-xs text-gray-400">{approval ? 'New students wait in Pending Approvals until you accept them.' : 'Students get in right away when they use the link or code.'}</span>
              </span>
              <span className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 ${approval ? 'bg-brand-purple' : 'bg-gray-300'}`}>
                <span className={`block w-5 h-5 rounded-full bg-white transition-transform ${approval ? 'translate-x-5' : ''}`} />
              </span>
            </button>

            <button onClick={() => (studentCode ? setConfirm(true) : makeStudentCode())} disabled={busy === 'code'} className="mt-4 w-full flex items-center justify-center gap-2 border border-brand-purple text-brand-purple font-medium py-2.5 rounded-full text-sm disabled:opacity-60">
              {busy === 'code' ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={15} />} {studentCode ? 'Make a new link' : 'Make a link'}
            </button>
          </section>

          <section className="rounded-2xl border border-gray-100 p-4 mt-4">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-full bg-brand-light flex items-center justify-center"><UserPlus size={18} className="text-brand-purple" /></span>
              <div>
                <p className="font-semibold">Invite a staff member</p>
                <p className="text-xs text-gray-400">One person, one use, valid for 14 days</p>
              </div>
            </div>

            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mt-4 mb-1.5">Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full bg-gray-100 rounded-xl px-4 py-3 text-[15px] outline-none">
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>

            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mt-4 mb-1.5">Their email (optional)</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="colleague@school.com" autoCapitalize="none" className="w-full bg-gray-100 rounded-xl px-4 py-3 text-[15px] outline-none" />
            <p className="text-xs text-gray-400 mt-1.5">If you add an email, only that account can use the invite.</p>

            {error ? <p className="text-sm text-red-500 mt-3">{error}</p> : null}

            <button onClick={makeStaffInvite} disabled={busy === 'staff'} className="mt-4 w-full bg-brand-purple text-white font-semibold py-3 rounded-full disabled:opacity-60 flex items-center justify-center">
              {busy === 'staff' ? <Loader2 size={18} className="animate-spin" /> : 'Make invite'}
            </button>

            {fresh ? (
              <div className="mt-4 bg-brand-light rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 flex items-center justify-center gap-1"><Check size={13} className="text-green-600" /> Invite for {fresh.role}</p>
                <p className="text-2xl font-mono font-bold tracking-widest text-brand-purple mt-1">{fresh.code}</p>
                <LinkButtons code={fresh.code} school={school} onToast={setToast} />
              </div>
            ) : null}
          </section>

          {invites.length > 0 ? (
            <section className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1 px-1">Open invites · {invites.length}</p>
              <div className="rounded-2xl border border-gray-100 divide-y divide-gray-50">
                {invites.map((inv) => (
                  <div key={inv.id} className="flex items-center gap-3 p-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-mono font-bold tracking-wider text-sm">{inv.code}</p>
                      <p className="text-xs text-gray-400 truncate">{inv.role}{inv.email ? ` · ${inv.email}` : ''} · {when(inv.expires_at)}</p>
                    </div>
                    <button onClick={async () => { try { await navigator.clipboard.writeText(joinLink(inv.code)); setToast('Link copied') } catch { setToast('Could not copy') } }} aria-label="Copy link" className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 active:bg-gray-100"><Copy size={16} /></button>
                    <button onClick={() => cancelInvite(inv)} aria-label="Cancel invite" className="w-9 h-9 rounded-full flex items-center justify-center text-red-500 active:bg-red-50"><X size={17} /></button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}

      {confirm ? (
        <ConfirmSheet title="Make a new link?" body="The old student link and code stop working straight away. Share the new one with your students." confirmLabel="Make new link" onConfirm={makeStudentCode} onClose={() => setConfirm(false)} />
      ) : null}

      {toast ? <div className="absolute left-1/2 -translate-x-1/2 z-[70] bg-gray-900 text-white text-sm rounded-full px-4 py-2 shadow-lg" style={{ bottom: 30 }}>{toast}</div> : null}
    </div>
  )
      }
