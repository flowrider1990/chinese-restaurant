import type { MetadataRoute } from 'next'
import { locales } from '@/i18n/locales'
import { href, type RouteKey } from '@/i18n/routes'
import { payloadClient } from '@/lib/queries'
import { absolute, isPlaceholder } from '@/lib/seo'

const pages: RouteKey[] = [
  'home',
  'menu',
  'restaurant',
  'news',
  'reserve',
  'vouchers',
  'imprint',
  'privacy',
]

/** The latest of some ISO dates (missing ones are skipped). */
const latest = (...dates: (string | null | undefined)[]) =>
  dates
    .filter((d): d is string => Boolean(d))
    .sort()
    .at(-1)

/**
 * Every public page in every language, with hreflang alternates (x-default: German); published
 * posts included. lastModified comes from the CMS content shown on the page; pages without such
 * content (reservation, vouchers) have none.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const languages = (key: RouteKey, rest?: Record<string, string>) => {
    const urls = Object.fromEntries(
      locales.map((l) => [l.code, absolute(href(key, l.code, rest?.[l.code] ?? ''))]),
    )
    return { ...urls, 'x-default': urls.de }
  }

  const payload = await payloadClient()
  const newest = (collection: 'menu-items' | 'menu-categories') =>
    payload
      .find({ collection, sort: '-updatedAt', limit: 1, depth: 0, select: { updatedAt: true } })
      .then((r) => r.docs[0]?.updatedAt)
  const [home, about, legal, items, categories, posts] = await Promise.all([
    payload.findGlobal({ slug: 'home', depth: 0 }),
    payload.findGlobal({ slug: 'about', depth: 0 }),
    payload.findGlobal({ slug: 'legal', depth: 0 }),
    newest('menu-items'),
    newest('menu-categories'),
    Promise.all(
      locales.map((l) =>
        payload.find({
          collection: 'posts',
          locale: l.code,
          pagination: false,
          depth: 0,
          draft: false,
          overrideAccess: false,
          select: { slug: true, updatedAt: true },
        }),
      ),
    ),
  ])

  const modified: Partial<Record<RouteKey, string | undefined>> = {
    home: home.updatedAt ?? undefined,
    menu: latest(items, categories),
    restaurant: about.updatedAt ?? undefined,
    news: latest(...posts[0].docs.map((d) => d.updatedAt)),
    imprint: legal.updatedAt ?? undefined,
    privacy: legal.updatedAt ?? undefined,
  }

  const entries: MetadataRoute.Sitemap = pages.flatMap((key) =>
    locales
      .filter((l) => !isPlaceholder(key, l.code))
      .map((l) => ({
        url: absolute(href(key, l.code)),
        ...(modified[key] && { lastModified: modified[key] }),
        alternates: { languages: languages(key) },
      })),
  )

  for (const doc of posts[0].docs) {
    const slugs = Object.fromEntries(
      locales.map((l, i) => [
        l.code,
        posts[i].docs.find((d) => d.id === doc.id)?.slug ?? doc.slug ?? '',
      ]),
    )
    for (const l of locales) {
      entries.push({
        url: absolute(href('news', l.code, slugs[l.code])),
        lastModified: doc.updatedAt,
        alternates: { languages: languages('news', slugs) },
      })
    }
  }
  return entries
}
