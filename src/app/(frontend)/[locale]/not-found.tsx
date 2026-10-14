import Link from 'next/link'
import { href } from '@/i18n/routes'
import { getLocale } from '@/i18n/server'

export default async function NotFound() {
  const { locale, t } = await getLocale()
  return (
    <section className="page-message">
      <h1>{t.notFoundTitle}</h1>
      <p>{t.notFoundText}</p>
      <div className="hero__actions">
        <Link className="btn btn--primary" href={href('menu', locale)}>
          {t.nav.menu}
        </Link>
        <Link className="btn btn--outline" href={href('home', locale)}>
          {t.toHome}
        </Link>
      </div>
    </section>
  )
}
