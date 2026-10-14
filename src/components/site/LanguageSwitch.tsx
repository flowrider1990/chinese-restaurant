'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { defaultLocale, locales, type Locale } from '@/i18n/locales'
import { href, routeKeyFor } from '@/i18n/routes'

/** Links to the same page in the other languages. Unknown pages fall back to that language's home. */
export function LanguageSwitch({ locale, label }: { locale: Locale; label: string }) {
  const pathname = usePathname()
  const parts = pathname.split('/').filter(Boolean)
  if (locale !== defaultLocale) parts.shift()
  const [segment = '', ...rest] = parts
  const key = routeKeyFor(segment, locale)

  return (
    <nav className="lang-switch" aria-label={label}>
      <ul>
        {locales.map((l) => (
          <li key={l.code}>
            {l.code === locale ? (
              <span aria-current="true" lang={l.code} title={l.label}>
                {l.code.toUpperCase()}
              </span>
            ) : (
              <Link
                href={key ? href(key, l.code, rest.join('/')) : href('home', l.code)}
                hrefLang={l.code}
                lang={l.code}
                title={l.label}
              >
                {l.code.toUpperCase()}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  )
}
