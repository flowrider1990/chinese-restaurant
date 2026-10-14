import { describe, expect, it } from 'vitest'
import { CODE_PATTERN, generateCode } from '@/lib/voucher-code'
import {
  balanceCents,
  checkRedemptions,
  checkVoucherRequest,
  parseWholeEuros,
  validUntil,
  type VoucherInput,
} from '@/lib/voucher-rules'

const valid: VoucherInput = {
  amount: '50',
  buyerName: 'Mei Lin',
  buyerEmail: 'mei@example.com',
  privacy: true,
}

describe('parseWholeEuros', () => {
  it('accepts whole euros, trimming spaces', () => {
    expect(parseWholeEuros('50')).toBe(50)
    expect(parseWholeEuros(' 30 ')).toBe(30)
  })
  it('rejects decimals, exponents, signs and text', () => {
    for (const raw of ['25,50', '25.5', '1e2', '-20', '+20', 'abc', '', '0x20'])
      expect(parseWholeEuros(raw)).toBeNull()
  })
})

describe('checkVoucherRequest', () => {
  it('accepts a complete request', () => {
    expect(checkVoucherRequest(valid)).toEqual({})
    expect(checkVoucherRequest({ ...valid, amount: '10' })).toEqual({})
    expect(checkVoucherRequest({ ...valid, amount: '300' })).toEqual({})
  })
  it('checks the amount bounds and format', () => {
    expect(checkVoucherRequest({ ...valid, amount: '9' }).amount).toBe('tooLow')
    expect(checkVoucherRequest({ ...valid, amount: '301' }).amount).toBe('tooHigh')
    expect(checkVoucherRequest({ ...valid, amount: '25,50' }).amount).toBe('invalid')
    expect(checkVoucherRequest({ ...valid, amount: '' }).amount).toBe('required')
  })
  it('checks names, e-mail, lengths and privacy', () => {
    expect(checkVoucherRequest({ ...valid, buyerName: '  ' }).buyerName).toBe('required')
    expect(checkVoucherRequest({ ...valid, buyerName: 'x'.repeat(101) }).buyerName).toBe('tooLong')
    expect(checkVoucherRequest({ ...valid, buyerEmail: 'nope' }).buyerEmail).toBe('invalid')
    expect(checkVoucherRequest({ ...valid, buyerEmail: '' }).buyerEmail).toBe('required')
    expect(checkVoucherRequest({ ...valid, recipientName: 'x'.repeat(81) }).recipientName).toBe(
      'tooLong',
    )
    expect(checkVoucherRequest({ ...valid, message: 'x'.repeat(201) }).message).toBe('tooLong')
    expect(checkVoucherRequest({ ...valid, privacy: false }).privacy).toBe('required')
  })
})

describe('validUntil', () => {
  it('is 31 December of the third following year, end of day in Berlin', () => {
    expect(validUntil(new Date('2026-10-14T10:00:00Z'))).toBe('2029-12-31T22:59:59.000Z')
  })
  it('uses the Berlin calendar year at New Year', () => {
    // 2026-12-31 23:30 UTC is already 2027-01-01 in Berlin.
    expect(validUntil(new Date('2026-12-31T23:30:00Z'))).toBe('2030-12-31T22:59:59.000Z')
  })
})

describe('balanceCents', () => {
  it('subtracts all redemptions', () => {
    expect(balanceCents(5000, [])).toBe(5000)
    expect(balanceCents(5000, [{ amount: 1290 }, { amount: 710 }])).toBe(3000)
  })
})

describe('checkRedemptions', () => {
  const now = new Date('2027-01-10T12:00:00Z')
  const base = { amountCents: 5000, status: 'paid', validUntil: '2029-12-31T22:59:59.000Z', now }
  const row = { id: 'a', amount: 2000, note: 'Tisch 4', redeemedAt: '2027-01-05T12:00:00.000Z' }

  it('allows appending within the balance', () => {
    expect(checkRedemptions({ ...base, previous: [row], next: [row, { amount: 3000 }] })).toBeNull()
  })
  it('allows saving without changes', () => {
    expect(
      checkRedemptions({ ...base, status: 'cancelled', previous: [row], next: [row] }),
    ).toBeNull()
  })
  it('rejects more than the balance', () => {
    expect(checkRedemptions({ ...base, previous: [row], next: [row, { amount: 3001 }] })).toMatch(
      /Restbetrag/,
    )
  })
  it('rejects zero, negative and non-integer cents', () => {
    expect(checkRedemptions({ ...base, previous: [], next: [{ amount: 0 }] })).toMatch(
      /größer als 0/,
    )
    expect(checkRedemptions({ ...base, previous: [], next: [{ amount: -100 }] })).toMatch(
      /größer als 0/,
    )
  })
  it('rejects changing or removing earlier rows', () => {
    expect(checkRedemptions({ ...base, previous: [row], next: [{ ...row, amount: 100 }] })).toMatch(
      /nicht geändert/,
    )
    expect(checkRedemptions({ ...base, previous: [row], next: [] })).toMatch(/nicht geändert/)
    expect(checkRedemptions({ ...base, previous: [row], next: [{ ...row, note: 'x' }] })).toMatch(
      /nicht geändert/,
    )
  })
  it('rejects new rows on unpaid, cancelled or expired vouchers', () => {
    expect(
      checkRedemptions({ ...base, status: 'pending', previous: [], next: [{ amount: 100 }] }),
    ).toMatch(/nicht einlösbar/)
    expect(
      checkRedemptions({ ...base, status: 'cancelled', previous: [], next: [{ amount: 100 }] }),
    ).toMatch(/nicht einlösbar/)
    expect(
      checkRedemptions({
        ...base,
        now: new Date('2030-01-01T00:00:00Z'),
        previous: [],
        next: [{ amount: 100 }],
      }),
    ).toMatch(/abgelaufen/)
  })
})

describe('generateCode', () => {
  it('matches the format and avoids look-alike characters', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateCode()
      expect(code).toMatch(CODE_PATTERN)
      expect(code.slice(3)).not.toMatch(/[01OIL]/)
    }
  })
})
