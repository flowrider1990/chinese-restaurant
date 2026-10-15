import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/seo'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      // Uploaded images (og:image, JSON-LD) are served from /api/media/file/: keep them crawlable.
      allow: ['/', '/api/media/file/'],
      disallow: ['/admin', '/api'],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
