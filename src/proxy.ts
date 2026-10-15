import { NextResponse, type NextRequest } from 'next/server'
import { defaultLocale, locales } from './i18n/locales'
import { routes } from './i18n/routes'

const otherLocales: string[] = locales.map((l) => l.code).filter((c) => c !== defaultLocale)

/**
 * German is served without a prefix, other languages under /<locale>. Requests are rewritten onto
 * app/(frontend)/[locale], whose page folders use the German segment.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const [first = '', second = '', ...rest] = pathname.split('/').filter(Boolean)

  // "/de/…" is not a public URL: redirect to the unprefixed version.
  if (first === defaultLocale) {
    const url = request.nextUrl.clone()
    url.pathname = '/' + [second, ...rest].filter(Boolean).join('/')
    return NextResponse.redirect(url, 308)
  }

  const url = request.nextUrl.clone()
  if (otherLocales.includes(first)) {
    const locale = first as keyof (typeof routes)['home']
    const entry = Object.values(routes).find((r) => r[locale] === second)
    // A German segment under another language ("/en/speisekarte"): redirect to that language's own.
    const german = entry ? undefined : Object.values(routes).find((r) => r.de === second && second)
    if (german) {
      url.pathname = '/' + [first, german[locale], ...rest].filter(Boolean).join('/')
      return NextResponse.redirect(url, 308)
    }
    url.pathname = '/' + [first, entry ? entry.de : second, ...rest].filter(Boolean).join('/')
  } else {
    url.pathname = '/' + [defaultLocale, first, second, ...rest].filter(Boolean).join('/')
  }
  return NextResponse.rewrite(url)
}

export const config = {
  // Everything except the CMS, its API, Next internals and files with an extension.
  matcher: ['/((?!admin|api|_next|.*\\..*).*)'],
}
