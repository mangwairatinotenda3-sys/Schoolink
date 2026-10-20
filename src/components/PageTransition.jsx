import { useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

const TABS = ['/home', '/chats', '/notifications', '/profile', '/saved', '/calendar', '/more']

// Screens slide in like a phone app: new screens come from the right, going back comes from the left,
// and moving between the bottom tabs is a soft fade.
export default function PageTransition({ children }) {
  const { pathname } = useLocation()
  const type = useNavigationType()
  const memo = useRef({ path: pathname, cls: '' })

  if (memo.current.path !== pathname) {
    const bothTabs = TABS.includes(memo.current.path) && TABS.includes(pathname)
    memo.current = { path: pathname, cls: bothTabs ? 'sl-fade' : type === 'POP' ? 'sl-back' : 'sl-forward' }
  }

  return <div key={pathname} className={`sl-page ${memo.current.cls}`}>{children}</div>
}
