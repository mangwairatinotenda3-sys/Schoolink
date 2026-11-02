import { useEffect, useMemo, useRef, useState } from 'react'
import { Room, RoomEvent, Track } from 'livekit-client'
import { Mic, MicOff, Video, VideoOff, PhoneOff, Phone, RefreshCw, UserPlus, Check, Search } from 'lucide-react'
import BottomSheet from './BottomSheet.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useCalls } from '../context/CallContext.jsx'

const ROOM_EVENTS = [
  RoomEvent.ParticipantConnected,
  RoomEvent.ParticipantDisconnected,
  RoomEvent.TrackSubscribed,
  RoomEvent.TrackUnsubscribed,
  RoomEvent.TrackPublished,
  RoomEvent.TrackUnpublished,
  RoomEvent.LocalTrackPublished,
  RoomEvent.LocalTrackUnpublished,
  RoomEvent.TrackMuted,
  RoomEvent.TrackUnmuted,
  RoomEvent.ActiveSpeakersChanged,
]

const RELATION_TEXT = {
  call: 'Can call',
  send: 'Not connected yet',
  pending: 'Request sent, waiting for them',
  closed: 'Only takes calls from their school',
}

function parseMeta(raw) {
  try { return JSON.parse(raw || '{}') || {} } catch { return {} }
}

function elapsed(ms) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n) => String(n).padStart(2, '0')
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
}

function Avatar({ src, name, size }) {
  if (src) return <img src={src} alt="" className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />
  return (
    <span
      className="rounded-full flex items-center justify-center font-bold text-white shrink-0"
      style={{ width: size, height: size, background: '#6D4DFF', fontSize: size * 0.4 }}
    >
      {(name || '?').trim().charAt(0).toUpperCase()}
    </span>
  )
}

function IncomingCall({ incoming, onAccept, onDecline }) {
  const { caller, kind, others } = incoming
  const video = kind === 'video'
  const group = others.length > 0
  const withText = others.slice(0, 2).map((o) => o.name).join(', ') + (others.length > 2 ? ` +${others.length - 2}` : '')
  return (
    <div
      className="fixed inset-0 z-[120] flex flex-col items-center justify-between py-16 px-6 text-center"
      style={{ background: 'linear-gradient(180deg, #1B1739, #0B0920)', color: '#fff' }}
      role="dialog"
      aria-modal="true"
      aria-label="Incoming call"
    >
      <div className="flex flex-col items-center gap-4 mt-10">
        <Avatar src={caller?.avatar} name={caller?.name} size={120} />
        <p className="text-2xl font-semibold">{caller?.name}</p>
        <p className="text-sm opacity-70">
          {group ? 'Group' : 'Incoming'} {video ? 'video' : 'voice'} call
          {group ? ` · with ${withText}` : ''}
        </p>
      </div>
      <div className="w-full max-w-sm grid grid-cols-2 gap-6">
        <div className="flex flex-col items-center gap-2">
          <button onClick={onDecline} aria-label="Decline" className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center">
            <PhoneOff size={30} />
          </button>
          <span className="text-xs opacity-80">Decline</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <button onClick={onAccept} aria-label="Accept" className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center">
            <Phone size={30} />
          </button>
          <span className="text-xs opacity-80">Accept</span>
        </div>
      </div>
    </div>
  )
}

// Someone outside the school asks to call me. Accept lets them call me from now on.
function CallRequestSheet({ request, onRespond, onLater }) {
  return (
    <BottomSheet onClose={onLater}>
      <div className="px-4 pb-4 flex flex-col items-center text-center">
        <Avatar src={request.avatar} name={request.name} size={72} />
        <p className="font-semibold text-base mt-3">{request.name}</p>
        <p className="text-sm text-gray-500 mt-1 max-w-xs">
          wants to call you on Schoolink. If you accept, they can call you from now on. You can remove them any time in Privacy settings.
        </p>
        <div className="grid grid-cols-2 gap-3 w-full mt-5">
          <button onClick={() => onRespond(request.requesterId, false)} className="py-3 rounded-full bg-gray-100 font-semibold text-gray-700">
            Decline
          </button>
          <button onClick={() => onRespond(request.requesterId, true)} className="py-3 rounded-full bg-brand-purple text-white font-semibold">
            Accept
          </button>
        </div>
        <button onClick={onLater} className="mt-3 text-sm text-gray-500 py-2">Not now</button>
      </div>
    </BottomSheet>
  )
}

function CtlButton({ on = true, onClick, label, children }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="w-14 h-14 rounded-full flex items-center justify-center shrink-0"
      style={{ background: on ? 'rgba(255,255,255,0.18)' : '#fff', color: on ? '#fff' : '#0B0920' }}
    >
      {children}
    </button>
  )
}

