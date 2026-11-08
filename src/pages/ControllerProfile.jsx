import { useEffect, useRef, useState } from 'react'
import { Camera, User, LogOut, Mail, Clock, ShieldCheck } from 'lucide-react'
import ControllerShell, { ctl } from '../components/ControllerShell.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { ROLE_LABELS } from '../lib/team.js'

const inputStyle = { background: ctl.card, border: `1px solid ${ctl.border}`, color: ctl.text }
const buttonStyle = { background: '#6366F1', color: '#fff' }

function formatDate(value) {
  if (!value) return 'Never'
  return new Date(value).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function Skeleton() {
  return (
    <div className="flex flex-col items-center animate-pulse">
      <span className="w-24 h-24 rounded-full" style={{ background: ctl.border }} />
      <span className="h-3 w-32 rounded mt-3" style={{ background: ctl.border }} />
      <span className="h-20 w-full rounded-xl mt-6" style={{ background: ctl.card }} />
      <span className="h-12 w-full rounded-xl mt-6" style={{ background: ctl.card }} />
      <span className="h-12 w-full rounded-xl mt-6" style={{ background: ctl.card }} />
    </div>
  )
}

// Your own profile inside the Control Center: photo, name, email, password and account details.
// Your team role belongs to your account, so changing the email keeps it.
export default function ControllerProfile() {
  const { user, profile, teamRole, saveProfileDetails, signOut } = useAuth()
  const fileRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [photoMsg, setPhotoMsg] = useState('')
  const [name, setName] = useState(profile?.full_name || '')
  const [nameMsg, setNameMsg] = useState('')
  const [nameBusy, setNameBusy] = useState(false)
  const [email, setEmail] = useState(user?.email || '')
  const [emailMsg, setEmailMsg] = useState('')
  const [emailBusy, setEmailBusy] = useState(false)
  const [password, setPassword] = useState('')
  const [passMsg, setPassMsg] = useState('')
  const [passBusy, setPassBusy] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  // Fill the fields once the profile arrives
  useEffect(() => { setName(profile?.full_name || '') }, [profile?.full_name])
  useEffect(() => { setEmail(user?.email || '') }, [user?.email])

  async function pickPhoto(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !user) return
    setUploading(true)
    setPhotoMsg('')
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `${user.id}/avatar.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (error) {
      setPhotoMsg(error.message)
      setUploading(false)
      return
    }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    const { error: saveErr } = await saveProfileDetails({ avatar_url: `${data.publicUrl}?t=${Date.now()}` })
    setPhotoMsg(saveErr ? saveErr.message : 'Photo updated.')
    setUploading(false)
  }

  async function saveName() {
    const next = name.trim()
    if (!next || next === profile?.full_name) return
    setNameBusy(true)
    setNameMsg('')
    const { error } = await saveProfileDetails({ full_name: next })
    setNameMsg(error ? error.message : 'Name saved.')
    setNameBusy(false)
  }

  async function changeEmail() {
    const next = email.trim()
    if (!next || next === user?.email) return
    setEmailBusy(true)
    setEmailMsg('')
    const { error } = await supabase.auth.updateUser({ email: next })
    setEmailMsg(error ? error.message : 'Check your inbox. Open the confirmation link we sent (it may go to both the old and new address) to finish the change.')
    setEmailBusy(false)
  }

  async function changePassword() {
    if (password.length < 6) {
      setPassMsg('Use at least 6 characters.')
      return
    }
    setPassBusy(true)
    setPassMsg('')
    const { error } = await supabase.auth.updateUser({ password })
    setPassMsg(error ? error.message : 'Password changed.')
    if (!error) setPassword('')
    setPassBusy(false)
  }

  async function handleSignOut() {
    setSigningOut(true)
    await signOut()
    setSigningOut(false)
  }

  const loading = !profile && !user

  return (
    <ControllerShell title="My Profile">
      {loading ? <Skeleton /> : (
        <>
          <div className="flex flex-col items-center">
            <div style={{ position: 'relative', width: 96, height: 96 }}>
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" style={{ width: 96, height: 96, borderRadius: 999, objectFit: 'cover' }} />
              ) : (
                <span
                  style={{
                    width: 96, height: 96, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'linear-gradient(135deg, #8B5CF6, #4F46E5)', color: '#fff',
                  }}
                >
                  <User size={44} />
                </span>
              )}
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                aria-label="Change photo"
                style={{
                  position: 'absolute', right: 0, bottom: 0, width: 32, height: 32, borderRadius: 999,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: '#7C3AED', color: '#fff', border: '2px solid #0B1020',
                }}
              >
                <Camera size={16} />
              </button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickPhoto} />
            </div>
            <p className="text-sm font-semibold mt-3">{profile?.full_name || 'Team member'}</p>
            <p className="text-xs mt-1" style={{ color: ctl.muted }}>{uploading ? 'Uploading…' : ROLE_LABELS[teamRole] || teamRole}</p>
            {photoMsg ? <p className="text-xs mt-1" style={{ color: ctl.muted }}>{photoMsg}</p> : null}
          </div>

          <div className="rounded-xl p-4 mt-6 space-y-3" style={{ background: ctl.card, border: `1px solid ${ctl.border}` }}>
            <div className="flex items-center gap-3">
              <ShieldCheck size={18} style={{ color: ctl.accent }} />
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide" style={{ color: ctl.muted }}>Your role</p>
                <p className="text-sm font-medium">{ROLE_LABELS[teamRole] || teamRole || 'No role'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mail size={18} style={{ color: ctl.accent }} />
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide" style={{ color: ctl.muted }}>Signed in as</p>
                <p className="text-sm font-medium truncate">{user?.email || 'Unknown'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock size={18} style={{ color: ctl.accent }} />
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide" style={{ color: ctl.muted }}>Last signed in</p>
                <p className="text-sm font-medium">{formatDate(user?.last_sign_in_at)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <User size={18} style={{ color: ctl.accent }} />
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide" style={{ color: ctl.muted }}>Member since</p>
                <p className="text-sm font-medium">{formatDate(user?.created_at)}</p>
              </div>
            </div>
          </div>

          <h2 className="text-sm font-semibold mt-6 mb-2">Display name</h2>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder="Your full name"
            className="w-full rounded-xl p-3 text-sm outline-none"
            style={inputStyle}
          />
          <button
            onClick={saveName}
            disabled={nameBusy || !name.trim() || name.trim() === profile?.full_name}
            className="w-full mt-2 rounded-xl py-2.5 text-sm font-semibold"
            style={{ ...buttonStyle, opacity: nameBusy || !name.trim() || name.trim() === profile?.full_name ? 0.5 : 1 }}
          >
            {nameBusy ? 'Saving…' : 'Save name'}
          </button>
          {nameMsg ? <p className="text-xs mt-2" style={{ color: ctl.muted }}>{nameMsg}</p> : null}

          <h2 className="text-sm font-semibold mt-6 mb-2">Email</h2>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl p-3 text-sm outline-none"
            style={inputStyle}
          />
          <button
            onClick={changeEmail}
            disabled={emailBusy || !email.trim() || email.trim() === user?.email}
            className="w-full mt-2 rounded-xl py-2.5 text-sm font-semibold"
            style={{ ...buttonStyle, opacity: emailBusy || email.trim() === user?.email ? 0.5 : 1 }}
          >
            {emailBusy ? 'Saving…' : 'Change email'}
          </button>
          {emailMsg ? <p className="text-xs mt-2" style={{ color: ctl.muted }}>{emailMsg}</p> : null}

          <h2 className="text-sm font-semibold mt-6 mb-2">New password</h2>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            className="w-full rounded-xl p-3 text-sm outline-none"
            style={inputStyle}
          />
          <button
            onClick={changePassword}
            disabled={passBusy || !password}
            className="w-full mt-2 rounded-xl py-2.5 text-sm font-semibold"
            style={{ ...buttonStyle, opacity: passBusy || !password ? 0.5 : 1 }}
          >
            {passBusy ? 'Saving…' : 'Change password'}
          </button>
          {passMsg ? <p className="text-xs mt-2" style={{ color: ctl.muted }}>{passMsg}</p> : null}

          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full mt-8 rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-2"
            style={{ background: ctl.bad, color: '#fff', opacity: signingOut ? 0.6 : 1 }}
          >
            <LogOut size={16} /> {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </>
      )}
    </ControllerShell>
  )
      }
