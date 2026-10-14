export const VOUCHER_LIMITS = {
  min: 10,
  max: 300,
  presets: [25, 50, 100],
  buyerName: 100,
  email: 200,
  recipientName: 80,
  message: 200,
} as const

export type VoucherProblem = 'required' | 'invalid' | 'tooLong' | 'tooLow' | 'tooHigh'

export type VoucherInput = {
  /** Whole euros as typed or chosen, e.g. "50". */
  amount: string
  buyerName: string
  buyerEmail: string
  recipientName?: string
  message?: string
  privacy: boolean
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** "50" → 50. Anything but plain digits (decimals, exponents, signs) → null; never rounds. */
export function parseWholeEuros(raw: string): number | null {
  const value = raw.trim()
  return /^\d{1,4}$/.test(value) ? Number(value) : null
}

export function checkVoucherRequest(
  input: VoucherInput,
): Partial<Record<keyof VoucherInput, VoucherProblem>> {
  const problems: Partial<Record<keyof VoucherInput, VoucherProblem>> = {}
  const L = VOUCHER_LIMITS

  if (!input.amount.trim()) problems.amount = 'required'
  else {
    const euros = parseWholeEuros(input.amount)
    if (euros === null) problems.amount = 'invalid'
    else if (euros < L.min) problems.amount = 'tooLow'
    else if (euros > L.max) problems.amount = 'tooHigh'
  }

  const name = input.buyerName.trim()
  if (!name) problems.buyerName = 'required'
  else if (name.length > L.buyerName) problems.buyerName = 'tooLong'

  const email = input.buyerEmail.trim().toLowerCase()
  if (!email) problems.buyerEmail = 'required'
  else if (!EMAIL.test(email) || email.length > L.email) problems.buyerEmail = 'invalid'

  if ((input.recipientName ?? '').trim().length > L.recipientName)
    problems.recipientName = 'tooLong'
  if ((input.message ?? '').trim().length > L.message) problems.message = 'tooLong'
  if (!input.privacy) problems.privacy = 'required'
  return problems
}

/** 31 December of the third year after the purchase year (Berlin), 23:59:59 Berlin (UTC+1 in winter). */
export function validUntil(paidAt: Date): string {
  const year = Number(
    new Intl.DateTimeFormat('en', { timeZone: 'Europe/Berlin', year: 'numeric' }).format(paidAt),
  )
  return `${year + 3}-12-31T22:59:59.000Z`
}

export type RedemptionRow = {
  id?: string | null
  /** Cents. */
  amount: number
  note?: string | null
  redeemedAt?: string | null
  by?: unknown
}

export function balanceCents(amountCents: number, rows: { amount: number }[]): number {
  return amountCents - rows.reduce((sum, r) => sum + r.amount, 0)
}

const sameRow = (a: RedemptionRow, b: RedemptionRow) =>
  a.id === b.id &&
  a.amount === b.amount &&
  (a.note ?? '') === (b.note ?? '') &&
  (a.redeemedAt ?? null) === (b.redeemedAt ?? null)

/** Redemptions are append-only and never exceed the voucher amount. Returns an admin error or null. */
export function checkRedemptions({
  previous,
  next,
  amountCents,
  status,
  validUntil: until,
  now,
}: {
  previous: RedemptionRow[]
  next: RedemptionRow[]
  amountCents: number
  status: string
  validUntil?: string | null
  now: Date
}): string | null {
  if (next.length < previous.length || previous.some((row, i) => !sameRow(row, next[i])))
    return 'Frühere Einlösungen können nicht geändert oder gelöscht werden.'
  const added = next.slice(previous.length)
  if (added.length === 0) return null
  if (status !== 'paid')
    return 'Dieser Gutschein ist nicht einlösbar (nicht bezahlt oder storniert).'
  if (until && now.getTime() > new Date(until).getTime()) return 'Dieser Gutschein ist abgelaufen.'
  if (added.some((r) => !Number.isInteger(r.amount) || r.amount <= 0))
    return 'Der eingelöste Betrag muss größer als 0 sein.'
  if (balanceCents(amountCents, next) < 0) return 'Der Betrag ist höher als der Restbetrag.'
  return null
}
