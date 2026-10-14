import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { href, routeKeyFor } from '@/i18n/routes'
import { proxy } from '@/proxy'

describe('href', () => {
  it('builds unprefixed German and prefixed English paths', () => {
    expect(href('home', 'de')).toBe('/')
    expect(href('home', 'en')).toBe('/en')
    expect(href('menu', 'de')).toBe('/speisekarte')
    expect(href('menu', 'en')).toBe('/en/menu')
    expect(href('news', 'en', 'opening')).toBe('/en/news/opening')
  })

  it('knows the reservation page', () => {
    expect(href('reserve', 'de')).toBe('/reservieren')
    expect(href('reserve', 'en')).toBe('/en/reserve')
  })

  it('maps a localized segment back to its page', () => {
    expect(routeKeyFor('menu', 'en')).toBe('menu')
    expect(routeKeyFor('speisekarte', 'de')).toBe('menu')
    expect(routeKeyFor('menu', 'de')).toBeNull()
  })
})

describe('proxy', () => {
  const run = (path: string) => proxy(new NextRequest(`http://localhost:3000${path}`))

  it('rewrites German paths onto the de segment', () => {
    expect(run('/speisekarte').headers.get('x-middleware-rewrite')).toBe('http://localhost:3000/de/speisekarte')
    expect(run('/').headers.get('x-middleware-rewrite')).toBe('http://localhost:3000/de')
  })

  it('rewrites English segments onto the German folders', () => {
    expect(run('/en/menu').headers.get('x-middleware-rewrite')).toBe('http://localhost:3000/en/speisekarte')
    expect(run('/en/news/opening').headers.get('x-middleware-rewrite')).toBe(
      'http://localhost:3000/en/aktuelles/opening',
    )
  })

  it('rewrites /en/reserve onto the German folder', () => {
    expect(run('/en/reserve').headers.get('x-middleware-rewrite')).toBe('http://localhost:3000/en/reservieren')
  })

  it('redirects /de URLs to the unprefixed version', () => {
    const res = run('/de/speisekarte')
    expect(res.status).toBe(308)
    expect(res.headers.get('location')).toBe('http://localhost:3000/speisekarte')
  })
})
