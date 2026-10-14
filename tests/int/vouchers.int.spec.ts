import { getPayload, type Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'
import config from '@/payload.config'
import { migrations } from '@/migrations'

let payload: Payload

beforeAll(async () => {
  payload = await getPayload({ config })
  await payload.db.migrate({ migrations: migrations as never })
  // Later voucher tests read the restaurant name; seed it so this file passes on its own.
  await payload.updateGlobal({
    slug: 'site-settings',
    data: {
      name: 'Test',
      phone: '030 1',
      phoneE164: '+49301234567',
      address: { street: 'A 1', postalCode: '10115', city: 'Berlin', country: 'DE' },
    },
  })
})

let n = 0
/** Unique session ids/e-mails: the test DB is shared by all tests in this file. */
const voucherData = (over: Record<string, unknown> = {}) => ({
  status: 'pending' as const,
  amount: 5000,
  buyerName: 'Mei Lin',
  buyerEmail: `mei${++n}@example.com`,
  locale: 'de' as const,
  stripeSessionId: `cs_test_${Date.now()}_${n}`,
  ...over,
})

async function staffUser() {
  const email = `staff${++n}@example.com`
  return payload.create({ collection: 'users', data: { email, password: 'test-password-123' } })
}

/** ValidationError's message is generic; the admin shows the per-field texts from `data.errors`. */
async function fieldErrors(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (error) {
    const errors = (error as { data?: { errors?: { message: string }[] } }).data?.errors ?? []
    return errors.map((e) => e.message).join(' | ')
  }
  throw new Error('expected the promise to be rejected')
}

describe('vouchers collection', () => {
  it('stores the balance equal to the amount on create', async () => {
    const v = await payload.create({ collection: 'vouchers', data: voucherData() })
    expect(v.balance).toBe(5000)
    expect(v.code ?? null).toBeNull()
  })

  it('is not readable or creatable for anonymous visitors', async () => {
    await expect(payload.find({ collection: 'vouchers', overrideAccess: false })).rejects.toThrow(
      /keine Berechtigung/,
    )
    await expect(
      payload.create({ collection: 'vouchers', overrideAccess: false, data: voucherData() }),
    ).rejects.toThrow(/keine Berechtigung/)
  })

  it('lets staff append redemptions up to the balance, stamped with time and user', async () => {
    const user = await staffUser()
    const v = await payload.create({
      collection: 'vouchers',
      data: voucherData({
        status: 'paid',
        code: `XC-TEST-${n}`,
        validUntil: '2099-12-31T22:59:59.000Z',
      }),
    })
    const once = await payload.update({
      collection: 'vouchers',
      id: v.id,
      user,
      overrideAccess: false,
      data: { redemptions: [{ amount: 1290, note: 'Tisch 4' }] },
    })
    expect(once.balance).toBe(3710)
    expect(once.redemptions?.[0].redeemedAt).toBeTruthy()
    const by = once.redemptions?.[0].by
    expect(typeof by === 'object' ? by?.id : by).toBe(user.id)

    expect(
      await fieldErrors(
        payload.update({
          collection: 'vouchers',
          id: v.id,
          user,
          overrideAccess: false,
          data: { redemptions: [...(once.redemptions ?? []), { amount: 3711 }] },
        }),
      ),
    ).toMatch(/Restbetrag/)

    expect(
      await fieldErrors(
        payload.update({
          collection: 'vouchers',
          id: v.id,
          user,
          overrideAccess: false,
          data: { redemptions: [{ ...once.redemptions![0], amount: 1 }] },
        }),
      ),
    ).toMatch(/nicht geändert/)
  })

  it('keeps who made an earlier redemption when another staff member saves', async () => {
    const first = await staffUser()
    const second = await staffUser()
    const v = await payload.create({
      collection: 'vouchers',
      data: voucherData({ status: 'paid', validUntil: '2099-12-31T22:59:59.000Z' }),
    })
    const once = await payload.update({
      collection: 'vouchers',
      id: v.id,
      user: first,
      overrideAccess: false,
      data: { redemptions: [{ amount: 1000 }] },
    })
    const row = once.redemptions![0]
    const twice = await payload.update({
      collection: 'vouchers',
      id: v.id,
      user: second,
      overrideAccess: false,
      data: { redemptions: [{ ...row, by: second.id }, { amount: 500 }] },
    })
    const idOf = (b: unknown) => (typeof b === 'object' && b ? (b as { id: number }).id : b)
    expect(idOf(twice.redemptions![0].by)).toBe(first.id)
    expect(idOf(twice.redemptions![1].by)).toBe(second.id)
    expect(twice.balance).toBe(3500)
  })

  it('lets staff cancel a paid voucher but not change other statuses', async () => {
    const user = await staffUser()
    const paid = await payload.create({
      collection: 'vouchers',
      data: voucherData({ status: 'paid' }),
    })
    const cancelled = await payload.update({
      collection: 'vouchers',
      id: paid.id,
      user,
      overrideAccess: false,
      data: { status: 'cancelled' },
    })
    expect(cancelled.status).toBe('cancelled')

    const pending = await payload.create({ collection: 'vouchers', data: voucherData() })
    expect(
      await fieldErrors(
        payload.update({
          collection: 'vouchers',
          id: pending.id,
          user,
          overrideAccess: false,
          data: { status: 'paid' },
        }),
      ),
    ).toMatch(/Status/)
  })

  it('lets staff delete pending or expired vouchers only', async () => {
    const user = await staffUser()
    const pending = await payload.create({ collection: 'vouchers', data: voucherData() })
    await payload.delete({ collection: 'vouchers', id: pending.id, user, overrideAccess: false })
    const paid = await payload.create({
      collection: 'vouchers',
      data: voucherData({ status: 'paid' }),
    })
    await expect(
      payload.delete({ collection: 'vouchers', id: paid.id, user, overrideAccess: false }),
    ).rejects.toThrow()
  })
})
