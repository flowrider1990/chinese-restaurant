import type { Payload } from 'payload'
import type { Voucher } from '@/payload-types'
import { sendVoucherMails } from './voucher-mails'
import { generateCode } from './voucher-code'
import { validUntil } from './voucher-rules'

export type SessionLike = {
  id: string
  payment_status?: string | null
  payment_intent?: string | { id: string } | null
  amount_total?: number | null
}

async function bySession(payload: Payload, sessionId: string): Promise<Voucher | null> {
  const res = await payload.find({
    collection: 'vouchers',
    where: { stripeSessionId: { equals: sessionId } },
    limit: 1,
    depth: 0,
  })
  return res.docs[0] ?? null
}

async function unusedCode(payload: Payload): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode()
    const taken = await payload.count({ collection: 'vouchers', where: { code: { equals: code } } })
    if (taken.totalDocs === 0) return code
  }
  throw new Error('Could not find an unused voucher code')
}

/**
 * pending → paid exactly once: the update only matches a still-pending voucher, so a repeated
 * webhook event changes nothing and sends no second mail.
 */
export async function markPaid(payload: Payload, session: SessionLike, now = new Date()) {
  const voucher = await bySession(payload, session.id)
  if (!voucher) {
    payload.logger.error(`Stripe session ${session.id}: no voucher found`)
    return 'unknown' as const
  }
  if (voucher.status !== 'pending') return 'already' as const
  if (typeof session.amount_total === 'number' && session.amount_total !== voucher.amount)
    payload.logger.error(
      `Voucher ${voucher.id}: paid ${session.amount_total} cents, expected ${voucher.amount}`,
    )

  const intent =
    typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id
  const result = await payload.update({
    collection: 'vouchers',
    where: { and: [{ id: { equals: voucher.id } }, { status: { equals: 'pending' } }] },
    data: {
      status: 'paid',
      code: await unusedCode(payload),
      paidAt: now.toISOString(),
      validUntil: validUntil(now),
      stripePaymentIntent: intent ?? null,
    },
  })
  if (result.errors.length > 0)
    throw new Error(`Voucher ${voucher.id}: ${result.errors[0].message}`)
  const updated = result.docs[0]
  if (!updated) return 'already' as const
  await sendVoucherMails(payload, updated as Voucher)
  return 'paid' as const
}

/** Checkout session timed out or the checkout could not start: a pending voucher becomes expired. */
export async function expireSession(payload: Payload, sessionId: string) {
  await payload.update({
    collection: 'vouchers',
    where: { and: [{ stripeSessionId: { equals: sessionId } }, { status: { equals: 'pending' } }] },
    data: { status: 'expired' },
  })
}

/** For the thank-you page. Reads our DB only; never exposes the code or personal data. */
export async function voucherStatusForSession(payload: Payload, sessionId: string) {
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return 'unknown' as const
  const v = await bySession(payload, sessionId)
  if (!v) return 'unknown' as const
  return v.status === 'paid'
    ? ('paid' as const)
    : v.status === 'pending'
      ? ('pending' as const)
      : ('unknown' as const)
}
