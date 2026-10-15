import type { Metadata } from 'next'
import { LegalPage } from '@/components/site/LegalPage'
import { dictionaries } from '@/i18n/dictionary'
import { isPlaceholder, pageMetadata } from '@/lib/seo'
import { getLocale, isLocale } from '@/i18n/server'
import { getLegal } from '@/lib/queries'

export async function generateMetadata({ params }: PageProps<'/[locale]/impressum'>): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const meta = await pageMetadata({
    key: 'imprint',
    locale,
    title: dictionaries[locale].nav.imprint,
    description: dictionaries[locale].seo.description.imprint,
  })
  // Placeholder text (the English version for now, see isPlaceholder): not indexed.
  return isPlaceholder('imprint', locale) ? { ...meta, robots: { index: false, follow: true } } : meta
}

export default async function ImprintPage() {
  const { locale, t } = await getLocale()
  const legal = await getLegal(locale)
  return <LegalPage title={t.nav.imprint} content={legal.imprint} />
}
