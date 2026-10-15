// A profile picture with a ring around it. The ring is split into one piece per update,
// and the pieces you have already seen turn grey.
export default function StatusRing({ src, name = '', size = 44, flags = [], seenColor = 'rgba(255,255,255,0.45)', unseenColor = 'var(--brand-purple)', children }) {
  const count = Math.min(flags.length, 12)
  const stroke = 2.5
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const segment = count > 1 ? c / count : c
  const gap = count > 1 ? 4 : 0
  const initial = (name || '?').trim().slice(0, 1).toUpperCase()
  const inset = count > 0 ? 5 : 0

  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      {count > 0 ? (
        <svg width={size} height={size} className="absolute inset-0" style={{ transform: 'rotate(-90deg)' }}>
          {Array.from({ length: count }).map((_, i) => (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              strokeWidth={stroke}
              strokeLinecap="round"
              stroke={flags.length > 12 ? (flags.every(Boolean) ? seenColor : unseenColor) : flags[i] ? seenColor : unseenColor}
              strokeDasharray={`${Math.max(0.1, segment - gap)} ${c - Math.max(0.1, segment - gap)}`}
              strokeDashoffset={-i * segment}
            />
          ))}
        </svg>
      ) : null}
      <span className="absolute rounded-full overflow-hidden bg-brand-light flex items-center justify-center" style={{ inset }}>
        {src ? <img src={src} alt="" className="w-full h-full object-cover" /> : <span className="text-brand-purple font-semibold" style={{ fontSize: size * 0.36 }}>{initial}</span>}
      </span>
      {children}
    </span>
  )
}
