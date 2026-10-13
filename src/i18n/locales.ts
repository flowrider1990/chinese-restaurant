/** Site languages. Add an entry here (and run a migration) to add a language. */
export const locales = [
  { code: 'de', label: 'Deutsch' },
  { code: 'en', label: 'English' },
] as const

export type Locale = (typeof locales)[number]['code']

export const defaultLocale: Locale = 'de'
