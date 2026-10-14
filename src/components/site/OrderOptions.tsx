import Image from 'next/image'
import type { Dictionary } from '@/i18n/dictionary'
import type { RestaurantInfo } from '@/lib/queries'
import { Icon } from './Icon'

/**
 * Official provider logos from the providers' press kits (see docs/legal-checklist.md before
 * launch). Providers without a logo file fall back to their name as text.
 */
type Logo = { src: string; width: number; height: number }
const providers: Record<string, { name: string | null; light: Logo | null; dark: Logo | null }> = {
  lieferando: {
    name: 'Lieferando',
    light: { src: '/brands/lieferando.png', width: 526, height: 120 },
    dark: { src: '/brands/lieferando-white.png', width: 526, height: 120 },
  },
  wolt: {
    name: 'Wolt',
    light: { src: '/brands/wolt.png', width: 162, height: 160 },
    dark: { src: '/brands/wolt-white.png', width: 261, height: 96 },
  },
  ubereats: { name: 'Uber Eats', light: null, dark: null },
  other: { name: null, light: null, dark: null },
}

/** Colour logo on light backgrounds, the provider's official white logo in dark mode. */
function ProviderMark({ provider, label }: { provider: string; label: string }) {
  const p = providers[provider] ?? providers.other
  if (!p.light || !p.dark) return <span className="provider__name">{p.name ?? label}</span>
  return (
    <>
      <Image className={`provider__logo provider__logo--light provider__logo--${provider}`} {...p.light} alt={p.name ?? label} />
      <Image className={`provider__logo provider__logo--dark provider__logo--${provider}-dark`} {...p.dark} alt={p.name ?? label} />
    </>
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
                <ProviderMark provider={l.provider} label={l.label} />
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
