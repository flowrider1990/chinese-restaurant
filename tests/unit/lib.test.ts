import { describe, expect, it } from 'vitest'
import { centsToInput, formatPrice, parsePriceInput } from '@/lib/price'
import { slugify } from '@/lib/slugify'
import { isValidTime } from '@/lib/time'

describe('slugify', () => {
  it('transliterates German umlauts and strips diacritics', () => {
    expect(slugify('Phở Bò – Rindfleisch-Nudelsuppe')).toBe('pho-bo-rindfleisch-nudelsuppe')
    expect(slugify('Süß-saure Soße')).toBe('suess-saure-sosse')
  })
  it('trims separators and collapses symbols', () => {
    expect(slugify('  Neu!! Frühlingsrollen (vegan)  ')).toBe('neu-fruehlingsrollen-vegan')
    expect(slugify('—')).toBe('')
  })
})

describe('price', () => {
  it('parses German and English decimal input to cents', () => {
    expect(parsePriceInput('12,90')).toBe(1290)
    expect(parsePriceInput('12.9')).toBe(1290)
    expect(parsePriceInput('12')).toBe(1200)
    expect(parsePriceInput(' 8,50 € ')).toBe(850)
    expect(parsePriceInput('-1,50')).toBe(-150)
  })
  it('rejects malformed input', () => {
    for (const bad of ['', 'abc', '1,234', '1.000,00', '12,', ',50']) {
      expect(parsePriceInput(bad)).toBeNull()
    }
  })
  it('round-trips cents to the editable form', () => {
    expect(centsToInput(1290)).toBe('12,90')
    expect(centsToInput(5)).toBe('0,05')
    expect(centsToInput(-150)).toBe('-1,50')
  })
  it('formats for display in de-DE', () => {
    expect(formatPrice(1290)).toBe('12,90 €')
  })
})

describe('isValidTime', () => {
  it('accepts HH:MM and 24:00', () => {
    for (const t of ['00:00', '11:30', '23:59', '24:00']) expect(isValidTime(t)).toBe(true)
  })
  it('rejects malformed times', () => {
    for (const t of ['9:00', '24:01', '12:60', '1200', '', null]) expect(isValidTime(t)).toBe(false)
  })
})