// One person's square in the call grid. Pending = invited, still ringing.
function Tile({ participant, isLocal = false, pending = null, mirror = false }) {
  const videoEl = useRef(null)
  const audioEl = useRef(null)
  const name = pending ? pending.name : participant?.name || participant?.identity || 'Member'
  const avatar = pending ? pending.avatar : parseMeta(participant?.metadata).avatar
  const camPub = participant && !pending ? participant.getTrackPublication(Track.Source.Camera) : null
  const micPub = participant && !pending ? participant.getTrackPublication(Track.Source.Microphone) : null
  const camTrack = camPub?.track && !camPub.isMuted ? camPub.track : null
  const micTrack = !isLocal && micPub?.track ? micPub.track : null
  const speaking = !pending && !!participant?.isSpeaking
  const micOff = !pending && participant && !participant.isMicrophoneEnabled

  useEffect(() => {
    const el = videoEl.current
    if (!camTrack || !el) return undefined
    camTrack.attach(el)
    return () => { camTrack.detach(el) }
  }, [camTrack])

  useEffect(() => {
    const el = audioEl.current
    if (!micTrack || !el) return undefined
    micTrack.attach(el)
    return () => { micTrack.detach(el) }
  }, [micTrack])

  return (
    <div
      className="relative rounded-2xl overflow-hidden flex items-center justify-center min-h-0"
      style={{ background: '#1B1739', boxShadow: speaking ? '0 0 0 3px #22c55e' : 'none', transition: 'box-shadow 150ms' }}
    >
      {camTrack ? (
        <video
          ref={videoEl}
          autoPlay
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: mirror ? 'scaleX(-1)' : 'none' }}
        />
      ) : (
        <Avatar src={avatar} name={name} size={88} />
      )}
      <audio ref={audioEl} autoPlay className="hidden" />
      <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1.5 min-w-0">
        <span className="text-xs font-medium truncate rounded-full px-2 py-0.5" style={{ background: 'rgba(0,0,0,0.5)' }}>
          {isLocal ? 'You' : name}
        </span>
        {micOff ? <MicOff size={14} className="shrink-0" /> : null}
        {pending ? <span className="ml-auto text-[11px] opacity-80 shrink-0">Calling…</span> : null}
      </div>
    </div>
  )
}

