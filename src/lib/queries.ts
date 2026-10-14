import { getPayload } from 'payload'
import { cache } from 'react'
import config from '@/payload.config'
import type { Locale } from '@/i18n/locales'
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
    orderLinks: (settings.orderLinks ?? []).map((l) => ({
      provider: l.provider,
      label: l.label,
      url: l.url || null,
    })),
    socialLinks: (settings.socialLinks ?? []).map((l) => ({ platform: l.platform, url: l.url })),
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
