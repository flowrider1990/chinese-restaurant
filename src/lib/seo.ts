import type { Metadata } from 'next'
import { locales, type Locale } from '@/i18n/locales'
import { href, type RouteKey } from '@/i18n/routes'
import { getRestaurantInfo, type RestaurantInfo } from './queries'
import { DAYS } from './opening-hours'

/** Public base URL (no trailing slash). Set NEXT_PUBLIC_SITE_URL per environment. */
export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')

export const absolute = (path: string) => (path === '/' ? siteUrl : `${siteUrl}${path}`)

const ogLocale: Record<Locale, string> = { de: 'de_DE', en: 'en_GB' }

/**
 * Canonical URL plus hreflang alternates for a page. `rest` may differ per language (post slugs).
 */
export function alternates(
  key: RouteKey,
  locale: Locale,
  rest?: Partial<Record<Locale, string>>,
): Metadata['alternates'] {
  const languages = Object.fromEntries(
    locales.map((l) => [l.code, absolute(href(key, l.code, rest?.[l.code] ?? ''))]),
  ) as Record<Locale, string>
  return {
    canonical: languages[locale],
    languages: { ...languages, 'x-default': languages.de },
  }
}

/** Open Graph and Twitter defaults; pages override title, description and image. */
export function socialMetadata(
  info: RestaurantInfo,
  locale: Locale,
  page: { title?: string; description?: string | null; url: string; image?: string | null; type?: 'website' | 'article' },
): Pick<Metadata, 'openGraph' | 'twitter'> {
  // Either the page's own image or the generated default (src/app/(frontend)/[locale]/og-image).
  const images = [
    page.image
      ? { url: page.image }
      : { url: `${locale === 'de' ? '' : `/${locale}`}/og-image`, width: 1200, height: 630, alt: info.name },
  ]
  const title = page.title ?? info.name
  const description = page.description ?? info.seoDescription ?? info.tagline ?? undefined
  return {
    openGraph: {
      type: page.type ?? 'website',
      siteName: info.name,
      locale: ogLocale[locale],
      title,
      description,
      url: page.url,
      images,
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

/** schema.org Restaurant, built from the same object the visible pages use. */
export function restaurantJsonLd(info: RestaurantInfo, locale: Locale) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    '@id': `${siteUrl}/#restaurant`,
    name: info.name,
    ...(info.nameNative && { alternateName: info.nameNative }),
    url: absolute(href('home', locale)),
    telephone: info.phoneE164,
    ...(info.email && { email: info.email }),
    ...(info.tagline && { description: info.tagline }),
    ...(info.cuisine && { servesCuisine: info.cuisine.split(',').map((c) => c.trim()).filter(Boolean) }),
    address: {
      '@type': 'PostalAddress',
      streetAddress: info.address.street,
      postalCode: info.address.postalCode,
      addressLocality: info.address.city,
      addressCountry: info.address.country,
    },
    ...(info.geo && { geo: { '@type': 'GeoCoordinates', latitude: info.geo[1], longitude: info.geo[0] } }),
    hasMenu: absolute(href('menu', locale)),
    ...(info.ogImage?.url && { image: absolute(info.ogImage.url) }),
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

/** Renders JSON-LD safely: "<" is escaped so CMS text cannot close the script tag. */
export function jsonLdScript(data: unknown) {
  return { __html: JSON.stringify(data).replace(/</g, '\\u003c') }
}

/** Full metadata for a public page: title, description, canonical, hreflang and social cards. */
export async function pageMetadata({
  key,
  locale,
  title,
  description,
  rest,
  image,
  type,
}: {
  key: RouteKey
  locale: Locale
  title?: string
  description?: string | null
  rest?: Partial<Record<Locale, string>>
  image?: string | null
  type?: 'website' | 'article'
}): Promise<Metadata> {
  const info = await getRestaurantInfo(locale)
  const alt = alternates(key, locale, rest)
  const desc = description ?? info.seoDescription ?? info.tagline ?? undefined
  return {
    ...(title && { title }),
    description: desc,
    alternates: alt,
    ...socialMetadata(info, locale, {
      title: title ? `${title} · ${info.name}` : info.name,
      description: desc,
      url: alt?.canonical as string,
      image: image ?? (info.ogImage?.sizes?.og?.url || info.ogImage?.url) ?? null,
      type,
    }),
  }
}
