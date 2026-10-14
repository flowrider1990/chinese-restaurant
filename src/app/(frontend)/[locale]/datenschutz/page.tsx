import type { Metadata } from 'next'
import { LegalPage } from '@/components/site/LegalPage'
import { dictionaries } from '@/i18n/dictionary'
import { getLocale, isLocale } from '@/i18n/server'
import { getLegal } from '@/lib/queries'

export async function generateMetadata({ params }: PageProps<'/[locale]/datenschutz'>): Promise<Metadata> {
  const { locale } = await params
  return isLocale(locale) ? { title: dictionaries[locale].nav.privacy } : {}
}

export default async function PrivacyPage() {
  const { locale, t } = await getLocale()
  const legal = await getLegal(locale)
  return <LegalPage title={t.nav.privacy} content={legal.privacy} />
}
