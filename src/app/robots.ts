import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/seo'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      // Images live on Vercel Blob in production; locally (and as a fallback) they are served from
      // /api/media/file/, which must stay crawlable for og:image and JSON-LD.
      allow: ['/', '/api/media/file/'],
      disallow: ['/admin', '/api'],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
