import Image from 'next/image'
import type { Dictionary } from '@/i18n/dictionary'
import type { RestaurantInfo } from '@/lib/queries'
import { Icon } from './Icon'

/**
 * Official provider logos from the providers' press kits (see docs/legal-checklist.md before
 * launch). Providers without a logo file fall back to their name as text.
 */
type Logo = { src: string; width: number; height: number }
const providers: Record<string, { name: string | null; logo: Logo | null }> = {
  lieferando: {
    name: 'Lieferando',
    logo: { src: '/brands/lieferando.png', width: 526, height: 120 },
  },
  wolt: { name: 'Wolt', logo: { src: '/brands/wolt.png', width: 162, height: 160 } },
  ubereats: { name: 'Uber Eats', logo: null },
  other: { name: null, logo: null },
}

/**
 * The provider's logo, its alt text naming the provider. Inside a link, the link's own label
 * names the provider (`named={false}`), so the logo is decorative there and the name is announced
 * once.
 */
function ProviderMark({
  provider,
  label,
  named = true,
}: {
  provider: string
  label: string
  named?: boolean
}) {
  const p = providers[provider] ?? providers.other
  if (!p.logo) return <span className="provider__name">{p.name ?? label}</span>
  return (
    <Image
      className={`provider__logo provider__logo--${provider}`}
      {...p.logo}
      alt={named ? (p.name ?? label) : ''}
    />
  )
}

/**
 * Delivery providers. A provider with a URL is an external link; without one it is shown with a
 * "coming soon" note, never as a dead link.
 */
export function OrderOptions({ links, t }: { links: RestaurantInfo['orderLinks']; t: Dictionary }) {
  const live = links.filter((l) => l.url)
  const pending = links.filter((l) => !l.url)

  return (
    <div className="order-options">
      {live.length > 0 && (
        <ul className="order-options__list">
          {live.map((l) => (
            <li key={l.provider + l.url}>
              <a className="provider" href={l.url!} target="_blank" rel="noopener noreferrer">
                <ProviderMark provider={l.provider} label={l.label} named={false} />
                <Icon name="external" size={16} />
                <span className="visually-hidden">
                  {l.label} {t.externalLink}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
      {pending.length > 0 && (
        <div className="order-options__pending">
          <p>{t.orderSoon}</p>
          <ul className="order-options__list">
            {pending.map((l) => (
              <li key={l.provider + l.label} className="provider provider--pending">
                <ProviderMark provider={l.provider} label={l.label} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
