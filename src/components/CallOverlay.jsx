import { useEffect, useRef, useState } from 'react'
import { Room, RoomEvent, Track } from 'livekit-client'
import { Mic, MicOff, Video, VideoOff, PhoneOff, Phone, RefreshCw } from 'lucide-react'
import { useCalls } from '../context/CallContext.jsx'

const RING_LIMIT_MS = 45 * 1000

function Avatar({ src, name, size }) {
  if (src) return <img src={src} alt="" className="rounded-full object-cover" style={{ width: size, height: size }} />
  return (
    <span
      className="rounded-full flex items-center justify-center font-bold text-white"
      style={{ width: size, height: size, background: '#6D4DFF', fontSize: size * 0.4 }}
    >
      {(name || '?').trim().charAt(0).toUpperCase()}
    </span>
  )
}

function IncomingCall({ incoming, onAccept, onDecline }) {
  const { call, peer } = incoming
  const video = call.kind === 'video'
  return (
    <div
      className="fixed inset-0 z-[120] flex flex-col items-center justify-between py-16 px-6 text-center"
      style={{ background: 'linear-gradient(180deg, #1B1739, #0B0920)', color: '#fff' }}
      role="dialog"
      aria-modal="true"
      aria-label="Incoming call"
    >
      <div className="flex flex-col items-center gap-4 mt-10">
        <Avatar src={peer?.avatar} name={peer?.name} size={120} />
        <p className="text-2xl font-semibold">{peer?.name}</p>
        <p className="text-sm opacity-70">Incoming {video ? 'video' : 'voice'} call</p>
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

function CtlButton({ on = true, onClick, label, children }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="w-14 h-14 rounded-full flex items-center justify-center"
      style={{ background: on ? 'rgba(255,255,255,0.18)' : '#fff', color: on ? '#fff' : '#0B0920' }}
    >
      {children}
    </button>
  )
}

function ActiveCall({ active, hangUp, setNotice }) {
  const { call, token, url, role, peer, connected } = active
  const video = call.kind === 'video'
  const [room, setRoom] = useState(null)
  const [mic, setMic] = useState(true)
  const [cam, setCam] = useState(video)
  const [facing, setFacing] = useState('user')
  const [others, setOthers] = useState(0)
  const remoteBox = useRef(null)
  const localVideo = useRef(null)
  const audioBox = useRef(null)

  // Join the LiveKit room once, and leave it when the call screen closes
  useEffect(() => {
    const r = new Room({ adaptiveStream: true, dynacast: true })
    let cancelled = false
    const count = () => setOthers(r.remoteParticipants.size)
    const attachLocal = () => {
      const pub = r.localParticipant.getTrackPublication(Track.Source.Camera)
      if (pub?.track && localVideo.current) pub.track.attach(localVideo.current)
    }

    r.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === Track.Kind.Video && remoteBox.current) {
        const el = track.attach()
        el.style.width = '100%'
        el.style.height = '100%'
        el.style.objectFit = 'cover'
        remoteBox.current.appendChild(el)
      }
      if (track.kind === Track.Kind.Audio && audioBox.current) audioBox.current.appendChild(track.attach())
    })
    r.on(RoomEvent.TrackUnsubscribed, (track) => { track.detach().forEach((el) => el.remove()) })
    r.on(RoomEvent.ParticipantConnected, count)
    r.on(RoomEvent.ParticipantDisconnected, count)
    r.on(RoomEvent.Disconnected, () => { if (!cancelled) hangUp() })

    ;(async () => {
      try {
        await r.connect(url, token)
        if (cancelled) { r.disconnect(); return }
        await r.localParticipant.setMicrophoneEnabled(true)
        if (video) {
          try {
            await r.localParticipant.setCameraEnabled(true)
            attachLocal()
          } catch {
            setCam(false)
            setNotice('Camera not available. Joined with voice only.')
          }
        }
        setRoom(r)
        count()
      } catch {
        if (!cancelled) {
          setNotice('Could not connect. Check the camera and microphone permissions.')
          hangUp()
        }
      }
    })()

    return () => { cancelled = true; r.disconnect() }
  }, [token, url])

  // The caller stops ringing after 45 seconds
  useEffect(() => {
    if (connected || role !== 'caller') return undefined
    const t = setTimeout(() => { setNotice('No answer.'); hangUp() }, RING_LIMIT_MS)
    return () => clearTimeout(t)
  }, [connected, role])

  async function toggleMic() {
    if (!room) return
    const next = !mic
    try { await room.localParticipant.setMicrophoneEnabled(next); setMic(next) } catch { setNotice('Could not change the microphone.') }
  }

  async function toggleCam() {
    if (!room) return
    const next = !cam
    try {
      await room.localParticipant.setCameraEnabled(next)
      setCam(next)
      if (next) {
        const pub = room.localParticipant.getTrackPublication(Track.Source.Camera)
        if (pub?.track && localVideo.current) pub.track.attach(localVideo.current)
      }
    } catch {
      setNotice('Could not change the camera.')
    }
  }

  async function flip() {
    if (!room) return
    const pub = room.localParticipant.getTrackPublication(Track.Source.Camera)
    if (!pub?.track) return
    const next = facing === 'user' ? 'environment' : 'user'
    try { await pub.track.restartTrack({ facingMode: next }); setFacing(next) } catch { setNotice('Could not switch the camera.') }
  }

  const showRemoteVideo = video && others > 0
  const status = others > 0 ? 'Connected' : connected ? 'Connecting…' : 'Ringing…'

  return (
    <div className="fixed inset-0 z-[120] overflow-hidden" style={{ background: '#0B0920', color: '#fff' }} role="dialog" aria-modal="true" aria-label="Call">
      <div ref={remoteBox} className="absolute inset-0 flex items-center justify-center bg-black" />
      <div ref={audioBox} className="hidden" />

      {!showRemoteVideo ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <Avatar src={peer?.avatar} name={peer?.name} size={120} />
          <p className="text-2xl font-semibold">{peer?.name}</p>
          <p className="text-sm opacity-70">{status}</p>
        </div>
      ) : (
        <p className="absolute top-4 left-4 text-sm rounded-full px-3 py-1" style={{ background: 'rgba(0,0,0,0.45)' }}>
          {peer?.name} · {status}
        </p>
      )}

      {video ? (
        <video
          ref={localVideo}
          autoPlay
          muted
          playsInline
          className="absolute top-4 right-4 w-28 h-40 rounded-2xl object-cover"
          style={{
            display: cam ? 'block' : 'none',
            transform: facing === 'user' ? 'scaleX(-1)' : 'none',
            border: '2px solid rgba(255,255,255,0.25)',
          }}
        />
      ) : null}

      <div className="absolute bottom-0 inset-x-0 flex items-center justify-center gap-4 pt-4" style={{ paddingBottom: 'max(28px, env(safe-area-inset-bottom))' }}>
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
        <button onClick={hangUp} aria-label="End call" className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center">
          <PhoneOff size={26} />
        </button>
      </div>
    </div>
  )
}

