// Meta-style verified badge (the scalloped blue seal with a white tick used on
// Facebook, Instagram and WhatsApp). It is self-contained: it always shows,
// with no lookup, so it can sit next to the fixed "Schoolink" name.

const POINTS = Array.from({ length: 24 }, (_, i) => {
  const angle = (Math.PI * 2 * i) / 24 - Math.PI / 2
  const r = i % 2 === 0 ? 10.8 : 9.3
  return `${(12 + r * Math.cos(angle)).toFixed(2)},${(12 + r * Math.sin(angle)).toFixed(2)}`
}).join(' ')

export default function MetaBadge({ size = 16, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label="Verified"
      className={`inline-block shrink-0 ${className}`}
    >
      <title>Verified</title>
      <polygon points={POINTS} fill="#0095F6" stroke="#0095F6" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M7.6 12.4l3 3 5.8-6.2" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
                          }
