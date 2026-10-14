'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/** Desktop navigation; marks the current page. */
export function NavLinks({
  items,
  label,
  externalLabel,
}: {
  items: { href: string; label: string; external?: boolean }[]
  label: string
  externalLabel: string
}) {
  const pathname = usePathname()
  return (
    <nav className="site-nav" aria-label={label}>
      <ul>
        {items.map((item) => (
          <li key={item.href}>
            {item.external ? (
              <a href={item.href} target="_blank" rel="noopener noreferrer">
                {item.label}
                <span className="visually-hidden"> {externalLabel}</span>
              </a>
            ) : (
              <Link
                href={item.href}
                aria-current={
                  pathname === item.href || pathname.startsWith(item.href + '/')
                    ? 'page'
                    : undefined
                }
              >
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  )
}
