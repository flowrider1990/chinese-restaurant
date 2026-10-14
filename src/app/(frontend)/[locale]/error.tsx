'use client'

import { usePathname } from 'next/navigation'
import { defaultLocale, locales, type Locale } from '@/i18n/locales'

const text: Record<Locale, { title: string; body: string; retry: string }> = {
  de: {
    title: 'Diese Seite konnte nicht geladen werden',
    body: 'Bitte versuchen Sie es gleich noch einmal. Telefonisch erreichen Sie uns jederzeit zu den Öffnungszeiten.',
    retry: 'Erneut versuchen',
  },
  en: {
    title: 'This page could not be loaded',
    body: 'Please try again in a moment. You can always reach us by phone during opening hours.',
    retry: 'Try again',
  },
}

/** Error boundary for public pages. The header and footer stay usable around it. */
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const first = usePathname().split('/')[1]
  const locale = (locales.find((l) => l.code === first)?.code ?? defaultLocale) as Locale
  const t = text[locale]
  return (
    <section className="page-message" role="alert">
      <h1>{t.title}</h1>
      <p>{t.body}</p>
      <button type="button" className="btn btn--primary" onClick={reset}>
        {t.retry}
      </button>
    </section>
  )
}
