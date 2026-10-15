import { Camera, MapPin, Link2, CalendarDays, GraduationCap, BadgeCheck } from 'lucide-react'
import StatusRing from './StatusRing.jsx'
import VerifiedBadge from './VerifiedBadge.jsx'

function joinedLabel(dateString) {
  if (!dateString) return ''
  const d = new Date(dateString)
  if (Number.isNaN(d.getTime())) return ''
  return `Joined ${d.toLocaleDateString([], { month: 'long', year: 'numeric' })}`
}

function Stat({ value, label, onClick }) {
  const body = (
    <>
      <span className="block text-lg font-bold leading-tight">{value}</span>
      <span className="block text-xs text-gray-400">{label}</span>
    </>
  )
  return onClick ? <button onClick={onClick} className="flex-1 py-2.5 active:bg-gray-50 rounded-xl">{body}</button> : <div className="flex-1 py-2.5">{body}</div>
}

// The top of a profile: cover photo, picture with a status ring, name, details and numbers.
// `actions` sits at the right of the picture row (Edit profile, or Follow and Message).
export default function ProfileHeader({ person, userId, isMe, school, stats, statusFlags = [], online = false, followsYou = false, joined, onAvatar, onCover, actions, showStats = true, onFollowers, onFollowing }) {
  const name = person?.full_name || 'Schoolink member'
  const role = person?.role || ''
  const links = (person?.links || '').split('\n').map((l) => l.trim()).filter(Boolean)
  const firstLink = links[0]

  return (
    <div className="bg-white">
      {/* Cover */}
      <div className="relative w-full" style={{ aspectRatio: '3 / 1', minHeight: 132 }}>
        <button onClick={onCover} aria-label="Cover photo" className="absolute inset-0 w-full h-full block text-left" style={{ background: 'linear-gradient(135deg, var(--brand-purple, #6C4CE0), #241B4E)' }}>
          {person?.cover_url ? <img src={person.cover_url} alt="" className="w-full h-full object-cover" /> : (
            <svg className="absolute inset-0 w-full h-full opacity-20" aria-hidden="true">
              <defs><pattern id="sl-dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.4" fill="#fff" /></pattern></defs>
              <rect width="100%" height="100%" fill="url(#sl-dots)" />
            </svg>
          )}
          <span className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/25 to-transparent" />
        </button>
        {isMe ? (
          <button onClick={onCover} aria-label="Edit cover photo" className="absolute bottom-3 right-3 w-9 h-9 rounded-full bg-black/45 flex items-center justify-center backdrop-blur">
            <Camera size={17} className="text-white" />
          </button>
        ) : null}
      </div>

      {/* Picture + actions */}
      <div className="px-4 flex items-end justify-between" style={{ marginTop: -46 }}>
        <div className="relative">
          <button onClick={onAvatar} aria-label="Profile photo" className="block rounded-full bg-white p-1 shadow-sm">
            <StatusRing src={person?.avatar_url} name={name} size={96} flags={statusFlags} unseenColor="var(--brand-purple)" seenColor="#C9CBD3" />
          </button>
          {online ? <span className="absolute bottom-2 right-2 w-5 h-5 rounded-full bg-green-500 border-[3px] border-white" /> : null}
          {isMe ? (
            <button onClick={onAvatar} aria-label="Edit profile photo" className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-brand-purple border-[3px] border-white flex items-center justify-center">
              <Camera size={14} className="text-white" />
            </button>
          ) : null}
        </div>
        <div className="flex items-center gap-2 pb-1">{actions}</div>
      </div>

      {/* Who */}
      <div className="px-4 pt-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <h1 className="text-[22px] font-bold leading-tight">{name}</h1>
          {userId ? <VerifiedBadge userId={userId} size={19} /> : null}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {person?.username ? <span className="text-sm text-gray-400">@{person.username}</span> : null}
          {followsYou ? <span className="text-[11px] bg-gray-100 text-gray-500 rounded-md px-1.5 py-0.5">Follows you</span> : null}
        </div>

        <div className="flex items-center gap-2 mt-2.5 flex-wrap">
          {role ? <span className="inline-flex items-center gap-1 text-xs font-medium bg-brand-light text-brand-purple rounded-full px-2.5 py-1"><BadgeCheck size={13} /> {role}</span> : null}
          {school?.name ? <span className="inline-flex items-center gap-1 text-xs text-gray-600 bg-gray-100 rounded-full px-2.5 py-1 max-w-full"><GraduationCap size={13} className="shrink-0" /> <span className="truncate">{school.name}</span></span> : null}
        </div>

        {person?.bio ? <p className="text-[14.5px] leading-relaxed text-gray-700 mt-3 whitespace-pre-wrap break-words">{person.bio}</p> : null}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-[13px] text-gray-400">
          {person?.location ? <span className="inline-flex items-center gap-1"><MapPin size={14} /> {person.location}</span> : null}
          {firstLink ? (
            <a href={/^https?:\/\//i.test(firstLink) ? firstLink : `https://${firstLink}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-purple max-w-[220px]">
              <Link2 size={14} className="shrink-0" /> <span className="truncate">{firstLink.replace(/^https?:\/\//i, '')}</span>
            </a>
          ) : null}
          {joinedLabel(joined) ? <span className="inline-flex items-center gap-1"><CalendarDays size={14} /> {joinedLabel(joined)}</span> : null}
        </div>

        {showStats ? (
          <div className="flex items-stretch text-center mt-4 border-y border-gray-100 divide-x divide-gray-100">
            <Stat value={stats.posts} label="Posts" />
            <Stat value={stats.followers} label="Followers" onClick={onFollowers} />
            <Stat value={stats.following} label="Following" onClick={onFollowing} />
          </div>
        ) : null}
      </div>
    </div>
  )
  }
