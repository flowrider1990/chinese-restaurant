import type { Metadata } from 'next'
import Link from 'next/link'
import { dictionaries } from '@/i18n/dictionary'
import { href } from '@/i18n/routes'
import { getLocale, isLocale } from '@/i18n/server'
import { payloadClient } from '@/lib/queries'
import { pageMetadata } from '@/lib/seo'
import { voucherStatusForSession } from '@/lib/voucher-fulfilment'
import { VoucherForm } from './VoucherForm'

/** The Stripe session of the thank-you state (`?session_id=…`), or null for the order form. */
function thankYouSession(searchParams: Record<string, string | string[] | undefined>) {
  const id = searchParams.session_id
  return typeof id === 'string' && id !== '' ? id : null
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<'/[locale]/gutscheine'>): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const meta = await pageMetadata({
    key: 'vouchers',
    locale,
    title: dictionaries[locale].vouchers.title,
    description: dictionaries[locale].seo.description.vouchers,
  })
  if (!thankYouSession(await searchParams)) return meta
  // The thank-you state is per order: not indexed, and without canonical or language alternates.
  const { alternates: _alternates, ...rest } = meta
  return { ...rest, robots: { index: false, follow: false } }
}

export default async function VouchersPage({ searchParams }: PageProps<'/[locale]/gutscheine'>) {
  const { locale, t } = await getLocale()
  const sessionId = thankYouSession(await searchParams)
  const v = t.vouchers

  if (sessionId) {
    const status = await voucherStatusForSession(await payloadClient(), sessionId)
    const [title, text] =
      status === 'paid'
        ? [v.paidTitle, v.paid]
        : status === 'pending'
          ? [v.pendingTitle, v.pending]
          : [v.unknownTitle, v.unknown]
    return (
      <div className="reserve-page">
        <section className="reserve-success" role="status">
          <h1>{title}</h1>
          <p>{text}</p>
          <p>
            {status === 'pending' ? (
              <a href={`${href('vouchers', locale)}?session_id=${encodeURIComponent(sessionId)}`}>
                {v.reload}
              </a>
            ) : (
              <Link href={href('vouchers', locale)}>{v.back}</Link>
            )}
          </p>
        </section>
      </div>
    )
  }

  return (
    <div className="reserve-page">
      <header className="page-head">
        <h1>{v.title}</h1>
        <p>{v.intro}</p>
      </header>
      <VoucherForm locale={locale} privacyHref={href('privacy', locale)} />
    </div>
  )
}
