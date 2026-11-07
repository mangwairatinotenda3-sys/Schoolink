// Hides the bottom bar while the person scrolls down, and brings it back when they scroll up
// or stop scrolling. Works on every scrolling list in the app. Sheets and dialogs are ignored.

const lastTops = new WeakMap()
let hidden = false
let timer = null

function setHidden(value) {
  if (value === hidden) return
  hidden = value
  const shell = document.querySelector('.app-shell')
  if (shell) shell.dataset.navHidden = value ? '1' : '0'
}

function show() {
  clearTimeout(timer)
  timer = null
  setHidden(false)
}

export function initNavAutoHide() {
  const onScroll = (event) => {
    const el = event.target
    if (!(el instanceof Element)) return
    if (el.closest('[role="dialog"], [aria-modal="true"]')) return
    if (!el.closest('.app-shell')) return

    const top = el.scrollTop
    const previous = lastTops.get(el) ?? top
    lastTops.set(el, top)
    const dy = top - previous
    if (Math.abs(dy) < 2) return

    if (dy > 0 && top > 60) setHidden(true)
    else if (dy < 0) show()

    // Scrolling has stopped for a moment: bring the bar back
    clearTimeout(timer)
    timer = setTimeout(show, 450)
  }

  document.addEventListener('scroll', onScroll, { capture: true, passive: true })
  window.addEventListener('hashchange', show)
  return () => {
    document.removeEventListener('scroll', onScroll, { capture: true })
    window.removeEventListener('hashchange', show)
    clearTimeout(timer)
  }
    }
