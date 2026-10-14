import type { MetadataRoute } from 'next'
import { locales } from '@/i18n/locales'
import { href, type RouteKey } from '@/i18n/routes'
import { payloadClient } from '@/lib/queries'
import { absolute } from '@/lib/seo'

const pages: RouteKey[] = ['home', 'menu', 'restaurant', 'news', 'reserve', 'imprint', 'privacy']

/** Every public page in every language, with hreflang alternates; published posts included. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const languages = (key: RouteKey, rest?: Record<string, string>) =>
    Object.fromEntries(
      locales.map((l) => [l.code, absolute(href(key, l.code, rest?.[l.code] ?? ''))]),
    )

  const entries: MetadataRoute.Sitemap = pages.flatMap((key) =>
    locales.map((l) => ({
      url: absolute(href(key, l.code)),
      alternates: { languages: languages(key) },
    })),
  )

  const payload = await payloadClient()
  const posts = await Promise.all(
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
