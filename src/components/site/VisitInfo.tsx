import type { Dictionary } from '@/i18n/dictionary'
import { weeklySummary } from '@/lib/opening-hours'
import type { RestaurantInfo } from '@/lib/queries'
import { formatDays, formatSlots } from './hours-text'
import { PaymentMethods } from './PaymentMethods'

/** Address, opening hours and phone as one block, used on the home and restaurant pages. */
export function VisitInfo({ info, t, headingLevel = 'h2' }: { info: RestaurantInfo; t: Dictionary; headingLevel?: 'h2' | 'h3' }) {
  const H = headingLevel
  return (
    <div className="visit">
      <div>
        <H>{t.address}</H>
        <address>
          {info.address.street}
          <br />
          {info.address.postalCode} {info.address.city}
        </address>
      </div>
      <div>
        <H>{t.openingHours}</H>
        <dl className="hours-list">
          {weeklySummary(info.hours).map((g) => (
            <div key={g.days.join()}>
              <dt>{formatDays(g.days, t)}</dt>
              <dd>{formatSlots(g.slots, t)}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div>
        <H>{t.contact}</H>
        <p>
          <a href={`tel:${info.phoneE164}`}>{info.phone}</a>
          {info.email && (
            <>
              <br />
              <a href={`mailto:${info.email}`}>{info.email}</a>
            </>
          )}
        </p>
        <PaymentMethods methods={info.paymentMethods} t={t} />
      </div>
    </div>
  )
}
