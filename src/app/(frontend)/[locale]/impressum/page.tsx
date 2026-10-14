import type { Metadata } from 'next'
import { LegalPage } from '@/components/site/LegalPage'
import { dictionaries } from '@/i18n/dictionary'
import { pageMetadata } from '@/lib/seo'
import { getLocale, isLocale } from '@/i18n/server'
import { getLegal } from '@/lib/queries'

export async function generateMetadata({ params }: PageProps<'/[locale]/impressum'>): Promise<Metadata> {
  const { locale } = await params
  return isLocale(locale) ? pageMetadata({ key: 'imprint', locale, title: dictionaries[locale].nav.imprint }) : {}
}

export default async function ImprintPage() {
  const { locale, t } = await getLocale()
  const legal = await getLegal(locale)
  return <LegalPage title={t.nav.imprint} content={legal.imprint} />
}
