'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type Props = {
  label: string
  items: { href: string; label: string }[]
  scrollLabels: { prev: string; next: string }
}

/**
 * Category chips in one row. Instead of a scrollbar, the row fades out at an edge that has more
 * chips, and a small arrow button scrolls further. Swiping and keyboard focus scroll it too.
 */
export function CategoryNav({ label, items, scrollLabels }: Props) {
  const list = useRef<HTMLUListElement>(null)
  const [more, setMore] = useState({ left: false, right: false })

  const update = useCallback(() => {
    const el = list.current
    if (!el) return
    setMore({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 })
  }, [])

  useEffect(() => {
    const el = list.current
    if (!el) return
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [update])

  const smooth = () => (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth')

  /** Moves the chosen chip to the middle of the row (when the row can scroll at all). */
  const center = (chip: HTMLElement) => {
    const el = list.current
    if (!el || el.scrollWidth <= el.clientWidth) return
    el.scrollTo({ left: chip.offsetLeft - (el.clientWidth - chip.offsetWidth) / 2, behavior: smooth() })
  }

  const scroll = (direction: 1 | -1) => {
    const el = list.current
    if (!el) return
    el.scrollBy({ left: direction * el.clientWidth * 0.7, behavior: smooth() })
  }

  return (
    <nav className="menu-nav" aria-label={label} data-more-left={more.left || undefined} data-more-right={more.right || undefined}>
      <button type="button" className="menu-nav__arrow menu-nav__arrow--left" onClick={() => scroll(-1)} hidden={!more.left} aria-label={scrollLabels.prev}>
        <span aria-hidden="true">‹</span>
      </button>
      <ul ref={list} onScroll={update}>
        {items.map((item) => (
          <li key={item.href}>
            <a href={item.href} onClick={(e) => center(e.currentTarget)}>
              {item.label}
            </a>
          </li>
        ))}
      </ul>
      <button type="button" className="menu-nav__arrow menu-nav__arrow--right" onClick={() => scroll(1)} hidden={!more.right} aria-label={scrollLabels.next}>
        <span aria-hidden="true">›</span>
      </button>
    </nav>
  )
}
