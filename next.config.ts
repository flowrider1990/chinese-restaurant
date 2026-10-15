import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

/**
 * SITE_NOINDEX=1 (set for the shared demo on Vercel): every response tells search engines not to
 * index or follow it. The SEO setup (metadata, sitemap, JSON-LD) stays intact for a real launch.
 */
const noindex = process.env.SITE_NOINDEX === '1'

const nextConfig: NextConfig = {
  async headers() {
    return noindex
      ? [{ source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }]
      : []
  },
  images: {
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
      { pathname: '/brands/**' },
    ],
    // CMS media on Vercel Blob (see src/lib/media-storage.ts).
    remotePatterns: [{ protocol: 'https', hostname: '*.public.blob.vercel-storage.com' }],
  },
  // StaticMap checks public/map/* on disk; serverless re-renders (revalidation) need the files traced.
  outputFileTracingIncludes: {
    '/\\[locale\\]/restaurant': ['./public/map/*.svg'],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  turbopack: {
    root: path.resolve(dirname),
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
