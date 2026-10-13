import { getPayload, type Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'
import config from '@/payload.config'
import { migrations } from '@/migrations'

let payload: Payload
let categoryId: number

beforeAll(async () => {
  payload = await getPayload({ config })
  // Migration files are typed for the CLI runner; the adapter accepts the same objects.
  await payload.db.migrate({ migrations: migrations as never })
  const category = await payload.create({
    collection: 'menu-categories',
    locale: 'de',
    data: { name: 'Nudelgerichte' },
  })
  categoryId = category.id
})

const dish = (overrides: Record<string, unknown> = {}) =>
  payload.create({
    collection: 'menu-items',
    locale: 'de',
    data: { name: 'Testgericht', price: 1290, category: categoryId, ...overrides } as never,
  })

describe('menu items', () => {
  it('hides unpublished items from the public but not from editors', async () => {
    const hidden = await dish({ name: 'Versteckt', published: false })
    const visible = await dish({ name: 'Sichtbar', published: true })

    const pub = await payload.find({ collection: 'menu-items', overrideAccess: false })
    const ids = pub.docs.map((d) => d.id)
    expect(ids).toContain(visible.id)
    expect(ids).not.toContain(hidden.id)

    const all = await payload.find({ collection: 'menu-items' })
    expect(all.docs.map((d) => d.id)).toContain(hidden.id)
  })

  it('rejects writes from anonymous users', async () => {
    await expect(
      payload.create({
        collection: 'menu-items',
        overrideAccess: false,
        data: { name: 'Hack', price: 1, category: categoryId } as never,
      }),
    ).rejects.toThrow(/keine Berechtigung/)
  })

  it('validates prices as non-negative integer cents', async () => {
    await expect(dish({ price: 12.9 })).rejects.toThrow(/Preis/)
    await expect(dish({ price: -100 })).rejects.toThrow(/Preis/)
    const ok = await dish({
      options: [{ label: 'Tofu', priceDelta: -100 }, { label: 'Rind', priceDelta: 200 }],
    })
    expect(ok.options?.map((o) => o.priceDelta)).toEqual([-100, 200])
  })

  it('falls back to German when no English value exists', async () => {
    const d = await dish({ name: 'Nur Deutsch' })
    const en = await payload.findByID({ collection: 'menu-items', id: d.id, locale: 'en' })
    expect(en.name).toBe('Nur Deutsch')
  })
})

describe('slugs', () => {
  it('generates a slug per locale and enforces uniqueness within a locale', async () => {
    const c = await payload.create({
      collection: 'menu-categories',
      locale: 'de',
      data: { name: 'Süße Speisen' },
    })
    expect(c.slug).toBe('suesse-speisen')

    const en = await payload.update({
      collection: 'menu-categories',
      id: c.id,
      locale: 'en',
      data: { name: 'Desserts' },
    })
    expect(en.slug).toBe('desserts')

    await expect(
      payload.create({ collection: 'menu-categories', locale: 'de', data: { name: 'Süße Speisen' } }),
    ).rejects.toThrow(/slug/i)
  })
})

describe('posts', () => {
  it('hides drafts from the public and sets publishedAt on publish', async () => {
    const draft = await payload.create({
      collection: 'posts',
      locale: 'de',
      data: { title: 'Entwurf', _status: 'draft' },
      draft: true,
    })
    const published = await payload.create({
      collection: 'posts',
      locale: 'de',
      data: { title: 'Veröffentlicht', _status: 'published' },
    })
    expect(published.publishedAt).toBeTruthy()
    expect(published.slug).toBe('veroeffentlicht')

    const pub = await payload.find({ collection: 'posts', overrideAccess: false })
    const ids = pub.docs.map((d) => d.id)
    expect(ids).toContain(published.id)
    expect(ids).not.toContain(draft.id)
  })
})

describe('globals', () => {
  it('rejects malformed opening times', async () => {
    await expect(
      payload.updateGlobal({
        slug: 'opening-hours',
        data: { weekly: [{ day: 'mon', slots: [{ open: '9:00', close: '14:00' }] }] },
      }),
    ).rejects.toThrow(/Öffnet/)
  })

  it('rejects non-https order links and non-E.164 phone numbers', async () => {
    const base = {
      name: 'Test',
      phone: '030 1',
      address: { street: 'A 1', postalCode: '10115', city: 'Berlin', country: 'DE' },
    }
    await expect(
      payload.updateGlobal({ slug: 'site-settings', data: { ...base, phoneE164: '030123' } }),
    ).rejects.toThrow(/Telefon international/)
    await expect(
      payload.updateGlobal({
        slug: 'site-settings',
        data: {
          ...base,
          phoneE164: '+49301234567',
          orderLinks: [{ label: 'Bestellen', url: 'http://insecure.example' }],
        },
      }),
    ).rejects.toThrow(/URL/)
  })

  it('does not let anonymous users update globals', async () => {
    await expect(
      payload.updateGlobal({ slug: 'legal', overrideAccess: false, data: {} }),
    ).rejects.toThrow(/keine Berechtigung/)
  })
})
