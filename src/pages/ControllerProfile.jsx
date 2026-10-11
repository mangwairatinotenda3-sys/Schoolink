import { useRef, useState } from 'react'
import { Camera, User } from 'lucide-react'
import ControllerShell, { ctl } from '../components/ControllerShell.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { ROLE_LABELS } from '../lib/team.js'

const inputStyle = { background: ctl.card, border: `1px solid ${ctl.border}`, color: ctl.text }

// Your own profile inside the Control Center: photo, email and password.
// Your team role belongs to your account, so changing the email keeps it.
export default function ControllerProfile() {
  const { user, profile, teamRole, saveProfileDetails } = useAuth()
  const fileRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [photoMsg, setPhotoMsg] = useState('')
  const [email, setEmail] = useState(user?.email || '')
  const [emailMsg, setEmailMsg] = useState('')
  const [emailBusy, setEmailBusy] = useState(false)
  const [password, setPassword] = useState('')
  const [passMsg, setPassMsg] = useState('')
  const [passBusy, setPassBusy] = useState(false)

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

  return (
    <ControllerShell title="My Profile">
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
        <p className="text-xs mt-2" style={{ color: ctl.muted }}>{uploading ? 'Uploading…' : ROLE_LABELS[teamRole] || teamRole}</p>
        {photoMsg ? <p className="text-xs mt-1" style={{ color: ctl.muted }}>{photoMsg}</p> : null}
      </div>

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
        style={{ background: '#6366F1', color: '#fff', opacity: emailBusy || email.trim() === user?.email ? 0.5 : 1 }}
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
        style={{ background: '#6366F1', color: '#fff', opacity: passBusy || !password ? 0.5 : 1 }}
      >
        {passBusy ? 'Saving…' : 'Change password'}
      </button>
      {passMsg ? <p className="text-xs mt-2" style={{ color: ctl.muted }}>{passMsg}</p> : null}
    </ControllerShell>
  )
}
