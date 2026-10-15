import { describe, expect, it } from 'vitest'
import { mediaOnBlob } from '@/lib/media-storage'
import { absolute, siteUrl } from '@/lib/seo'

describe('mediaOnBlob', () => {
  const token = 'vercel_blob_rw_fake_fake'
  it('uses Blob on Vercel when a token is set', () => {
    expect(mediaOnBlob({ BLOB_READ_WRITE_TOKEN: token, VERCEL: '1' })).toBe(true)
  })
  it('keeps the local filesystem in local dev, even with a token', () => {
    expect(mediaOnBlob({ BLOB_READ_WRITE_TOKEN: token })).toBe(false)
    expect(mediaOnBlob({ BLOB_READ_WRITE_TOKEN: token, MEDIA_ON_BLOB: 'true' })).toBe(false)
  })
  it('uses Blob locally only with the explicit flag', () => {
    expect(mediaOnBlob({ BLOB_READ_WRITE_TOKEN: token, MEDIA_ON_BLOB: '1' })).toBe(true)
  })
  it('never uses Blob without a token', () => {
    expect(mediaOnBlob({ VERCEL: '1', MEDIA_ON_BLOB: '1' })).toBe(false)
    expect(mediaOnBlob({ BLOB_READ_WRITE_TOKEN: '', VERCEL: '1' })).toBe(false)
  })
})

describe('absolute', () => {
  it('prefixes site paths with the site URL', () => {
    expect(absolute('/speisekarte')).toBe(`${siteUrl}/speisekarte`)
    expect(absolute('/')).toBe(siteUrl)
  })
  it('passes absolute media URLs through', () => {
    const blob = 'https://abc123.public.blob.vercel-storage.com/hero-1920x1080.webp'
    expect(absolute(blob)).toBe(blob)
  })
})
