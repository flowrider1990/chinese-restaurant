import Link from 'next/link'
import { OpenStatus } from '@/components/site/OpenStatus'
import { OrderOptions } from '@/components/site/OrderOptions'
import { href } from '@/i18n/routes'
import { getLocale } from '@/i18n/server'
import { getRestaurantInfo } from '@/lib/queries'

// Minimal home page for the Phase 3 shell. Phase 4 replaces it with the full landing page.
export default async function HomePage() {
  const { locale, t } = await getLocale()
  const info = await getRestaurantInfo(locale)

  return (
    <section className="hero">
      <div className="hero__text">
        <h1>{info.tagline ?? info.name}</h1>
        <OpenStatus hours={info.hours} locale={locale} />
        <div className="hero__actions">
          <Link className="btn btn--primary" href={href('menu', locale)}>
            {t.nav.menu}
          </Link>
          <a className="btn btn--outline" href={`tel:${info.phoneE164}`}>
            {t.call}
          </a>
        </div>
        {info.orderLinks.length > 0 && <OrderOptions links={info.orderLinks} t={t} />}
      </div>
      <div className="hero__media" aria-hidden="true" />
    </section>
  )
}
