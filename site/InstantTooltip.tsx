import { useEffect, useState } from 'react'

interface Tip {
  text: string
  x: number
  y: number
  above: boolean
}

// Hover text that shows at once, in place of the browser's delayed title
// tooltip. Works for any element with a title: on first hover the title
// moves to data-tip (so the native tooltip never appears) and is shown
// here. React only rewrites a title when it changes, so a changed title
// is picked up again on the next hover.
export default function InstantTooltip() {
  const [tip, setTip] = useState<Tip | null>(null)

  useEffect(() => {
    let current: HTMLElement | null = null

    const show = (el: HTMLElement) => {
      const title = el.getAttribute('title')
      if (title !== null) {
        el.removeAttribute('title')
        el.dataset.tip = title
        // Keep an accessible name for icon-only controls.
        if (title && !el.getAttribute('aria-label') && !el.textContent?.trim()) {
          el.setAttribute('aria-label', title)
        }
      }
      const text = el.dataset.tip
      if (!text) return setTip(null)
      const r = el.getBoundingClientRect()
      const above = r.bottom + 40 > window.innerHeight
      const x = Math.min(Math.max(r.left + r.width / 2, 90), window.innerWidth - 90)
      setTip({ text, x, y: above ? r.top - 6 : r.bottom + 6, above })
    }

    const hide = () => {
      current = null
      setTip(null)
    }

    const over = (e: MouseEvent) => {
      const el = (e.target as Element)?.closest?.('[title], [data-tip]') as HTMLElement | null
      if (el === current) return
      current = el
      if (el) show(el)
      else setTip(null)
    }

    const out = (e: MouseEvent) => {
      if (current && !current.contains(e.relatedTarget as Node | null)) hide()
    }

    document.addEventListener('mouseover', over)
    document.addEventListener('mouseout', out)
    document.addEventListener('mousedown', hide)
    window.addEventListener('scroll', hide, true)
    return () => {
      document.removeEventListener('mouseover', over)
      document.removeEventListener('mouseout', out)
      document.removeEventListener('mousedown', hide)
      window.removeEventListener('scroll', hide, true)
    }
  }, [])

  if (!tip) return null
  return (
    <div
      className={'instant-tip' + (tip.above ? ' above' : '')}
      role="tooltip"
      style={{ left: tip.x, top: tip.y }}
    >
      {tip.text}
    </div>
  )
}
