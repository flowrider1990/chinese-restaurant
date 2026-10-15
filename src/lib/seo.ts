import type { Metadata } from 'next'
import { dictionaries } from '@/i18n/dictionary'
import { locales, type Locale } from '@/i18n/locales'
import { href, type RouteKey } from '@/i18n/routes'
import { getRestaurantInfo, type RestaurantInfo } from './queries'
import { DAYS } from './opening-hours'

/**
 * Public base URL (no trailing slash). Set NEXT_PUBLIC_SITE_URL per environment (inlined at build
 * time). On Vercel without it, the project's production domain is used. Server-only.
 */
export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000')
).replace(/\/$/, '')

/** Site path → absolute URL. Already absolute URLs (media on Vercel Blob) pass through unchanged. */
export const absolute = (path: string) =>
  /^https?:\/\//.test(path) ? path : path === '/' ? siteUrl : `${siteUrl}${path}`

const ogLocale: Record<Locale, string> = { de: 'de_DE', en: 'en_GB' }

/** The generated default social image (src/app/(frontend)/[locale]/og-image). */
export const defaultOgImagePath = (locale: Locale) =>
  `${locale === 'de' ? '' : `/${locale}`}/og-image`

/**
 * Pages whose text in a language is still a placeholder: noindex, and left out of the sitemap.
 * Remove an entry as soon as the real text exists.
 */
const placeholderPages: Partial<Record<RouteKey, Locale[]>> = { imprint: ['en'], privacy: ['en'] }
export const isPlaceholder = (key: RouteKey, locale: Locale) =>
  placeholderPages[key]?.includes(locale) ?? false

/** JSON-LD node ids, so the restaurant, its menu and articles can point at each other. */
export const restaurantId = `${siteUrl}/#restaurant`
export const menuId = (locale: Locale) => `${absolute(href('menu', locale))}#menu`

/**
 * hreflang URLs of a page in every language, plus x-default (German). Placeholder languages are
 * left out, so no page points search engines at a noindex version. `rest` may differ per language
 * (post slugs).
 */
export function languageUrls(
  key: RouteKey,
  rest?: Partial<Record<Locale, string>>,
): Partial<Record<Locale | 'x-default', string>> {
  const url = (l: Locale) => absolute(href(key, l, rest?.[l] ?? ''))
  return {
    ...Object.fromEntries(
      locales.filter((l) => !isPlaceholder(key, l.code)).map((l) => [l.code, url(l.code)]),
    ),
    'x-default': url('de'),
  }
}

/** Canonical URL plus hreflang alternates for a page. */
export function alternates(
  key: RouteKey,
  locale: Locale,
  rest?: Partial<Record<Locale, string>>,
): Metadata['alternates'] {
  return {
    canonical: absolute(href(key, locale, rest?.[locale] ?? '')),
    languages: languageUrls(key, rest),
  }
}

/** Open Graph and Twitter defaults; pages override title, description and image. */
export function socialMetadata(
  info: RestaurantInfo,
  locale: Locale,
  page: {
    title?: string
    description?: string | null
    url: string
    image?: string | null
    type?: 'website' | 'article'
    /** ISO date, articles only (Open Graph "article:published_time"). */
    publishedTime?: string | null
  },
): Pick<Metadata, 'openGraph' | 'twitter'> {
  // Either the page's own image or the generated default.
  const images = [
    page.image
      ? { url: page.image }
      : { url: defaultOgImagePath(locale), width: 1200, height: 630, alt: info.name },
  ]
  const title = page.title ?? info.name
  const description = page.description ?? info.seoDescription ?? info.tagline ?? undefined
  return {
    openGraph: {
      siteName: info.name,
      locale: ogLocale[locale],
      title,
      description,
      url: page.url,
      images,
      ...(page.type === 'article'
        ? {
            type: 'article' as const,
            ...(page.publishedTime && { publishedTime: page.publishedTime }),
          }
        : { type: 'website' as const }),
    },
    twitter: { card: 'summary_large_image', title, description, images },
  }
}

const schemaDay: Record<(typeof DAYS)[number], string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
}

/** Where "Book a table" points: our page, an external provider, or nowhere (see getReservationLink). */
export type ReservationLink = { href: string; external: boolean } | null

/** Price level for search engines: main dishes cost roughly 10 to 20 euros. */
const PRICE_RANGE = '€€'

