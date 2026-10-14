import { getPayload, type Payload } from 'payload'
import Stripe from 'stripe'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import config from '@/payload.config'
import { migrations } from '@/migrations'
import { Vouchers } from '@/collections/Vouchers'
import { expireSession, voucherStatusForSession } from '@/lib/voucher-fulfilment'
import { handleStripeEvent } from '@/lib/voucher-webhook'
import { CODE_PATTERN } from '@/lib/voucher-code'
import { startVoucherCheckout } from '@/lib/voucher-checkout'
import { siteUrl } from '@/lib/seo'

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

  it('lets staff delete expired vouchers, but not paid or recently started ones', async () => {
    const user = await staffUser()
    const expired = await payload.create({
      collection: 'vouchers',
      data: voucherData({ status: 'expired' }),
    })
    await payload.delete({ collection: 'vouchers', id: expired.id, user, overrideAccess: false })
    await expect(payload.findByID({ collection: 'vouchers', id: expired.id })).rejects.toThrow()

    // Its Stripe page may still be open: deleting it could lose a payment.
    const pending = await payload.create({ collection: 'vouchers', data: voucherData() })
    await expect(
      payload.delete({ collection: 'vouchers', id: pending.id, user, overrideAccess: false }),
    ).rejects.toThrow()
    expect((await payload.findByID({ collection: 'vouchers', id: pending.id })).status).toBe(
      'pending',
    )

    // After an hour the Stripe page has long expired, so an abandoned pending voucher may go.
    const old = await payload.create({
      collection: 'vouchers',
      data: voucherData({ createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() }),
    })
    await payload.delete({ collection: 'vouchers', id: old.id, user, overrideAccess: false })
    await expect(payload.findByID({ collection: 'vouchers', id: old.id })).rejects.toThrow()
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

  it('sends the mails once when the same event arrives concurrently', async () => {
    const sent = vi.spyOn(payload, 'sendEmail').mockResolvedValue(undefined as never)
    const v = await payload.create({ collection: 'vouchers', data: voucherData() })
    await Promise.all([
      deliver(completed(v.stripeSessionId!)),
      deliver(completed(v.stripeSessionId!)),
      deliver(completed(v.stripeSessionId!, 'checkout.session.async_payment_succeeded')),
    ])
    const paid = await payload.findByID({ collection: 'vouchers', id: v.id })
    expect(paid.status).toBe('paid')
    expect(paid.code).toMatch(CODE_PATTERN)
    expect(sent).toHaveBeenCalledTimes(2) // buyer + restaurant, once
    const buyerMail = sent.mock.calls[0][0] as { attachments?: { filename: string }[] }
    expect(buyerMail.attachments?.[0].filename).toBe(`gutschein-${paid.code}.pdf`)
    sent.mockRestore()
  })

  it('expires a pending voucher when the async payment fails', async () => {
    const v = await payload.create({ collection: 'vouchers', data: voucherData() })
    await deliver(completed(v.stripeSessionId!, 'checkout.session.async_payment_failed'))
    expect((await payload.findByID({ collection: 'vouchers', id: v.id })).status).toBe('expired')
  })

  it('logs an error and changes nothing when a paid session arrives for an expired voucher', async () => {
    const sent = vi.spyOn(payload, 'sendEmail').mockResolvedValue(undefined as never)
    const logged = vi.spyOn(payload.logger, 'error').mockImplementation(() => undefined as never)
    const v = await payload.create({
      collection: 'vouchers',
      data: voucherData({ status: 'expired' }),
    })
    const res = await deliver(completed(v.stripeSessionId!))
    expect(res.status).toBe(200)
    const after = await payload.findByID({ collection: 'vouchers', id: v.id })
    expect(after.status).toBe('expired')
    expect(after.code).toBeFalsy()
    expect(sent).not.toHaveBeenCalled()
    const messages = logged.mock.calls.map((c) => String(c[0]))
    expect(
      messages.some(
        (m) => m.includes(String(v.id)) && m.includes('expired') && m.includes(v.stripeSessionId!),
      ),
    ).toBe(true)
    sent.mockRestore()
    logged.mockRestore()
  })

  it('the collection endpoint passes the raw body to signature verification', async () => {
    const endpoint = Vouchers.endpoints
      ? Vouchers.endpoints.find((e) => e.path === '/stripe-webhook')
      : undefined
    expect(endpoint).toBeDefined()
    const saved = {
      STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    }
    process.env.STRIPE_WEBHOOK_SECRET = secret
    if (!saved.STRIPE_SECRET_KEY?.startsWith('sk_test_'))
      process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'
    const sent = vi.spyOn(payload, 'sendEmail').mockResolvedValue(undefined as never)
    try {
      const call = (rawBody: string, signature: string) =>
        (endpoint!.handler as (req: unknown) => Promise<Response>)({
          payload,
          headers: new Headers({ 'stripe-signature': signature }),
          text: () => Promise.resolve(rawBody),
        })
      const v = await payload.create({ collection: 'vouchers', data: voucherData() })
      const rawBody = JSON.stringify(completed(v.stripeSessionId!))

      const bad = await call(rawBody, 't=1,v1=deadbeef')
      expect(bad.status).toBe(400)
      expect((await payload.findByID({ collection: 'vouchers', id: v.id })).status).toBe('pending')

      const good = await call(
        rawBody,
        stripe.webhooks.generateTestHeaderString({ payload: rawBody, secret }),
      )
      expect(good.status).toBe(200)
      expect((await payload.findByID({ collection: 'vouchers', id: v.id })).status).toBe('paid')
    } finally {
      sent.mockRestore()
      for (const [name, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[name]
        else process.env[name] = value
      }
    }
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

describe('startVoucherCheckout', () => {
  const input = {
    amount: '50',
    buyerName: ' Mei Lin ',
    buyerEmail: 'Checkout@Example.com',
    recipientName: 'Jonas',
    message: 'Alles Gute',
    privacy: true,
  }

  it('creates a pending voucher and a Stripe session with the server-checked amount', async () => {
    const minExpiry = Math.floor(Date.now() / 1000) + 30 * 60
    const create = vi.fn().mockResolvedValue({
      id: 'cs_test_checkout_1',
      url: 'https://checkout.stripe.com/c/pay/cs_test_checkout_1',
    })
    const res = await startVoucherCheckout({
      payload,
      stripe: () => ({ checkout: { sessions: { create } } }) as never,
      input,
      locale: 'en',
    })
    expect(res).toEqual({ ok: true, url: 'https://checkout.stripe.com/c/pay/cs_test_checkout_1' })

    const params = create.mock.calls[0][0]
    expect(params.mode).toBe('payment')
    expect(params.line_items[0].price_data).toMatchObject({ currency: 'eur', unit_amount: 5000 })
    expect(params.line_items[0].price_data.product_data.name).toBe('Gift voucher Test')
    expect(params.customer_email).toBe('checkout@example.com')
    expect(params.locale).toBe('en')
    expect(params.success_url).toBe(`${siteUrl}/en/vouchers?session_id={CHECKOUT_SESSION_ID}`)
    expect(params.cancel_url).toBe(`${siteUrl}/en/vouchers`)

    const stored = await payload.find({
      collection: 'vouchers',
      where: { stripeSessionId: { equals: 'cs_test_checkout_1' } },
    })
    expect(stored.docs[0]).toMatchObject({
      status: 'pending',
      amount: 5000,
      buyerName: 'Mei Lin',
      buyerEmail: 'checkout@example.com',
      locale: 'en',
    })
    expect(params.metadata.voucherId).toBe(String(stored.docs[0].id))
    expect(params.client_reference_id).toBe(String(stored.docs[0].id))
    expect(params.expires_at).toBeGreaterThanOrEqual(minExpiry)
  })

  it('returns problems without calling Stripe', async () => {
    const create = vi.fn()
    const res = await startVoucherCheckout({
      payload,
      stripe: () => ({ checkout: { sessions: { create } } }) as never,
      input: { ...input, amount: '25,50' },
      locale: 'de',
    })
    expect(res).toEqual({ ok: false, problems: { amount: 'invalid' } })
    expect(create).not.toHaveBeenCalled()
  })

  it('reports Stripe as unavailable and expires the pending voucher when Stripe fails', async () => {
    const before = await payload.count({
      collection: 'vouchers',
      where: { status: { equals: 'pending' } },
    })
    const res = await startVoucherCheckout({
      payload,
      stripe: () =>
        ({
          checkout: { sessions: { create: vi.fn().mockRejectedValue(new Error('network')) } },
        }) as never,
      input: { ...input, buyerEmail: 'stripe-fails@example.com' },
      locale: 'de',
    })
    expect(res).toEqual({ ok: false, problems: {}, unavailable: true })
    const expired = await payload.find({
      collection: 'vouchers',
      where: { buyerEmail: { equals: 'stripe-fails@example.com' } },
    })
    expect(expired.docs.map((d) => d.status)).toContain('expired')
    const after = await payload.count({
      collection: 'vouchers',
      where: { status: { equals: 'pending' } },
    })
    expect(after.totalDocs).toBe(before.totalDocs)
  })

  it('reports Stripe as unavailable when the key is missing', async () => {
    const res = await startVoucherCheckout({
      payload,
      stripe: () => {
        throw new Error('STRIPE_SECRET_KEY is not set.')
      },
      input,
      locale: 'de',
    })
    expect(res).toEqual({ ok: false, problems: {}, unavailable: true })
  })

  it('ignores a filled honeypot without creating anything', async () => {
    const before = await payload.count({ collection: 'vouchers' })
    const res = await startVoucherCheckout({
      payload,
      stripe: () => {
        throw new Error('must not be called')
      },
      input: { ...input, website: 'spam' },
      locale: 'de',
    })
    expect(res.ok).toBe(false)
    expect((await payload.count({ collection: 'vouchers' })).totalDocs).toBe(before.totalDocs)
  })
})
