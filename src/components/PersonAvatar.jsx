// A round profile picture, or the first letter of the name when there is no picture.
export default function PersonAvatar({ p, size = 44 }) {
  const style = { width: size, height: size }
  if (p?.avatar_url) return <img src={p.avatar_url} alt="" className="rounded-full object-cover shrink-0" style={style} />
  return (
    <span className="rounded-full bg-brand-light text-brand-purple font-semibold flex items-center justify-center shrink-0" style={{ ...style, fontSize: Math.max(12, size * 0.4) }}>
      {(p?.full_name || '?').slice(0, 1).toUpperCase()}
    </span>
  )
}