// Put this once in main.jsx, inside CallProvider
export default function CallOverlay() {
  const { incoming, active, notice, clearNotice, setNotice, accept, decline, hangUp } = useCalls()

  useEffect(() => {
    if (!notice) return undefined
    const t = setTimeout(clearNotice, 3500)
    return () => clearTimeout(t)
  }, [notice, clearNotice])

  return (
    <>
      {notice ? (
        <div role="status" className="fixed top-4 left-1/2 -translate-x-1/2 z-[130] rounded-2xl px-4 py-2.5 text-sm text-white shadow-lg" style={{ background: '#1B1739' }}>
          {notice}
        </div>
      ) : null}
      {incoming && !active ? <IncomingCall incoming={incoming} onAccept={accept} onDecline={decline} /> : null}
      {active ? <ActiveCall active={active} hangUp={hangUp} setNotice={setNotice} /> : null}
    </>
  )
}

// Phone buttons for a chat header. Put <CallButtons ... /> in the header of a chat.
export function CallButtons({ partnerId, partnerName, partnerAvatar }) {
  const { startCall } = useCalls()
  if (!partnerId) return null
  const go = (kind) => startCall(partnerId, kind, { name: partnerName || 'Schoolink member', avatar: partnerAvatar || null })
  return (
    <>
      <button onClick={() => go('voice')} aria-label="Voice call" className="p-1.5"><Phone size={18} className="text-gray-400" /></button>
      <button onClick={() => go('video')} aria-label="Video call" className="p-1.5"><Video size={18} className="text-gray-400" /></button>
    </>
  )
}