// Search anyone by name and tick people. Strangers show a Request button until they accept.
export function ContactPicker({ exclude = [], max = 11, confirmLabel = 'Start', onConfirm, header = null }) {
  const { requestCall } = useCalls()
  const [q, setQ] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [override, setOverride] = useState({})
  const [picked, setPicked] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const needle = q.trim()
    if (needle.length < 2) { setResults(null); setLoading(false); return undefined }
    let live = true
    setLoading(true)
    const t = setTimeout(async () => {
      const { data, error: err } = await supabase.rpc('call_search', { p_query: needle })
      if (!live) return
      setLoading(false)
      if (err) { setResults([]); setError('Could not search people. Try again.'); return }
      setError('')
      setOverride({})
      setResults(data ?? [])
    }, 300)
    return () => { live = false; clearTimeout(t) }
  }, [q])

  const relationOf = (c) => override[c.id] || c.relation
  const shown = (results ?? []).filter((c) => !exclude.includes(c.id))

  function toggle(c) {
    setError('')
    if (picked.includes(c.id)) { setPicked(picked.filter((x) => x !== c.id)); return }
    if (picked.length >= max) { setError(`You can add up to ${max} people.`); return }
    setPicked([...picked, c.id])
  }

  async function sendRequest(c) {
    setError('')
    const status = await requestCall(c.id)
    if (status === 'accepted') setOverride((o) => ({ ...o, [c.id]: 'call' }))
    else if (status === 'pending') setOverride((o) => ({ ...o, [c.id]: 'pending' }))
  }

  async function confirm() {
    if (!picked.length || busy) return
    setBusy(true)
    try { await onConfirm(picked) } finally { setBusy(false) }
  }

  return (
    <div className="px-2">
      {header}
      <div className="relative mb-2">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search anyone by name"
          aria-label="Search people"
          className="w-full border border-gray-200 rounded-full pl-9 pr-4 py-2.5 text-sm outline-brand-purple"
        />
      </div>
      {error ? <p role="alert" className="text-sm text-red-500 px-1 mb-2">{error}</p> : null}
      <div className="max-h-[48dvh] overflow-y-auto -mx-1">
        {q.trim().length < 2 ? (
          <p className="text-sm text-gray-500 px-3 py-6 text-center">
            Type at least 2 letters to find someone. You can call anyone who accepts your request.
          </p>
        ) : loading ? (
          <p className="text-sm text-gray-500 px-3 py-6 text-center">Searching…</p>
        ) : shown.length === 0 ? (
          <p className="text-sm text-gray-500 px-3 py-6 text-center">No one matches.</p>
        ) : shown.map((c) => {
          const rel = relationOf(c)
          const can = rel === 'call'
          const on = picked.includes(c.id)
          return (
            <div key={c.id} className="flex items-center gap-2 px-3 py-2 rounded-xl">
              <button
                onClick={() => can && toggle(c)}
                disabled={!can}
                className="flex-1 min-w-0 flex items-center gap-3 py-0.5 text-left disabled:cursor-default"
              >
                <Avatar src={c.avatar_url} name={c.full_name} size={40} />
                <span className="flex-1 min-w-0">
                  <span className="block truncate font-medium">{c.full_name || 'Schoolink member'}</span>
                  <span className="block text-xs text-gray-400 truncate">{RELATION_TEXT[rel] || ''}</span>
                </span>
                {can ? (
                  <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${on ? 'bg-brand-purple border-brand-purple text-white' : 'border-gray-300'}`}>
                    {on ? <Check size={14} /> : null}
                  </span>
                ) : null}
              </button>
              {rel === 'send' ? (
                <button onClick={() => sendRequest(c)} className="shrink-0 text-xs font-semibold text-brand-purple bg-brand-light rounded-full px-3 py-1.5">
                  Request
                </button>
              ) : null}
            </div>
          )
        })}
      </div>
      <button
        onClick={confirm}
        disabled={!picked.length || busy}
        className="w-full mt-3 bg-brand-purple text-white font-semibold rounded-full py-3 disabled:opacity-40"
      >
        {busy ? 'Please wait…' : picked.length ? `${confirmLabel} (${picked.length})` : confirmLabel}
      </button>
    </div>
  )
}

function ActiveCall({ active, hangUp, invite, setNotice }) {
  const { kind, token, url, title, pending } = active
  const video = kind === 'video'
  const [room, setRoom] = useState(null)
  const [version, setVersion] = useState(0)
  const [mic, setMic] = useState(true)
  const [cam, setCam] = useState(video)
  const [facing, setFacing] = useState('user')
  const [adding, setAdding] = useState(false)
  const [connectedAt, setConnectedAt] = useState(null)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // Join the LiveKit room once; leave it when this screen closes
  useEffect(() => {
    const r = new Room({ adaptiveStream: true, dynacast: true })
    let cancelled = false
    const bump = () => setVersion((v) => v + 1)
    ROOM_EVENTS.forEach((ev) => r.on(ev, bump))
    r.on(RoomEvent.Disconnected, () => { if (!cancelled) hangUp() })

    ;(async () => {
      try {
        await r.connect(url, token)
        if (cancelled) { r.disconnect(); return }
        await r.localParticipant.setMicrophoneEnabled(true)
        if (video) {
          try {
            await r.localParticipant.setCameraEnabled(true)
          } catch {
            setCam(false)
            setNotice('Camera not available. Joined with voice only.')
          }
        }
        setRoom(r)
        bump()
      } catch {
        if (!cancelled) {
          setNotice('Could not connect. Check the camera and microphone permissions.')
          hangUp()
        }
      }
    })()

    return () => { cancelled = true; r.disconnect() }
  }, [token, url, video, hangUp, setNotice])

  const local = room?.localParticipant
  const remote = room ? Array.from(room.remoteParticipants.values()) : []
  const everyone = room ? [local, ...remote] : []
  const others = remote.length

  useEffect(() => {
    if (others > 0 && !connectedAt) setConnectedAt(Date.now())
  }, [others, connectedAt])

  async function toggleMic() {
    if (!local) return
    const next = !mic
    try { await local.setMicrophoneEnabled(next); setMic(next) } catch { setNotice('Could not change the microphone.') }
  }

  async function toggleCam() {
    if (!local) return
    const next = !cam
    try { await local.setCameraEnabled(next); setCam(next) } catch { setNotice('Could not change the camera.') }
  }

  async function flip() {
    const pub = local?.getTrackPublication(Track.Source.Camera)
    if (!pub?.track) return
    const next = facing === 'user' ? 'environment' : 'user'
    try { await pub.track.restartTrack({ facingMode: next }); setFacing(next) } catch { setNotice('Could not switch the camera.') }
  }

  const tiles = everyone.length + pending.length
  const cols = tiles <= 1 ? 1 : tiles <= 4 ? 2 : 3
  const inCall = [...everyone.map((p) => p.identity), ...pending.map((p) => p.id)]
  const status = others > 0 ? `${others + 1} in call` : pending.length ? 'Calling…' : 'Connecting…'
  const timer = connectedAt ? elapsed(now - connectedAt) : ''

  return (
    <div className="fixed inset-0 z-[120] overflow-hidden" style={{ background: '#0B0920', color: '#fff' }} role="dialog" aria-modal="true" aria-label="Call">
      <div
        className="absolute left-2 right-2 grid gap-2 overflow-y-auto"
        style={{
          top: 72,
          bottom: 124,
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridAutoRows: tiles <= 4 ? 'minmax(0, 1fr)' : 'minmax(150px, 1fr)',
        }}
      >
        {everyone.map((p) => (
          <Tile
            key={p.identity}
            participant={p}
            isLocal={p === local}
            mirror={p === local && facing === 'user'}
          />
        ))}
        {pending.map((p) => <Tile key={`pending-${p.id}`} pending={p} />)}
      </div>

      <div className="absolute top-0 inset-x-0 flex items-center justify-between gap-3 px-4" style={{ paddingTop: 'max(14px, env(safe-area-inset-top))', paddingBottom: 8 }}>
        <div className="min-w-0">
          <p className="font-semibold truncate">{title || (video ? 'Video call' : 'Voice call')}</p>
          <p className="text-xs opacity-70">{status}</p>
        </div>
        {timer ? <span className="text-xs rounded-full px-2.5 py-1 shrink-0" style={{ background: 'rgba(0,0,0,0.45)' }}>{timer}</span> : null}
      </div>

      <div
        className="absolute bottom-0 inset-x-0 flex items-center justify-center gap-3 pt-3"
        style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
      >
        <CtlButton on={mic} onClick={toggleMic} label={mic ? 'Mute microphone' : 'Unmute microphone'}>
          {mic ? <Mic size={22} /> : <MicOff size={22} />}
        </CtlButton>
        {video ? (
          <CtlButton on={cam} onClick={toggleCam} label={cam ? 'Turn camera off' : 'Turn camera on'}>
            {cam ? <Video size={22} /> : <VideoOff size={22} />}
          </CtlButton>
        ) : null}
        {video && cam ? (
          <CtlButton onClick={flip} label="Switch camera">
            <RefreshCw size={22} />
          </CtlButton>
        ) : null}
        <CtlButton onClick={() => setAdding(true)} label="Add people">
          <UserPlus size={22} />
        </CtlButton>
        <button onClick={hangUp} aria-label="End call" className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shrink-0">
          <PhoneOff size={26} />
        </button>
      </div>

      {adding ? (
        <BottomSheet onClose={() => setAdding(false)}>
          <ContactPicker
            exclude={inCall}
            max={Math.max(1, 12 - inCall.length)}
            confirmLabel="Add to call"
            header={<p className="font-semibold text-base mb-3">Add people to this call</p>}
            onConfirm={async (ids) => {
              const ok = await invite(ids)
              if (ok) setAdding(false)
            }}
          />
        </BottomSheet>
      ) : null}
    </div>
  )
}

export default function CallOverlay() {
  const { incoming, active, notice, clearNotice, setNotice, accept, decline, hangUp, invite, requests, respondRequest } = useCalls()
  const [later, setLater] = useState([]) // requests I chose to leave for now this session
  const request = requests.find((r) => !later.includes(r.requesterId)) || null

  useEffect(() => {
    if (!notice) return undefined
    const t = setTimeout(clearNotice, 3500)
    return () => clearTimeout(t)
  }, [notice, clearNotice])

  return (
    <>
      {notice ? (
        <div role="status" className="fixed top-4 left-1/2 -translate-x-1/2 z-[130] rounded-2xl px-4 py-2.5 text-sm text-white shadow-lg max-w-[90vw] text-center" style={{ background: '#1B1739' }}>
          {notice}
        </div>
      ) : null}
      {incoming && !active ? <IncomingCall incoming={incoming} onAccept={accept} onDecline={decline} /> : null}
      {request && !active && !incoming ? (
        <CallRequestSheet
          request={request}
          onRespond={respondRequest}
          onLater={() => setLater((l) => [...l, request.requesterId])}
        />
      ) : null}
      {active ? <ActiveCall active={active} hangUp={hangUp} invite={invite} setNotice={setNotice} /> : null}
    </>
  )
}

// Phone buttons in a chat header: a one-to-one call with this person
export function CallButtons({ partnerId }) {
  const { startCall } = useCalls()
  if (!partnerId) return null
  return (
    <>
      <button onClick={() => startCall({ inviteeIds: [partnerId], kind: 'voice' })} aria-label="Voice call" className="p-1.5">
        <Phone size={18} className="text-gray-400" />
      </button>
      <button onClick={() => startCall({ inviteeIds: [partnerId], kind: 'video' })} aria-label="Video call" className="p-1.5">
        <Video size={18} className="text-gray-400" />
      </button>
    </>
  )
      }
