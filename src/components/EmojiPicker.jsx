import { useMemo, useState } from 'react'

const RECENT_KEY = 'schoolink.recentEmoji'

export const EMOJI_GROUPS = [
  { id: 'smileys', icon: '😀', name: 'Smileys', emoji: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😋', '😛', '😜', '🤪', '😝', '🤗', '🤭', '🤫', '🤔', '🤐', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😴', '🤤', '😪', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕', '😟', '🙁', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '💩', '🤡', '👻', '👽', '🤖'] },
  { id: 'hands', icon: '👍', name: 'Hands and people', emoji: ['👍', '👎', '👊', '✊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✌️', '🤞', '🤟', '🤘', '👌', '🤌', '🤏', '👈', '👉', '👆', '👇', '☝️', '✋', '🤚', '🖐️', '🖖', '👋', '🤙', '💪', '👀', '🧠', '👶', '👧', '👦', '👩', '👨', '🧑', '👵', '👴', '🙋', '🙆', '🙅', '🤷', '🤦', '🙇', '💁', '🧏', '🤳'] },
  { id: 'hearts', icon: '❤️', name: 'Hearts and symbols', emoji: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💯', '💢', '💥', '💫', '💦', '💨', '✨', '🔥', '⭐', '🌟', '✅', '❌', '❓', '❗', '💬', '🎉', '🎊', '🎈', '🏆', '🥇', '🎯', '🎁', '🔔', '📌', '📍', '🆗', '🆒', '🔴', '🟢'] },
  { id: 'animals', icon: '🐶', name: 'Animals and nature', emoji: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🦆', '🦅', '🦉', '🦋', '🐛', '🐝', '🐞', '🐢', '🐍', '🦖', '🐙', '🐬', '🐳', '🦈', '🐘', '🦒', '🌵', '🌳', '🌸', '🌹', '🌻', '🌈', '☀️', '🌙', '⭐', '🌊'] },
  { id: 'food', icon: '🍎', name: 'Food and drink', emoji: ['🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🥑', '🌽', '🥕', '🌶️', '🍔', '🍟', '🍕', '🌭', '🥪', '🌮', '🌯', '🍣', '🍜', '🍝', '🍦', '🎂', '🍰', '🍩', '🍪', '🍫', '🍿', '☕', '🍵', '🥤', '🍺', '🍷'] },
  { id: 'travel', icon: '🚗', name: 'Travel and places', emoji: ['🚗', '🚕', '🚌', '🚓', '🚑', '🚲', '🛵', '✈️', '🚀', '🛸', '🚢', '🏠', '🏫', '🏥', '🏦', '🌍', '🌎', '🌏', '🗺️', '🌋', '🏔️', '⛰️', '🌅', '🌄', '🌃', '⛅', '🌧️', '⛈️', '❄️', '🌪️'] },
  { id: 'activities', icon: '⚽', name: 'Activities and objects', emoji: ['⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🎱', '🏓', '🥊', '🎮', '🎲', '🎸', '🎹', '🎺', '🎻', '🥁', '🎤', '🎧', '📚', '📖', '✏️', '📝', '💻', '📱', '📷', '🎥', '📺', '⏰', '💡', '🔑', '🧪', '🔬', '💰', '💎', '🛠️'] },
]

function readRecent() {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
    return Array.isArray(list) ? list.filter((x) => typeof x === 'string').slice(0, 24) : []
  } catch {
    return []
  }
}

function rememberRecent(emoji) {
  try {
    const next = [emoji, ...readRecent().filter((x) => x !== emoji)].slice(0, 24)
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    // Private browsing or blocked storage: recents just aren't kept
  }
}

// A row of emoji groups you can scroll through, with the ones you used recently first.
export default function EmojiPicker({ onPick, height = 260, selected = null }) {
  const [groupId, setGroupId] = useState('smileys')
  const [recent] = useState(readRecent)

  const groups = useMemo(() => (
    recent.length ? [{ id: 'recent', icon: '🕘', name: 'Recently used', emoji: recent }, ...EMOJI_GROUPS] : EMOJI_GROUPS
  ), [recent])

  const current = groups.find((g) => g.id === groupId) || groups[0]

  function pick(e) {
    rememberRecent(e)
    onPick(e)
  }

  return (
    <div className="flex flex-col" style={{ height }}>
      <div className="flex gap-1 overflow-x-auto px-2 pt-2 pb-2 border-b border-gray-100" style={{ scrollbarWidth: 'none' }}>
        {groups.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setGroupId(g.id)}
            aria-label={g.name}
            aria-pressed={g.id === current.id}
            className={`shrink-0 w-10 h-9 rounded-lg text-lg flex items-center justify-center ${g.id === current.id ? 'bg-brand-light' : ''}`}
          >
            {g.icon}
          </button>
        ))}
      </div>
      <p className="px-3 pt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{current.name}</p>
      <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2 grid grid-cols-8 gap-0.5">
        {current.emoji.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => pick(e)}
            aria-label={e}
            className={`h-10 rounded-lg text-[24px] flex items-center justify-center active:bg-gray-100 ${selected === e ? 'bg-brand-light ring-2 ring-brand-purple' : ''}`}
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  )
}
