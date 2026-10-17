import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2, KeyRound, ShieldCheck, Users, Loader2, Share2 } from 'lucide-react'
import ScreenHeader from './ScreenHeader.jsx'
import PersonAvatar from './PersonAvatar.jsx'
import { ConfirmSheet, InviteSheet } from './FamilySheets.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { formatCode, timeLeft, agoText, inviteText } from '../lib/familyUtils.js'

// What a student sees: the parents linked to them, and codes to link more.
export default function FamilyStudent({ user, profile, onBack }) {
  const [loading, setLoading] = useState(true)
  const [links, setLinks] = useState([])
  const [people, setPeople] = useState(new Map())
  const [invites, setInvites] = useState([])
  const [creating, setCreating] = useState(false)
  const [showCode, setShowCode] = useState(null)
  const [removing, setRemoving] = useState(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  const channelName = useRef(`family-student-${Math.random().toString(36).slice(2)}`)

  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(''), 2600)
    return () => clearTimeout(t)
  }, [toast])

  async function load() {
    const [l, i] = await Promise.all([
      supabase.from('family_links').select('*').eq('student_id', user.id).order('created_at', { ascending: true }),
      supabase.from('family_invites').select('*').eq('student_id', user.id).is('used_at', null).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }),
    ])
    const rows = l.data ?? []
    setLinks(rows)
    setInvites(i.data ?? [])
    const ids = rows.map((r) => r.parent_id)
    if (ids.length) {
      const { data } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', ids)
      setPeople(new Map((data ?? []).map((p) => [p.id, p])))
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
    const ch = supabase
      .channel(channelName.current)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'family_links', filter: `student_id=eq.${user.id}` }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [user.id])

  async function makeCode() {
    if (creating) return
    setCreating(true)
    const { data, error } = await supabase.rpc('create_family_invite')
    setCreating(false)
    if (error) { setToast(error.message); return }
    const row = Array.isArray(data) ? data[0] : data
    if (!row) { setToast('Could not make a code. Try again.'); return }
    setShowCode({ code: row.invite_code, expires: row.invite_expires })
    load()
  }

  async function cancelCode(inv) {
    setShowCode(null)
    const { error } = await supabase.from('family_invites').delete().eq('id', inv.id)
    if (error) { setToast(error.message); return }
    setInvites((prev) => prev.filter((x) => x.id !== inv.id))
    setToast('Code cancelled')
  }

  async function removeLink() {
    if (!removing) return
    setBusy(true)
    const { error } = await supabase.from('family_links').delete().eq('id', removing.id)
    setBusy(false)
    if (error) { setToast(error.message); return }
    setLinks((prev) => prev.filter((x) => x.id !== removing.id))
    setRemoving(null)
    setToast('Parent removed')
  }

  async function shareInvite(inv) {
    const text = inviteText(inv.code, profile?.full_name)
    if (navigator.share) { try { await navigator.share({ title: 'Schoolink invite', text }) } catch { /* closed */ } } else { try { await navigator.clipboard.writeText(text); setToast('Invite copied') } catch { setToast('Could not copy') } }
  }

  return (
    <div className="app-shell relative">
      <ScreenHeader title="My Parents" onBack={onBack} right={<button onClick={makeCode} aria-label="Invite a parent" className="w-10 h-10 rounded-full bg-brand-purple text-white flex items-center justify-center">{creating ? <Loader2 size={18} className="animate-spin" /> : <Plus size={20} />}</button>} />

      <div className="flex-1 overflow-y-auto px-4 pt-4" style={{ paddingBottom: 40 }}>
        <div className="rounded-3xl p-5 text-white" style={{ background: 'linear-gradient(135deg, var(--brand-purple, #6C4CE0), #241B4E)' }}>
          <ShieldCheck size={26} />
          <p className="font-semibold text-lg mt-2">You choose who follows your school life</p>
          <p className="text-sm text-white/75 mt-1">A linked parent sees your report card and timetable. They cannot see your chats, posts or friends. You can remove them any time.</p>
        </div>

        {loading ? <p className="text-center text-gray-400 mt-10"><Loader2 className="animate-spin inline" /></p> : (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mt-6 mb-1">Linked parents</p>
            {links.length === 0 ? (
              <div className="text-center py-10 px-6">
                <span className="w-16 h-16 rounded-full bg-brand-light mx-auto flex items-center justify-center mb-3"><Users size={28} className="text-brand-purple" /></span>
                <p className="font-semibold">No parent linked yet</p>
                <p className="text-sm text-gray-400 mt-1">Make a code and give it to your parent or guardian.</p>
                <button onClick={makeCode} disabled={creating} className="mt-4 bg-brand-purple text-white text-sm font-semibold rounded-full px-6 py-2.5 disabled:opacity-50">Invite a parent</button>
              </div>
            ) : links.map((l) => {
              const p = people.get(l.parent_id)
              return (
                <div key={l.id} className="flex items-center gap-3 py-3 border-b border-gray-50">
                  <PersonAvatar p={p} size={46} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[15px] truncate">{p?.full_name || 'Parent'}</p>
                    <p className="text-xs text-gray-400">{l.relationship || 'Guardian'} · linked {agoText(l.created_at)}</p>
                  </div>
                  <button onClick={() => setRemoving(l)} aria-label={`Remove ${p?.full_name || 'parent'}`} className="w-10 h-10 rounded-full flex items-center justify-center text-gray-400 active:bg-gray-100"><Trash2 size={18} /></button>
                </div>
              )
            })}

            {invites.length > 0 ? (
              <>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mt-6 mb-1">Waiting codes</p>
                {invites.map((inv) => (
                  <div key={inv.id} className="flex items-center gap-3 py-3 border-b border-gray-50">
                    <span className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center shrink-0"><KeyRound size={18} className="text-gray-500" /></span>
                    <button onClick={() => setShowCode({ code: inv.code, expires: inv.expires_at, id: inv.id })} className="min-w-0 flex-1 text-left">
                      <p className="font-mono font-bold tracking-wider">{formatCode(inv.code)}</p>
                      <p className="text-xs text-gray-400">{timeLeft(inv.expires_at)} · works once</p>
                    </button>
                    <button onClick={() => shareInvite(inv)} aria-label="Share code" className="w-10 h-10 rounded-full flex items-center justify-center text-brand-purple active:bg-gray-100"><Share2 size={18} /></button>
                    <button onClick={() => cancelCode(inv)} aria-label="Cancel code" className="w-10 h-10 rounded-full flex items-center justify-center text-gray-400 active:bg-gray-100"><Trash2 size={18} /></button>
                  </div>
                ))}
              </>
            ) : null}
          </>
        )}
      </div>

      {toast ? <div className="absolute left-1/2 -translate-x-1/2 z-30 bg-gray-900 text-white text-sm rounded-full px-4 py-2 shadow-lg max-w-[90%] text-center" style={{ bottom: 30 }}>{toast}</div> : null}

      {showCode ? (
        <InviteSheet
          code={showCode.code}
          expires={showCode.expires}
          studentName={profile?.full_name}
          onClose={() => setShowCode(null)}
          onCancelCode={showCode.id ? () => cancelCode({ id: showCode.id }) : () => { const inv = invites.find((x) => x.code === showCode.code); if (inv) cancelCode(inv); else setShowCode(null) }}
        />
      ) : null}

      {removing ? (
        <ConfirmSheet
          title={`Remove ${people.get(removing.parent_id)?.full_name || 'this parent'}?`}
          body="They will no longer see your report card or timetable. They can only be linked again with a new code or by the school."
          confirmLabel="Remove"
          danger
          busy={busy}
          onConfirm={removeLink}
          onClose={() => setRemoving(null)}
        />
      ) : null}
    </div>
  )
}
