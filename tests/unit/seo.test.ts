import { describe, expect, it, vi } from 'vitest'

// seo.ts reads the CMS through queries.ts; the builders under test only need plain objects.
vi.mock('@/lib/queries', () => ({ getRestaurantInfo: vi.fn() }))

import { dictionaries } from '@/i18n/dictionary'
import { locales } from '@/i18n/locales'
import { routes, type RouteKey } from '@/i18n/routes'
import { getRestaurantInfo, type RestaurantInfo } from '@/lib/queries'
import {
  alternates,
  isPlaceholder,
  menuId,
  newsArticleJsonLd,
  pageMetadata,
  restaurantJsonLd,
  siteUrl,
} from '@/lib/seo'

const info = {
  name: 'Xiao Chu',
  nameNative: '小厨',
  tagline: 'Tagline',
  cuisine: 'Chinesisch, Sichuan',
  seoDescription: 'SEO description',
  ogImage: null,
  phone: '030 1',
  phoneE164: '+49301',
  email: null,
  address: { street: 'Straße 1', postalCode: '10245', city: 'Berlin', country: 'DE' },
  mapsUrl: null,
  geo: [13.45671, 52.50973],
  orderLinks: [],
  socialLinks: [{ platform: 'instagram', url: 'https://instagram.example/xiaochu' }],
  paymentMethods: ['cash', 'creditcard'],
  hours: { timezone: 'Europe/Berlin', weekly: [], exceptions: [] },
} as unknown as RestaurantInfo

describe('restaurantJsonLd', () => {
  it('describes the restaurant with price range, payment, image, links and menu', () => {
    const ld = restaurantJsonLd(info, 'de', { href: '/reservieren', external: false })
    expect(ld.description).toBe('SEO description')
    expect(ld.priceRange).toBe('€€')
    expect(ld.paymentAccepted).toBe('Bargeld, Kreditkarte')
    expect(ld.acceptsReservations).toBe(`${siteUrl}/reservieren`)
    expect(ld.image).toBe(`${siteUrl}/og-image`)
    expect(ld.sameAs).toEqual(['https://instagram.example/xiaochu'])
    expect(ld.geo).toEqual({
      '@type': 'GeoCoordinates',
      latitude: '52.50973',
      longitude: '13.45671',
    })
    expect(ld.hasMenu).toEqual({
      '@type': 'Menu',
      '@id': menuId('de'),
      url: `${siteUrl}/speisekarte`,
    })
    expect(menuId('en')).toBe(`${siteUrl}/en/menu#menu`)
  })

  it('pads coordinates to five decimals without changing them', () => {
    const ld = restaurantJsonLd({ ...info, geo: [13.4567, 52.5097] }, 'de')
    expect(ld.geo).toEqual({
      '@type': 'GeoCoordinates',
      latitude: '52.50970',
      longitude: '13.45670',
    })
  })

  it('states reservations only when they are possible', () => {
    expect(
      restaurantJsonLd(info, 'en', { href: 'https://book.example', external: true })
        .acceptsReservations,
    ).toBe(true)
    expect(restaurantJsonLd(info, 'en', null)).not.toHaveProperty('acceptsReservations')
  })

  it('uses the CMS image and leaves out empty lists', () => {
    const ld = restaurantJsonLd(
      {
        ...info,
        ogImage: { url: '/api/media/file/og.webp' } as RestaurantInfo['ogImage'],
        socialLinks: [],
        paymentMethods: [],
      },
      'en',
    )
    expect(ld.image).toBe(`${siteUrl}/api/media/file/og.webp`)
    expect(ld).not.toHaveProperty('sameAs')
    expect(ld).not.toHaveProperty('paymentAccepted')
  })
})

