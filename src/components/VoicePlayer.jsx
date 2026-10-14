import { useEffect, useMemo, useRef, useState } from 'react'
import { Play, Pause } from 'lucide-react'

// Only one voice note plays at a time, like WhatsApp.
let currentlyPlaying = null

function clock(seconds) {
  const s = Number.isFinite(seconds) && seconds > 0 ? seconds : 0
  const m = Math.floor(s / 60)
  const r = Math.floor(s % 60)
  return `${m}:${String(r).padStart(2, '0')}`
}

// A steady "sound wave" look: the same message always gets the same bars.
function barHeights(seed, count) {
  let h = 7
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  const out = []
  for (let i = 0; i < count; i += 1) {
    h = (h * 1664525 + 1013904223) >>> 0
    out.push(25 + (h % 75))
  }
  return out
}

const SPEEDS = [1, 1.5, 2]
const BAR_COUNT = 30

export default function VoicePlayer({ url, mine }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [failed, setFailed] = useState(false)
  const bars = useMemo(() => barHeights(url || 'x', BAR_COUNT), [url])

  useEffect(() => () => {
    if (currentlyPlaying === audioRef.current) currentlyPlaying = null
  }, [])

  // Voice notes recorded in the browser often report an unknown length until they are played once.
  function handleLoadedMetadata() {
    const a = audioRef.current
    if (!a) return
    if (a.duration === Infinity || Number.isNaN(a.duration)) {
      const fix = () => {
        a.removeEventListener('timeupdate', fix)
        setDuration(Number.isFinite(a.duration) ? a.duration : 0)
        a.currentTime = 0
      }
      a.addEventListener('timeupdate', fix)
      a.currentTime = 1e101
    } else {
      setDuration(a.duration)
    }
  }

  function toggle(e) {
    e.stopPropagation()
    const a = audioRef.current
    if (!a) return
    if (a.paused) {
      if (currentlyPlaying && currentlyPlaying !== a) currentlyPlaying.pause()
      currentlyPlaying = a
      a.playbackRate = speed
      a.play().catch(() => setFailed(true))
    } else {
      a.pause()
    }
  }

  function seek(e) {
    e.stopPropagation()
    const a = audioRef.current
    if (!a || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    a.currentTime = ratio * duration
    setCurrent(a.currentTime)
  }

  function nextSpeed(e) {
    e.stopPropagation()
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]
    setSpeed(next)
    if (audioRef.current) audioRef.current.playbackRate = next
  }

  const progress = duration > 0 ? Math.min(1, current / duration) : 0
  const playedColor = mine ? 'bg-white' : 'bg-brand-purple'
  const idleColor = mine ? 'bg-white/40' : 'bg-gray-300'

  return (
    <div className="flex items-center gap-2 w-56 max-w-full py-1" onClick={(e) => e.stopPropagation()}>
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={() => { if (audioRef.current) setCurrent(audioRef.current.currentTime) }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setCurrent(0); if (currentlyPlaying === audioRef.current) currentlyPlaying = null }}
        onError={() => setFailed(true)}
      />
      <button
        onClick={toggle}
        aria-label={playing ? 'Pause voice message' : 'Play voice message'}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${mine ? 'bg-white/25' : 'bg-brand-purple'}`}
      >
        {playing ? <Pause size={16} className="text-white" /> : <Play size={16} className="text-white ml-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <div onClick={seek} className="flex items-center gap-[2px] h-7 cursor-pointer">
          {bars.map((h, i) => (
            <span
              key={i}
              style={{ height: `${h}%` }}
              className={`flex-1 rounded-full ${i / BAR_COUNT < progress ? playedColor : idleColor}`}
            />
          ))}
        </div>
        <div className="flex items-center justify-between text-[10px] opacity-80 mt-0.5">
          <span>{failed ? "Can't play" : playing || current > 0 ? clock(current) : clock(duration)}</span>
          {playing || speed !== 1 ? (
            <button onClick={nextSpeed} className={`px-1.5 rounded-full text-[10px] font-semibold ${mine ? 'bg-white/25' : 'bg-gray-200 text-brand-navy'}`}>{speed}x</button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
