import { defaultLocale, type Locale } from './locales'

/**
 * Public pages and their localized path segments. Folders under app/(frontend)/[locale] use the
 * German segment; the proxy rewrites the other languages' segments onto them.
 */
export const routes = {
  home: { de: '', en: '' },
  menu: { de: 'speisekarte', en: 'menu' },
  restaurant: { de: 'restaurant', en: 'restaurant' },
  news: { de: 'aktuelles', en: 'news' },
  reserve: { de: 'reservieren', en: 'reserve' },
  imprint: { de: 'impressum', en: 'imprint' },
  privacy: { de: 'datenschutz', en: 'privacy' },
} as const satisfies Record<string, Record<Locale, string>>

export type RouteKey = keyof typeof routes

/** Public URL path, e.g. href('menu', 'en') → "/en/menu", href('menu', 'de') → "/speisekarte". */
export function href(key: RouteKey, locale: Locale, rest = ''): string {
  const prefix = locale === defaultLocale ? '' : `/${locale}`
  const segment = routes[key][locale]
  const path = [prefix, segment, rest].filter(Boolean).join('/')
  return path.startsWith('/') ? path || '/' : `/${path}`
}

/** Maps a public path's first segment to its route key, or null if it is not a known page. */
export function routeKeyFor(segment: string, locale: Locale): RouteKey | null {
  const entry = Object.entries(routes).find(([, s]) => s[locale] === segment)
  return entry ? (entry[0] as RouteKey) : null
}
