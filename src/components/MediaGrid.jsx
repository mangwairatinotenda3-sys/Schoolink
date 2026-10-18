import { useNavigate } from 'react-router-dom'
import { Play, Layers, ImageOff } from 'lucide-react'

// Photos and videos of a person's posts as a tight 3-column grid, like TikTok's profile grid.
export function postMedia(post) {
  const images = post.image_urls && post.image_urls.length > 0 ? post.image_urls : post.image_url ? [post.image_url] : []
  return { images, video: post.video_url || null }
}

export function hasMedia(post) {
  const m = postMedia(post)
  return m.images.length > 0 || !!m.video
}

export default function MediaGrid({ posts }) {
  const navigate = useNavigate()
  const items = posts.filter(hasMedia)

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center text-gray-400 py-14">
        <span className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3"><ImageOff size={22} /></span>
        <p className="text-sm">No photos or videos yet</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-px bg-white -mx-4">
      {items.map((p) => {
        const { images, video } = postMedia(p)
        return (
          <button
            key={p.id}
            onClick={() => navigate(`/post/${p.id}`)}
            aria-label={video ? 'Open video post' : 'Open photo post'}
            className="relative block w-full bg-gray-100 overflow-hidden active:opacity-80"
            style={{ aspectRatio: '3 / 4' }}
          >
            {video && images.length === 0 ? (
              <video src={`${video}#t=0.1`} preload="metadata" muted playsInline className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
            ) : (
              <img src={images[0]} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
            )}
            {video ? (
              <span className="absolute top-1.5 right-1.5 text-white drop-shadow"><Play size={15} fill="currentColor" /></span>
            ) : images.length > 1 ? (
              <span className="absolute top-1.5 right-1.5 text-white drop-shadow"><Layers size={15} /></span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
