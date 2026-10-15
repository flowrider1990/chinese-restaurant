import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/seo'

export default function robots(): MetadataRoute.Robots {
  // Demo deployments (SITE_NOINDEX=1) are kept out of search engines via the X-Robots-Tag header
  // (next.config.ts). Crawling stays allowed so crawlers can see that header; no sitemap is offered.
  if (process.env.SITE_NOINDEX === '1')
    return { rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api'] } }
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