describe('newsArticleJsonLd', () => {
  it('names the restaurant as author and publisher', () => {
    const ld = newsArticleJsonLd(info, 'en', {
      title: 'Weekend dim sum',
      slug: 'weekend-dim-sum',
      publishedAt: '2026-10-14T15:52:55.027Z',
      updatedAt: '2026-10-14T16:01:50.739Z',
    })
    const restaurant = {
      '@type': 'Organization',
      '@id': `${siteUrl}/#restaurant`,
      name: 'Xiao Chu',
      url: `${siteUrl}/en`,
    }
    expect(ld.author).toEqual(restaurant)
    expect(ld.publisher).toEqual(restaurant)
    expect(ld.mainEntityOfPage).toBe(`${siteUrl}/en/news/weekend-dim-sum`)
    expect(ld).not.toHaveProperty('image')
  })
})

describe('page descriptions', () => {
  const keys = Object.keys(routes) as RouteKey[]

  it.each(locales.map((l) => l.code))(
    'exist for every page in %s, 110 to 160 characters',
    (locale) => {
      const seo = dictionaries[locale].seo
      expect(seo.homeTitle).toBeTruthy()
      for (const key of keys) {
        const text = seo.description[key]('Xiao Chu')
        expect(text, key).toContain('Xiao Chu')
        expect(text.length, `${locale} ${key}: ${text.length}`).toBeGreaterThanOrEqual(110)
        expect(text.length, `${locale} ${key}: ${text.length}`).toBeLessThanOrEqual(160)
      }
    },
  )

  it('are distinct per page', () => {
    for (const { code } of locales) {
      const texts = keys.map((k) => dictionaries[code].seo.description[k]('Xiao Chu'))
      expect(new Set(texts).size).toBe(texts.length)
    }
  })
})

describe('isPlaceholder', () => {
  it('marks only the English legal pages', () => {
    expect(isPlaceholder('imprint', 'en')).toBe(true)
    expect(isPlaceholder('privacy', 'en')).toBe(true)
    expect(isPlaceholder('imprint', 'de')).toBe(false)
    expect(isPlaceholder('menu', 'en')).toBe(false)
  })
})

describe('pageMetadata', () => {
  vi.mocked(getRestaurantInfo).mockResolvedValue(info)

  it('uses an absolute title without the name template', async () => {
    const meta = await pageMetadata({
      key: 'home',
      locale: 'de',
      absoluteTitle: 'Xiao Chu – Restaurant',
    })
    expect(meta.title).toEqual({ absolute: 'Xiao Chu – Restaurant' })
    expect(meta.openGraph?.title).toBe('Xiao Chu – Restaurant')
  })

  it('appends the name to a page title', async () => {
    const meta = await pageMetadata({ key: 'menu', locale: 'en', title: 'Menu' })
    expect(meta.title).toBe('Menu')
    expect(meta.openGraph?.title).toBe('Menu · Xiao Chu')
  })

  it('takes a description function of the restaurant name', async () => {
    const meta = await pageMetadata({
      key: 'menu',
      locale: 'de',
      description: (n) => `Karte von ${n}`,
    })
    expect(meta.description).toBe('Karte von Xiao Chu')
  })

  it('falls back to the CMS description for an empty or missing text', async () => {
    for (const description of ['', null, undefined]) {
      const meta = await pageMetadata({ key: 'news', locale: 'de', description })
      expect(meta.description).toBe('SEO description')
    }
  })
})

describe('alternates', () => {
  it('lists every language plus x-default (German)', () => {
    expect(alternates('menu', 'en')).toEqual({
      canonical: `${siteUrl}/en/menu`,
      languages: {
        de: `${siteUrl}/speisekarte`,
        en: `${siteUrl}/en/menu`,
        'x-default': `${siteUrl}/speisekarte`,
      },
    })
  })

  it('leaves out placeholder languages but keeps the own canonical', () => {
    expect(alternates('imprint', 'de')).toEqual({
      canonical: `${siteUrl}/impressum`,
      languages: { de: `${siteUrl}/impressum`, 'x-default': `${siteUrl}/impressum` },
    })
    expect(alternates('imprint', 'en')?.canonical).toBe(`${siteUrl}/en/imprint`)
  })
})
