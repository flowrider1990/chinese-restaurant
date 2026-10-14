import Link from 'next/link'
import type { Dictionary } from '@/i18n/dictionary'
import type { Locale } from '@/i18n/locales'
import { href } from '@/i18n/routes'
import { weeklySummary } from '@/lib/opening-hours'
import type { RestaurantInfo } from '@/lib/queries'
import { formatDays, formatSlots } from './hours-text'
import { OrderOptions } from './OrderOptions'

const socialName = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', google: 'Google', other: 'Web' }

export function Footer({ info, locale, t }: { info: RestaurantInfo; locale: Locale; t: Dictionary }) {
  const { address } = info
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          <p className="wordmark">
            {info.name}
            {info.nameNative && (
              <span className="wordmark__native" lang="zh">
                {info.nameNative}
              </span>
            )}
          </p>
          {info.tagline && <p>{info.tagline}</p>}
        </div>

        <section aria-labelledby="footer-address">
          <h2 id="footer-address">{t.address}</h2>
          <address>
            {address.street}
            <br />
            {address.postalCode} {address.city}
          </address>
          {info.mapsUrl && (
            <a href={info.mapsUrl} target="_blank" rel="noopener noreferrer">
              Google Maps <span className="visually-hidden">{t.externalLink}</span>
            </a>
          )}
        </section>

        <section aria-labelledby="footer-hours">
          <h2 id="footer-hours">{t.openingHours}</h2>
          <dl className="hours-list">
            {weeklySummary(info.hours).map((g) => (
              <div key={g.days.join()}>
                <dt>{formatDays(g.days, t)}</dt>
                <dd>{formatSlots(g.slots, t)}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="footer-contact">
          <h2 id="footer-contact">{t.contact}</h2>
          <p>
            <a href={`tel:${info.phoneE164}`}>{info.phone}</a>
            {info.email && (
              <>
                <br />
                <a href={`mailto:${info.email}`}>{info.email}</a>
              </>
            )}
          </p>
          {info.orderLinks.length > 0 && <OrderOptions links={info.orderLinks} t={t} />}
          {info.socialLinks.length > 0 && (
            <ul className="site-footer__social" aria-label={t.social}>
              {info.socialLinks.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer">
                    {socialName[s.platform]} <span className="visually-hidden">{t.externalLink}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <nav
        className="site-footer__legal"
        aria-label={`${t.vouchers.nav}, ${t.nav.imprint}, ${t.nav.privacy}`}
      >
        <Link href={href('vouchers', locale)}>{t.vouchers.nav}</Link>
        <Link href={href('imprint', locale)}>{t.nav.imprint}</Link>
        <Link href={href('privacy', locale)}>{t.nav.privacy}</Link>
      </nav>
    </footer>
  )
}
