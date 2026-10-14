'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useId, useState } from 'react'
import { Icon } from './Icon'

type Item = { href: string; label: string }

/** Disclosure menu for small screens. Closes on navigation and on Escape. */
export function MobileNav({ items, openLabel, closeLabel }: { items: Item[]; openLabel: string; closeLabel: string }) {
  const pathname = usePathname()
  // Remember the page the menu was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null)
  const open = openOn === pathname
  const setOpen = (value: boolean) => setOpenOn(value ? pathname : null)
  const id = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpenOn(null)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className="mobile-nav">
      <button
        type="button"
        className="icon-btn"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <Icon name={open ? 'close' : 'menu'} size={24} />
        <span className="visually-hidden">{open ? closeLabel : openLabel}</span>
      </button>
      <ul id={id} className="mobile-nav__list" hidden={!open}>
        {items.map((item) => (
          <li key={item.href}>
            <Link href={item.href} aria-current={pathname === item.href ? 'page' : undefined}>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
