import type { Metadata } from 'next'
import { Bricolage_Grotesque, Instrument_Sans } from 'next/font/google'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { Footer } from '@/components/site/Footer'
import { Header } from '@/components/site/Header'
import { MobileActionBar } from '@/components/site/MobileActionBar'
import { OrderOptions } from '@/components/site/OrderOptions'
import { dictionaries } from '@/i18n/dictionary'
import { locales } from '@/i18n/locales'
import { href } from '@/i18n/routes'
import { isLocale } from '@/i18n/server'
import { getReservationLink, getRestaurantInfo } from '@/lib/queries'
import { siteUrl } from '@/lib/seo'
import './site.css'
import './pages.css'

// Downloaded at build time and served from this site: browsers never contact Google.
const display = Bricolage_Grotesque({
  subsets: ['latin', 'latin-ext'],
  axes: ['opsz'],
  variable: '--font-display',
  display: 'swap',
})
const body = Instrument_Sans({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-body',
  display: 'swap',
})

/** Applies a saved theme choice before the first paint (no flash). Without one, the device decides. */
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`

export function generateStaticParams() {
  return locales.map((l) => ({ locale: l.code }))
}

export async function generateMetadata({ params }: LayoutProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const info = await getRestaurantInfo(locale)
  return {
    metadataBase: new URL(siteUrl),
    title: { default: info.name, template: `%s · ${info.name}` },
    description: info.seoDescription ?? info.tagline ?? undefined,
    applicationName: info.name,
  }
}

export default async function SiteLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = dictionaries[locale]
  const [info, reserve] = await Promise.all([getRestaurantInfo(locale), getReservationLink(locale)])

  return (
    // The theme script sets data-theme before hydration, hence suppressHydrationWarning.
    <html lang={locale} className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <a className="skip-link" href="#main">
          {t.skipToContent}
        </a>
        <Header info={info} locale={locale} t={t} reserve={reserve} />
        <main id="main">{children as ReactNode}</main>
        <Footer info={info} locale={locale} t={t} />
        <MobileActionBar
          phoneE164={info.phoneE164}
          menuHref={href('menu', locale)}
          reserveHref={reserve?.href ?? null}
          reserveExternal={reserve?.external ?? false}
          labels={{
            call: t.call,
            menu: t.nav.menu,
            reserve: t.reserve.nav,
            order: t.order,
            close: t.close,
          }}
          orderPanel={
            info.orderLinks.length > 0 ? <OrderOptions links={info.orderLinks} t={t} /> : null
          }
        />
      </body>
    </html>
  )
}
