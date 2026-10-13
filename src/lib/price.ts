/** Prices are stored as integer cents to avoid floating-point rounding. */

const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })

export function formatPrice(cents: number): string {
  return euro.format(cents / 100)
}

/** "12,90" | "12.90" | "12" | "12,9" | "-1,50" → cents. Returns null for anything else. */
export function parsePriceInput(input: string): number | null {
  const match = input.trim().replace(/\s|€/g, '').match(/^(-?)(\d+)(?:[.,](\d{1,2}))?$/)
  if (!match) return null
  const [, sign, whole, fraction = ''] = match
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  return sign ? -cents : cents
}

/** Cents → editable "12,90" (no currency symbol). */
export function centsToInput(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`
}
