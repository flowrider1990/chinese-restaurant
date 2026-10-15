import { describe, expect, it, vi } from 'vitest'

// The page module pulls in the CMS, Stripe and Next request APIs; metadata needs none of them.
vi.mock('@/lib/queries', () => ({
  getRestaurantInfo: vi.fn().mockResolvedValue({
    name: 'Xiao Chu',
    seoDescription: 'SEO description',
    tagline: null,
    ogImage: null,
  }),
  payloadClient: vi.fn(),
}))
vi.mock('@/lib/voucher-fulfilment', () => ({ voucherStatusForSession: vi.fn() }))
vi.mock('@/i18n/server', async () => {
  const { locales } = await import('@/i18n/locales')
  return { isLocale: (v: string) => locales.some((l) => l.code === v), getLocale: vi.fn() }
})
vi.mock('@/app/(frontend)/[locale]/gutscheine/VoucherForm', () => ({ VoucherForm: () => null }))

import { generateMetadata } from '@/app/(frontend)/[locale]/gutscheine/page'

const metadataFor = (searchParams: Record<string, string | string[] | undefined>) =>
  generateMetadata({
    params: Promise.resolve({ locale: 'de' }),
    searchParams: Promise.resolve(searchParams),
  } as Parameters<typeof generateMetadata>[0])

describe('voucher page metadata', () => {
  it('indexes the order form with canonical and alternates', async () => {
    const meta = await metadataFor({})
    expect(meta.robots).toBeUndefined()
    expect(meta.alternates?.canonical).toMatch(/\/gutscheine$/)
  })

  it('treats an empty session_id as the order form', async () => {
    const meta = await metadataFor({ session_id: '' })
    expect(meta.robots).toBeUndefined()
    expect(meta.alternates?.canonical).toMatch(/\/gutscheine$/)
  })

  it('keeps the thank-you state out of the index, without canonical or alternates', async () => {
    const meta = await metadataFor({ session_id: 'cs_test_123' })
    expect(meta.robots).toEqual({ index: false, follow: false })
    expect(meta).not.toHaveProperty('alternates')
    expect(meta.title).toBe('Gutschein verschenken')
  })
})
