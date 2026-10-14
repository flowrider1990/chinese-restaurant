'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/** Desktop navigation; marks the current page. */
export function NavLinks({ items, label }: { items: { href: string; label: string }[]; label: string }) {
  const pathname = usePathname()
  return (
    <nav className="site-nav" aria-label={label}>
      <ul>
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={pathname === item.href || pathname.startsWith(item.href + '/') ? 'page' : undefined}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
