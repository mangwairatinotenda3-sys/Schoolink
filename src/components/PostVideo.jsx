import { useEffect, useRef, useState } from 'react'
import { Play, Pause, Volume2, VolumeX, Maximize, Loader2, RotateCw } from 'lucide-react'
import { formatDuration } from '../lib/mediaTools.js'

// Only one video in the feed plays at a time.
let activeVideo = null

// The video player used in posts: thumbnail with a play button, then tap for controls.
// It pauses by itself when you scroll past it.
export default function PostVideo({ src }) {
  const wrapRef = useRef(null)
  const videoRef = useRef(null)
  const hideTimer = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [started, setStarted] = useState(false)
  const [buffering, setBuffering] = useState(false)
  const [muted, setMuted] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [ratio, setRatio] = useState(16 / 9)
  const [controls, setControls] = useState(true)
  const [failed, setFailed] = useState(false)
  const [scrubbing, setScrubbing] = useState(false)

  // Pause when scrolled out of sight.
  useEffect(() => {
    const el = wrapRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return undefined
    const observer = new IntersectionObserver(
      ([entry]) => { if (!entry.isIntersecting) videoRef.current?.pause() },
      { threshold: 0.35 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => () => {
    clearTimeout(hideTimer.current)
    if (activeVideo === videoRef.current) activeVideo = null
  }, [])

  function showControlsBriefly() {
    setControls(true)
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setControls(false), 2600)
  }

  function togglePlay(e) {
    e?.stopPropagation()
    const v = videoRef.current
    if (!v) return
    if (v.paused) {
      if (activeVideo && activeVideo !== v) activeVideo.pause()
      activeVideo = v
      setStarted(true)
      v.play().catch(() => setFailed(true))
    } else {
      v.pause()
    }
  }

  function handleSurfaceTap(e) {
    e.stopPropagation()
    if (!started) {
      togglePlay()
      return
    }
    if (controls) {
      setControls(false)
      clearTimeout(hideTimer.current)
    } else {
      showControlsBriefly()
    }
  }

  function seekFromEvent(e) {
    const v = videoRef.current
    if (!v || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratioX = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    v.currentTime = ratioX * duration
    setCurrent(v.currentTime)
  }

  function toggleMute(e) {
    e.stopPropagation()
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
    setMuted(v.muted)
    showControlsBriefly()
  }

  function goFullscreen(e) {
    e.stopPropagation()
    const v = videoRef.current
    const wrap = wrapRef.current
    try {
      if (wrap?.requestFullscreen) wrap.requestFullscreen()
      else if (v?.webkitEnterFullscreen) v.webkitEnterFullscreen()
    } catch {
      // not supported here
    }
  }

  function retry(e) {
    e.stopPropagation()
    setFailed(false)
    setStarted(false)
    videoRef.current?.load()
  }

  const progress = duration > 0 ? (current / duration) * 100 : 0
  const showUi = !started || controls || !playing || scrubbing

  return (
    <div
      ref={wrapRef}
      onClick={handleSurfaceTap}
      className="relative mt-2 rounded-xl overflow-hidden bg-black select-none"
      style={{ aspectRatio: Math.min(1.9, Math.max(0.8, ratio)) }}
    >
      <video
        ref={videoRef}
        src={`${src}#t=0.1`}
        playsInline
        preload="metadata"
        className="w-full h-full object-contain"
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration)
          if (e.currentTarget.videoWidth && e.currentTarget.videoHeight) setRatio(e.currentTarget.videoWidth / e.currentTarget.videoHeight)
        }}
        onTimeUpdate={(e) => { if (!scrubbing) setCurrent(e.currentTarget.currentTime) }}
        onPlay={() => { setPlaying(true); showControlsBriefly() }}
        onPause={() => { setPlaying(false); setControls(true) }}
        onEnded={() => { setPlaying(false); setControls(true); setCurrent(0); if (videoRef.current) videoRef.current.currentTime = 0 }}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
        onError={() => setFailed(true)}
      />

      {failed ? (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-2 text-white text-sm">
          <span>Couldn't load this video</span>
          <button onClick={retry} className="flex items-center gap-1.5 bg-white/20 rounded-full px-4 py-1.5"><RotateCw size={14} /> Try again</button>
        </div>
      ) : null}

      {!failed && buffering && playing ? (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><Loader2 size={34} className="text-white animate-spin" /></div>
      ) : null}

      {!failed && !started ? (
        <>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="w-16 h-16 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center"><Play size={30} className="text-white ml-1" fill="currentColor" /></span>
          </div>
          {duration > 0 ? <span className="absolute bottom-2 right-2 bg-black/65 text-white text-[11px] font-medium rounded-md px-1.5 py-0.5">{formatDuration(duration)}</span> : null}
        </>
      ) : null}

      {!failed && started && showUi ? (
        <>
          {!buffering || !playing ? (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <button onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'} className="pointer-events-auto w-14 h-14 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center">
                {playing ? <Pause size={26} className="text-white" fill="currentColor" /> : <Play size={26} className="text-white ml-1" fill="currentColor" />}
              </button>
            </div>
          ) : null}
          <div className="absolute inset-x-0 bottom-0 px-3 pb-2 pt-8 bg-gradient-to-t from-black/70 to-transparent" onClick={(e) => e.stopPropagation()}>
            <div
              className="h-5 flex items-center cursor-pointer touch-none"
              onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); setScrubbing(true); seekFromEvent(e) }}
              onPointerMove={(e) => { if (scrubbing) seekFromEvent(e) }}
              onPointerUp={() => { setScrubbing(false); showControlsBriefly() }}
              onPointerCancel={() => setScrubbing(false)}
            >
              <div className="relative w-full h-1 bg-white/30 rounded-full">
                <div className="absolute inset-y-0 left-0 bg-white rounded-full" style={{ width: `${progress}%` }} />
                <span className="absolute top-1/2 w-3 h-3 rounded-full bg-white -translate-y-1/2 -translate-x-1/2" style={{ left: `${progress}%` }} />
              </div>
            </div>
            <div className="flex items-center justify-between text-white text-[11px] mt-0.5">
              <span>{formatDuration(current)} / {formatDuration(duration)}</span>
              <span className="flex items-center gap-4">
                <button onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>{muted ? <VolumeX size={17} /> : <Volume2 size={17} />}</button>
                <button onClick={goFullscreen} aria-label="Full screen"><Maximize size={16} /></button>
              </span>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
