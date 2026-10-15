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
  /** When the guest redeemed it; chosen by staff (default: now). */
  redeemedAt?: string | null
  /** Staff member who redeemed it; chosen by staff (default: the logged-in user). Id or user. */
  by?: unknown
  /** Stamped by the server when the row is first saved; never editable. */
  recordedAt?: string | null
  /** User who saved the row, stamped by the server (null for server code); never editable. */
  recordedBy?: unknown
}

/** Tolerated clock difference between the admin's browser and the server. */
export const REDEMPTION_CLOCK_SKEW_MS = 5 * 60 * 1000

/** Relationship values arrive as an id or as a populated document; this returns the id. */
export function relationId(value: unknown): string | number | null {
  if (value && typeof value === 'object') value = (value as { id?: unknown }).id
  return typeof value === 'string' || typeof value === 'number' ? value : null
}

/** ISO string → epoch ms; empty → null; unparseable → NaN. */
const time = (value?: string | null): number | null => (value ? new Date(value).getTime() : null)

const sameId = (a: unknown, b: unknown) =>
  String(relationId(a) ?? '') === String(relationId(b) ?? '')

export function balanceCents(amountCents: number, rows: { amount: number }[]): number {
  return amountCents - rows.reduce((sum, r) => sum + r.amount, 0)
}

const sameRow = (a: RedemptionRow, b: RedemptionRow) =>
  a.id === b.id &&
  a.amount === b.amount &&
  (a.note ?? '') === (b.note ?? '') &&
  time(a.redeemedAt) === time(b.redeemedAt) &&
  sameId(a.by, b.by) &&
  time(a.recordedAt) === time(b.recordedAt) &&
  sameId(a.recordedBy, b.recordedBy)

/**
 * Redemptions are append-only and never exceed the voucher amount. A new row needs a staff
 * member and a redemption date that is not in the future, not before the payment and not after
 * the validity. Returns an admin error or null.
 */
export function checkRedemptions({
  previous,
  next,
  amountCents,
  status,
  validUntil: until,
  paidAt,
  now,
}: {
  previous: RedemptionRow[]
  next: RedemptionRow[]
  amountCents: number
  status: string
  validUntil?: string | null
  paidAt?: string | null
  now: Date
}): string | null {
  if (next.length < previous.length || previous.some((row, i) => !sameRow(row, next[i])))
    return 'Frühere Einlösungen können nicht geändert oder gelöscht werden.'
  const added = next.slice(previous.length)
  if (added.length === 0) return null
  if (status !== 'paid')
    return 'Dieser Gutschein ist nicht einlösbar (nicht bezahlt oder storniert).'
  if (added.some((r) => !Number.isInteger(r.amount) || r.amount <= 0))
    return 'Der eingelöste Betrag muss größer als 0 sein.'
  const paid = time(paidAt)
  for (const row of added) {
    const at = time(row.redeemedAt)
    if (at === null || Number.isNaN(at)) return 'Bitte das Datum der Einlösung angeben.'
    if (at > now.getTime() + REDEMPTION_CLOCK_SKEW_MS)
      return 'Das Datum der Einlösung darf nicht in der Zukunft liegen.'
    if (paid !== null && at < paid)
      return 'Das Datum der Einlösung liegt vor dem Kauf des Gutscheins.'
    if (until && at > new Date(until).getTime())
      return 'Dieser Gutschein war am Datum der Einlösung bereits abgelaufen.'
    if (relationId(row.by) === null) return 'Bitte angeben, wer den Gutschein eingelöst hat.'
  }
  if (balanceCents(amountCents, next) < 0) return 'Der Betrag ist höher als der Restbetrag.'
  return null
}
