import Link from 'next/link'
import type { Dictionary } from '@/i18n/dictionary'
import type { Locale } from '@/i18n/locales'
import { href } from '@/i18n/routes'
import type { RestaurantInfo } from '@/lib/queries'
import { Icon } from './Icon'
import { LanguageSwitch } from './LanguageSwitch'
import { MobileNav } from './MobileNav'
import { NavLinks } from './NavLinks'

export function Header({ info, locale, t }: { info: RestaurantInfo; locale: Locale; t: Dictionary }) {
  const items = (['menu', 'restaurant', 'news'] as const).map((key) => ({
    href: href(key, locale),
    label: t.nav[key],
  }))

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link href={href('home', locale)} className="wordmark">
          {info.name}
          {info.nameNative && (
            <span className="wordmark__native" lang="zh">
              {info.nameNative}
            </span>
          )}
        </Link>
        <NavLinks items={items} label={t.navLabel} />
        <div className="site-header__actions">
          <LanguageSwitch locale={locale} label={t.languageLabel} />
          <a className="btn btn--primary site-header__call" href={`tel:${info.phoneE164}`}>
            <Icon name="phone" size={18} />
            <span>{info.phone}</span>
          </a>
          <MobileNav items={items} openLabel={t.openMenu} closeLabel={t.closeMenu} />
        </div>
      </div>
    </header>
  )
}
