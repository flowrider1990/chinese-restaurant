import { getPayload } from 'payload'
import { cache } from 'react'
import config from '@/payload.config'
import type { Locale } from '@/i18n/locales'
import type { Attribute, Media, MenuItem } from '@/payload-types'
import type { Hours } from './opening-hours'

export const payloadClient = cache(() => getPayload({ config }))

/**
 * The restaurant's name, contact details and opening hours. Every place that shows them (header,
 * footer, mobile bar, pages, metadata, JSON-LD) reads them from here, so they come from exactly one
 * CMS source.
 */
export const getRestaurantInfo = cache(async (locale: Locale) => {
  const payload = await payloadClient()
  const [settings, hours] = await Promise.all([
    payload.findGlobal({ slug: 'site-settings', locale, depth: 0 }),
    payload.findGlobal({ slug: 'opening-hours', locale, depth: 0 }),
  ])
  return {
    name: settings.name,
    nameNative: settings.nameNative ?? null,
    tagline: settings.tagline ?? null,
    phone: settings.phone,
    phoneE164: settings.phoneE164,
    email: settings.email ?? null,
    address: settings.address,
    mapsUrl: settings.mapsUrl ?? null,
    /** [longitude, latitude] */
    geo: settings.geo ?? null,
    orderLinks: (settings.orderLinks ?? []).map((l) => ({
      provider: l.provider,
      label: l.label,
      url: l.url || null,
    })),
    socialLinks: (settings.socialLinks ?? []).map((l) => ({ platform: l.platform, url: l.url })),
    paymentMethods: settings.paymentMethods ?? [],
    hours: {
      timezone: hours.timezone,
      weekly: hours.weekly?.map((w) => ({ day: w.day, slots: w.slots.map(({ open, close }) => ({ open, close })) })),
      exceptions: hours.exceptions?.map((e) => ({
        from: e.from,
        to: e.to,
        closed: e.closed,
        note: e.note,
        slots: e.slots?.map(({ open, close }) => ({ open, close })),
      })),
    } satisfies Hours,
  }
})

export type RestaurantInfo = Awaited<ReturnType<typeof getRestaurantInfo>>

// --- Public content. Every query runs with overrideAccess: false, so the collection access rules
// (published dishes only, published posts only) apply exactly as for an anonymous visitor.

const publicRead = { overrideAccess: false } as const

export const getMenu = cache(async (locale: Locale) => {
  const payload = await payloadClient()
  const [categories, items] = await Promise.all([
    payload.find({ collection: 'menu-categories', locale, sort: '_order', pagination: false, depth: 0, ...publicRead }),
    payload.find({
      collection: 'menu-items',
      locale,
      where: { published: { equals: true } },
      sort: '_order',
      pagination: false,
      depth: 1,
      ...publicRead,
    }),
  ])
  const sections = categories.docs
    .map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug ?? String(c.id),
      description: c.description ?? null,
      items: items.docs.filter((i) => (typeof i.category === 'object' ? i.category.id : i.category) === c.id),
    }))
    .filter((s) => s.items.length > 0)
  // Legend: only the allergens and additives that actually appear on the menu.
  const used = new Map<number, Attribute>()
  for (const item of items.docs)
    for (const a of item.attributes ?? [])
      if (typeof a === 'object' && (a.kind === 'allergen' || a.kind === 'additive')) used.set(a.id, a)
  const legend = [...used.values()].sort((a, b) => (a._order ?? '').localeCompare(b._order ?? ''))
  return { sections, legend }
})

export const getHome = cache(async (locale: Locale) => {
  const payload = await payloadClient()
  const home = await payload.findGlobal({ slug: 'home', locale, depth: 2, ...publicRead })
  const manual = (home.highlights ?? []).filter(
    (h): h is MenuItem => typeof h === 'object' && h.published === true,
  )
  const highlights = manual.length
    ? manual
    : (
        await payload.find({
          collection: 'menu-items',
          locale,
          where: { and: [{ published: { equals: true } }, { featured: { equals: true } }] },
          sort: '_order',
          limit: 6,
          depth: 1,
          ...publicRead,
        })
      ).docs
  const slides = (home.heroSlides ?? []).filter((s): s is typeof s & { image: Media } => typeof s.image === 'object')
  return { intro: home.intro ?? null, slides, highlights }
})

export const getPosts = cache(async (locale: Locale, page = 1, limit = 12) => {
  const payload = await payloadClient()
  return payload.find({
    collection: 'posts',
    locale,
    sort: '-publishedAt',
    page,
    limit,
    depth: 1,
    draft: false,
    ...publicRead,
  })
})

export const getPost = cache(async (locale: Locale, slug: string) => {
  const payload = await payloadClient()
  const res = await payload.find({
    collection: 'posts',
    locale,
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 2,
    draft: false,
    ...publicRead,
  })
  return res.docs[0] ?? null
})

export const getAbout = cache(async (locale: Locale) => {
  const payload = await payloadClient()
  return payload.findGlobal({ slug: 'about', locale, depth: 1, ...publicRead })
})

export const getLegal = cache(async (locale: Locale) => {
  const payload = await payloadClient()
  return payload.findGlobal({ slug: 'legal', locale, depth: 1, ...publicRead })
})
