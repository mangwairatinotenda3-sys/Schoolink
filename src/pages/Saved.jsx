import { Bookmark } from 'lucide-react'
import { useState } from 'react'
import BackHeader from '../components/BackHeader.jsx'
import BottomNav from '../components/BottomNav.jsx'

const tabs = ['Posts', 'Articles', 'Events', 'Files']

const savedPosts = [
  {
    author: 'Science Department',
    time: 'Yesterday',
    text: 'Photos from the Science exhibition held last Friday.',
  },
  {
    author: 'Ms. R. Moyo',
    time: '3d',
    text: 'Important notice for all Form 3 students about Term Exam.',
  },
  {
    author: 'Sports Coach',
    time: '5d',
    text: 'Inter-house football results and upcoming matches.',
  },
  {
    author: 'Schoolink Admin',
    time: '1w',
    text: 'How to stay safe online as a student.',
  },
]

export default function Saved() {
  const [tab, setTab] = useState('Posts')

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader title="Saved" />
      <div className="flex px-4 gap-6 border-b border-gray-100">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`py-2 text-sm font-medium border-b-2 ${
              tab === t ? 'border-brand-purple text-brand-purple' : 'border-transparent text-gray-400'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="screen-scroll px-4 divide-y divide-gray-100">
        {tab === 'Posts' ? (
          savedPosts.map((p) => (
            <div key={p.author} className="py-4 flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-sm">
                  {p.author} <span className="text-gray-400 font-normal">· {p.time}</span>
                </p>
                <p className="text-sm text-gray-600 mt-1">{p.text}</p>
              </div>
              <Bookmark size={18} className="text-brand-purple shrink-0 mt-1" fill="currentColor" />
            </div>
          ))
        ) : (
          <p className="text-center text-gray-400 mt-10">No saved {tab.toLowerCase()} yet.</p>
        )}
      </div>

      <BottomNav />
    </div>
  )
    }
