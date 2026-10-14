import { getPayload, type Payload } from 'payload'
import Stripe from 'stripe'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import config from '@/payload.config'
import { migrations } from '@/migrations'
import { expireSession, voucherStatusForSession } from '@/lib/voucher-fulfilment'
import { handleStripeEvent } from '@/lib/voucher-webhook'
import { CODE_PATTERN } from '@/lib/voucher-code'

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
      email: 'info@example.com',
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

describe('stripe webhook', () => {
  const stripe = new Stripe('sk_test_dummy') // signatures only; no network calls
  const secret = 'whsec_test_secret'

  const deliver = (event: object, sig?: string) => {
    const rawBody = JSON.stringify(event)
    const signature = sig ?? stripe.webhooks.generateTestHeaderString({ payload: rawBody, secret })
    return handleStripeEvent({ payload, stripe, rawBody, signature, secret })
  }
  const completed = (sessionId: string, type = 'checkout.session.completed') => ({
    id: `evt_${sessionId}`,
    object: 'event',
    type,
    data: {
      object: {
        id: sessionId,
        object: 'checkout.session',
        payment_status: 'paid',
        amount_total: 5000,
        payment_intent: 'pi_test_1',
      },
    },
  })

  it('marks the voucher paid once, sets code and validity, sends the mails once', async () => {
    const sent = vi.spyOn(payload, 'sendEmail').mockResolvedValue(undefined as never)
    const v = await payload.create({ collection: 'vouchers', data: voucherData() })
    expect(await voucherStatusForSession(payload, v.stripeSessionId!)).toBe('pending')

    const first = await deliver(completed(v.stripeSessionId!))
    expect(first.status).toBe(200)
    const paid = await payload.findByID({ collection: 'vouchers', id: v.id })
    expect(paid.status).toBe('paid')
    expect(paid.code).toMatch(CODE_PATTERN)
    expect(paid.validUntil).toMatch(/-12-31T22:59:59/)
    expect(paid.stripePaymentIntent).toBe('pi_test_1')
    expect(sent).toHaveBeenCalledTimes(2) // buyer + restaurant
    const buyerMail = sent.mock.calls[0][0] as { to: string; attachments?: { filename: string }[] }
    expect(buyerMail.to).toBe(v.buyerEmail)
    expect(buyerMail.attachments?.[0].filename).toBe(`gutschein-${paid.code}.pdf`)

    await deliver(completed(v.stripeSessionId!))
    await deliver(completed(v.stripeSessionId!, 'checkout.session.async_payment_succeeded'))
    expect(sent).toHaveBeenCalledTimes(2)
    expect((await payload.findByID({ collection: 'vouchers', id: v.id })).code).toBe(paid.code)

    // A late "expired" event never downgrades a paid voucher.
    await deliver({ ...completed(v.stripeSessionId!), type: 'checkout.session.expired' })
    expect((await payload.findByID({ collection: 'vouchers', id: v.id })).status).toBe('paid')
    expect(await voucherStatusForSession(payload, v.stripeSessionId!)).toBe('paid')
    sent.mockRestore()
  })

  it('rejects a bad signature without changing anything', async () => {
    const v = await payload.create({ collection: 'vouchers', data: voucherData() })
    const res = await deliver(completed(v.stripeSessionId!), 't=1,v1=deadbeef')
    expect(res.status).toBe(400)
    expect((await payload.findByID({ collection: 'vouchers', id: v.id })).status).toBe('pending')
  })

  it('ignores an unpaid completed session and expires on the expired event', async () => {
    const v = await payload.create({ collection: 'vouchers', data: voucherData() })
    const unpaid = completed(v.stripeSessionId!)
    unpaid.data.object.payment_status = 'unpaid'
    await deliver(unpaid)
    expect((await payload.findByID({ collection: 'vouchers', id: v.id })).status).toBe('pending')
    await deliver({ ...completed(v.stripeSessionId!), type: 'checkout.session.expired' })
    expect((await payload.findByID({ collection: 'vouchers', id: v.id })).status).toBe('expired')
  })

  it('keeps the voucher paid when the buyer mail fails', async () => {
    const sent = vi
      .spyOn(payload, 'sendEmail')
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValue(undefined as never)
    const v = await payload.create({ collection: 'vouchers', data: voucherData() })
    const res = await deliver(completed(v.stripeSessionId!))
    expect(res.status).toBe(200)
    expect((await payload.findByID({ collection: 'vouchers', id: v.id })).status).toBe('paid')
    const notice = sent.mock.calls[1][0] as { text: string }
    expect(notice.text).toMatch(/Achtung/)
    sent.mockRestore()
  })

  it('answers unknown sessions and other events with 200', async () => {
    expect((await deliver(completed('cs_test_unknown'))).status).toBe(200)
    expect(
      (
        await deliver({
          id: 'evt_x',
          object: 'event',
          type: 'customer.created',
          data: { object: {} },
        })
      ).status,
    ).toBe(200)
    expect(await voucherStatusForSession(payload, 'cs_test_unknown')).toBe('unknown')
    await expireSession(payload, 'cs_test_unknown') // no throw
  })

  it('refuses to work without a webhook secret', async () => {
    const res = await handleStripeEvent({
      payload,
      stripe,
      rawBody: '{}',
      signature: 'x',
      secret: undefined,
    })
    expect(res.status).toBe(500)
  })
})
