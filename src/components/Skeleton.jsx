// Placeholder shapes shown while content loads, so a screen never sits blank.
const SHIMMER = {
  background: 'linear-gradient(90deg, rgba(124,92,255,0.07) 0%, rgba(124,92,255,0.16) 50%, rgba(124,92,255,0.07) 100%)',
  backgroundSize: '200% 100%',
  animation: 'sl-shimmer 1.2s ease-in-out infinite',
}

export function SkeletonBlock({ w = '100%', h = 12, r = 8, className = '', style }) {
  return <span className={`block ${className}`} style={{ width: w, height: h, borderRadius: r, ...SHIMMER, ...style }} />
}

export function PostSkeleton() {
  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden p-4" aria-hidden="true">
      <style>{'@keyframes sl-shimmer { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }'}</style>
      <div className="flex items-center gap-3">
        <SkeletonBlock w={42} h={42} r={999} />
        <div className="flex-1 space-y-2">
          <SkeletonBlock w="40%" h={12} />
          <SkeletonBlock w="25%" h={10} />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <SkeletonBlock h={12} />
        <SkeletonBlock w="85%" h={12} />
        <SkeletonBlock w="60%" h={12} />
      </div>
      <SkeletonBlock h={170} r={14} className="mt-4" />
      <div className="flex gap-5 mt-4">
        <SkeletonBlock w={52} h={16} />
        <SkeletonBlock w={52} h={16} />
      </div>
    </div>
  )
}

export function PostListSkeleton({ count = 3 }) {
  return (
    <div className="space-y-4" aria-label="Loading posts" role="status">
      {Array.from({ length: count }).map((_, i) => <PostSkeleton key={i} />)}
    </div>
  )
}
