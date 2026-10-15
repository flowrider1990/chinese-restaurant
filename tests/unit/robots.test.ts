import { afterEach, describe, expect, it, vi } from 'vitest'
import robots from '@/app/robots'

afterEach(() => vi.unstubAllEnvs())

describe('robots.txt', () => {
  it('offers the sitemap normally', () => {
    vi.stubEnv('SITE_NOINDEX', '')
    expect(robots().sitemap).toMatch(/\/sitemap\.xml$/)
  })
  it('offers no sitemap on a noindex demo deployment', () => {
    vi.stubEnv('SITE_NOINDEX', '1')
    const r = robots()
    expect(r.sitemap).toBeUndefined()
    expect(r.rules).toMatchObject({ allow: '/' })
  })
})
