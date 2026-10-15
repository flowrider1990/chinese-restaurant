'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { defaultLocale, locales, type Locale } from '@/i18n/locales'
import { href, routeKeyFor } from '@/i18n/routes'

type Paths = Partial<Record<Locale, string>>

/**
 * Pages whose URL differs per language beyond the path segment (posts have one slug per language)
 * announce their URLs here, so the switch links to the final URL instead of one that redirects.
 */
const AlternatesContext = createContext<{
  paths: Paths | null
  setPaths: (paths: Paths | null) => void
}>({
  paths: null,
  setPaths: () => {},
})

export function LanguageAlternatesProvider({ children }: { children: ReactNode }) {
  const [paths, setPaths] = useState<Paths | null>(null)
  return <AlternatesContext value={{ paths, setPaths }}>{children}</AlternatesContext>
}

/** Rendered by a page: its public path in every language, e.g. { de: '/aktuelles/a', en: '/en/news/b' }. */
export function LanguageAlternates({ paths }: { paths: Paths }) {
  const { setPaths } = useContext(AlternatesContext)
  const value = JSON.stringify(paths)
  useEffect(() => {
    setPaths(JSON.parse(value) as Paths)
    return () => setPaths(null)
  }, [value, setPaths])
  return null
}

/** Links to the same page in the other languages. Unknown pages fall back to that language's home. */
export function LanguageSwitch({ locale, label }: { locale: Locale; label: string }) {
  const pathname = usePathname()
  const { paths } = useContext(AlternatesContext)
  const parts = pathname.split('/').filter(Boolean)
  if (locale !== defaultLocale) parts.shift()
  const [segment = '', ...rest] = parts
  const key = routeKeyFor(segment, locale)
  // Only trust announced paths that belong to the page being shown.
  const alternates = paths && paths[locale] === decodeURIComponent(pathname) ? paths : null

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
                href={
                  alternates?.[l.code] ??
                  (key ? href(key, l.code, rest.join('/')) : href('home', l.code))
                }
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
