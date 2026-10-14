import Link from 'next/link'
import type { Dictionary } from '@/i18n/dictionary'
import type { Locale } from '@/i18n/locales'
import { href } from '@/i18n/routes'
import type { RestaurantInfo } from '@/lib/queries'
import { Icon } from './Icon'
import { LanguageSwitch } from './LanguageSwitch'
import { MobileNav } from './MobileNav'
import { NavLinks } from './NavLinks'

export function Header({
  info,
  locale,
  t,
  reserve,
}: {
  info: RestaurantInfo
  locale: Locale
  t: Dictionary
  reserve: { href: string; external: boolean } | null
}) {
  const items = (['menu', 'restaurant', 'news'] as const).map((key) => ({
    href: href(key, locale),
    label: t.nav[key],
  }))
  const navItems: { href: string; label: string; external?: boolean }[] = reserve
    ? [...items, { href: reserve.href, label: t.reserve.nav, external: reserve.external }]
    : items

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
        <NavLinks items={navItems} label={t.navLabel} externalLabel={t.externalLink} />
        <div className="site-header__actions">
          <LanguageSwitch locale={locale} label={t.languageLabel} />
          <a className="btn btn--primary site-header__call" href={`tel:${info.phoneE164}`}>
            <Icon name="phone" size={18} />
            <span>{info.phone}</span>
          </a>
          <MobileNav
            items={navItems}
            openLabel={t.openMenu}
            closeLabel={t.closeMenu}
            externalLabel={t.externalLink}
          />
        </div>
      </div>
    </header>
  )
}
