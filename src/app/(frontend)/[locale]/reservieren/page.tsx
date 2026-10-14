import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { dictionaries } from '@/i18n/dictionary'
import { href } from '@/i18n/routes'
import { getLocale, isLocale } from '@/i18n/server'
import { getReservationPage } from '@/lib/queries'
import { pageMetadata } from '@/lib/seo'
import { ReservationForm } from './ReservationForm'

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/reservieren'>): Promise<Metadata> {
  const { locale } = await params
  return isLocale(locale)
    ? pageMetadata({ key: 'reserve', locale, title: dictionaries[locale].reserve.title })
    : {}
}

export default async function ReservePage() {
  const { locale, t } = await getLocale()
  const { settings, info } = await getReservationPage(locale)
  if (settings.mode !== 'form') notFound()

  return (
    <div className="reserve-page">
      <header className="page-head">
        <h1>{t.reserve.title}</h1>
        <p>{t.reserve.intro}</p>
      </header>
      <ReservationForm
        locale={locale}
        hours={info.hours}
        rules={{
          slotMinutes: settings.slotMinutes,
          lastBookingBeforeCloseMinutes: settings.lastBookingBeforeCloseMinutes,
          leadTimeMinutes: settings.leadTimeMinutes,
          horizonDays: settings.horizonDays,
          maxPartySize: settings.maxPartySize,
        }}
        phone={info.phone}
        privacyHref={href('privacy', locale)}
      />
    </div>
  )
}
