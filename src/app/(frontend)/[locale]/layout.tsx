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
import { getRestaurantInfo } from '@/lib/queries'
import './site.css'

// Downloaded at build time and served from this site: browsers never contact Google.
const display = Bricolage_Grotesque({
  subsets: ['latin', 'latin-ext'],
  axes: ['opsz'],
  variable: '--font-display',
  display: 'swap',
})
const body = Instrument_Sans({ subsets: ['latin', 'latin-ext'], variable: '--font-body', display: 'swap' })

export function generateStaticParams() {
  return locales.map((l) => ({ locale: l.code }))
}

export async function generateMetadata({ params }: LayoutProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const info = await getRestaurantInfo(locale)
  return { title: { default: info.name, template: `%s · ${info.name}` }, description: info.tagline ?? undefined }
}

export default async function SiteLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = dictionaries[locale]
  const info = await getRestaurantInfo(locale)

  return (
    <html lang={locale} className={`${display.variable} ${body.variable}`}>
      <body>
        <a className="skip-link" href="#main">
          {t.skipToContent}
        </a>
        <Header info={info} locale={locale} t={t} />
        <main id="main">{children as ReactNode}</main>
        <Footer info={info} locale={locale} t={t} />
        <MobileActionBar
          phoneE164={info.phoneE164}
          menuHref={href('menu', locale)}
          labels={{ call: t.call, menu: t.nav.menu, order: t.order, close: t.close }}
          orderPanel={info.orderLinks.length > 0 ? <OrderOptions links={info.orderLinks} t={t} /> : null}
        />
      </body>
    </html>
  )
}
