import { notFound } from 'next/navigation'
import { locale as rootLocale } from 'next/root-params'
import { dictionaries } from './dictionary'
import { locales, type Locale } from './locales'

export const isLocale = (value: string): value is Locale => locales.some((l) => l.code === value)

/** The current request's locale and interface text. 404s for an unknown locale segment. */
export async function getLocale() {
  const value = await rootLocale()
  if (!value || !isLocale(value)) notFound()
  return { locale: value, t: dictionaries[value] }
}
