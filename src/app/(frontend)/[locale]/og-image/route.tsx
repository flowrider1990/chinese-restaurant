import { ImageResponse } from 'next/og'
import { isLocale } from '@/i18n/server'
import { getRestaurantInfo } from '@/lib/queries'

const size = { width: 1200, height: 630 }

/**
 * Default social preview image (/og-image, /en/og-image) for pages without their own image. Set
 * "Standard-Vorschaubild" in the site settings to use a photo instead.
 */
export async function GET(_request: Request, { params }: RouteContext<'/[locale]/og-image'>) {
  const { locale } = await params
  const info = await getRestaurantInfo(isLocale(locale) ? locale : 'de')
  const { address } = info

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          background: '#f5f6f2',
          color: '#1e2740',
        }}
      >
        <div
          style={{
            width: 112,
            height: 112,
            borderRadius: 56,
            border: '8px solid #2b57a0',
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ width: 36, height: 36, borderRadius: 18, background: '#2b57a0' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontSize: 104, fontWeight: 800, letterSpacing: -3 }}>{info.name}</div>
          {info.tagline && <div style={{ fontSize: 40, color: '#55607a', maxWidth: 950 }}>{info.tagline}</div>}
        </div>
        <div style={{ display: 'flex', fontSize: 30, color: '#2b57a0' }}>
          {`${address.street} · ${address.postalCode} ${address.city}`}
        </div>
      </div>
    ),
    size,
  )
}