/** schema.org Restaurant, built from the same object the visible pages use. */
export function restaurantJsonLd(
  info: RestaurantInfo,
  locale: Locale,
  reserve: ReservationLink = null,
) {
  const t = dictionaries[locale]
  const description = info.seoDescription ?? info.tagline
  const image = absolute(info.ogImage?.url || defaultOgImagePath(locale))
  const sameAs = info.socialLinks.map((l) => l.url).filter(Boolean)
  return {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    '@id': restaurantId,
    name: info.name,
    ...(info.nameNative && { alternateName: info.nameNative }),
    url: absolute(href('home', locale)),
    telephone: info.phoneE164,
    ...(info.email && { email: info.email }),
    ...(description && { description }),
    ...(info.cuisine && {
      servesCuisine: info.cuisine
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
    }),
    priceRange: PRICE_RANGE,
    ...(info.paymentMethods.length > 0 && {
      paymentAccepted: info.paymentMethods.map((m) => t.paymentMethods[m]).join(', '),
    }),
    // Our own form: its URL. External provider: bookable, just not here. Off: not stated.
    ...(reserve && { acceptsReservations: reserve.external ? true : absolute(reserve.href) }),
    address: {
      '@type': 'PostalAddress',
      streetAddress: info.address.street,
      postalCode: info.address.postalCode,
      addressLocality: info.address.city,
      addressCountry: info.address.country,
    },
    // Five decimals (about 1 m), as text: a number would drop trailing zeros (52.5097 → "52.50970").
    // schema.org accepts Number or Text here. Padding only; the CMS value is not changed.
    ...(info.geo && {
      geo: {
        '@type': 'GeoCoordinates',
        latitude: info.geo[1].toFixed(5),
        longitude: info.geo[0].toFixed(5),
      },
    }),
    hasMenu: { '@type': 'Menu', '@id': menuId(locale), url: absolute(href('menu', locale)) },
    image,
    ...(sameAs.length > 0 && { sameAs }),
    openingHoursSpecification: (info.hours.weekly ?? []).flatMap((w) =>
      w.slots.map((s) => ({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: `https://schema.org/${schemaDay[w.day]}`,
        opens: s.open,
        closes: s.close,
      })),
    ),
  }
}

/** schema.org NewsArticle for a post; the restaurant is its author and publisher. */
export function newsArticleJsonLd(
  info: Pick<RestaurantInfo, 'name'>,
  locale: Locale,
  post: {
    title: string
    slug: string
    excerpt?: string | null
    publishedAt?: string | null
    updatedAt: string
    imageUrl?: string | null
  },
) {
  const restaurant = {
    '@type': 'Organization',
    '@id': restaurantId,
    name: info.name,
    url: absolute(href('home', locale)),
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: post.title,
    ...(post.excerpt && { description: post.excerpt }),
    ...(post.publishedAt && { datePublished: post.publishedAt }),
    dateModified: post.updatedAt,
    ...(post.imageUrl && { image: absolute(post.imageUrl) }),
    inLanguage: locale,
    mainEntityOfPage: absolute(href('news', locale, post.slug)),
    author: restaurant,
    publisher: restaurant,
  }
}

/** Renders JSON-LD safely: "<" is escaped so CMS text cannot close the script tag. */
export function jsonLdScript(data: unknown) {
  return { __html: JSON.stringify(data).replace(/</g, '\\u003c') }
}

/** Full metadata for a public page: title, description, canonical, hreflang and social cards. */
export async function pageMetadata({
  key,
  locale,
  title,
  absoluteTitle,
  description,
  rest,
  image,
  type,
  publishedTime,
}: {
  key: RouteKey
  locale: Locale
  /** Shown as "<title> · <restaurant name>". */
  title?: string
  /** The complete title, without the restaurant name appended. */
  absoluteTitle?: string
  /** Text, or a function of the restaurant name (the per-page texts in the dictionary). */
  description?: string | null | ((name: string) => string)
  rest?: Partial<Record<Locale, string>>
  image?: string | null
  type?: 'website' | 'article'
  publishedTime?: string | null
}): Promise<Metadata> {
  const info = await getRestaurantInfo(locale)
  const alt = alternates(key, locale, rest)
  const given = typeof description === 'function' ? description(info.name) : description
  const desc = given || info.seoDescription || info.tagline || undefined
  return {
    ...(absoluteTitle ? { title: { absolute: absoluteTitle } } : title && { title }),
    description: desc,
    alternates: alt,
    ...socialMetadata(info, locale, {
      title: absoluteTitle ?? (title ? `${title} · ${info.name}` : info.name),
      description: desc,
      url: alt?.canonical as string,
      image: image ?? (info.ogImage?.sizes?.og?.url || info.ogImage?.url) ?? null,
      type,
      publishedTime,
    }),
  }
}
