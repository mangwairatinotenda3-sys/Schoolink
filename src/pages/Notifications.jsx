import BackHeader from '../components/BackHeader.jsx'
import BottomNav from '../components/BottomNav.jsx'

export default function Notifications() {
  return (
    <div className="flex-1 flex flex-col">
      <BackHeader title="Notifications" />
      <div className="screen-scroll px-4 flex items-center justify-center text-gray-400">
        No notifications yet.
      </div>
      <BottomNav />
    </div>
  )
}
