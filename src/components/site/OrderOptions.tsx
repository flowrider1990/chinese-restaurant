import type { Dictionary } from '@/i18n/dictionary'
import type { RestaurantInfo } from '@/lib/queries'
import { Icon } from './Icon'

const providerName = { lieferando: 'Lieferando', wolt: 'Wolt', other: null } as const

/**
 * Delivery providers. A provider with a URL is an external link; without one it is shown as plain
 * text ("coming soon"), never as a dead link.
 */
export function OrderOptions({ links, t }: { links: RestaurantInfo['orderLinks']; t: Dictionary }) {
  const live = links.filter((l) => l.url)
  const pending = links.filter((l) => !l.url)

  return (
    <div className="order-options">
      {live.length > 0 && (
        <ul className="order-options__links">
          {live.map((l) => (
            <li key={l.provider + l.url}>
              <a className="btn btn--outline" href={l.url!} target="_blank" rel="noopener noreferrer">
                {l.label}
                <Icon name="external" size={16} />
                <span className="visually-hidden"> {t.externalLink}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
      {pending.length > 0 && (
        <p className="order-options__pending">
          {t.orderSoon}{' '}
          <strong>{pending.map((l) => providerName[l.provider] ?? l.label).join(', ')}</strong>
        </p>
      )}
    </div>
  )
}
