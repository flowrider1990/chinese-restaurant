import type { Payload } from 'payload'
import type Stripe from 'stripe'
import { href } from '@/i18n/routes'
import { absolute } from './seo'
import {
  checkVoucherRequest,
  parseWholeEuros,
  type VoucherInput,
  type VoucherProblem,
} from './voucher-rules'

export type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; problems: Partial<Record<keyof VoucherInput, VoucherProblem>>; unavailable?: true }

const SESSION_MINUTES = 30
const unavailable = { ok: false, problems: {}, unavailable: true } as const

/**
 * Checks the request again on the server, stores a pending voucher and opens a Stripe Checkout
 * Session for it. Kept outside the Server Action so it can be tested without Next.js.
 */
export async function startVoucherCheckout({
  payload,
  stripe,
  input,
  locale,
  now = new Date(),
}: {
  payload: Payload
  stripe: () => Pick<Stripe, 'checkout'>
  input: VoucherInput & { website?: string }
  locale: 'de' | 'en'
  now?: Date
}): Promise<CheckoutResult> {
  // Honeypot: humans never see the field.
  if (input.website) return { ok: false, problems: {} }
  const problems = checkVoucherRequest(input)
  if (Object.keys(problems).length > 0) return { ok: false, problems }

  let client: Pick<Stripe, 'checkout'>
  try {
    client = stripe()
  } catch (error) {
    payload.logger.error(
      `Voucher checkout: ${error instanceof Error ? error.message : String(error)}`,
    )
    return unavailable
  }

  const cents = parseWholeEuros(input.amount)! * 100
  const email = input.buyerEmail.trim().toLowerCase()
  const { name } = await payload.findGlobal({ slug: 'site-settings', depth: 0, locale })
  const voucher = await payload.create({
    collection: 'vouchers',
    data: {
      status: 'pending',
      amount: cents,
      buyerName: input.buyerName.trim(),
      buyerEmail: email,
      recipientName: input.recipientName?.trim() || undefined,
      message: input.message?.trim() || undefined,
      locale,
      privacyAcceptedAt: now.toISOString(),
    },
  })

  const page = absolute(href('vouchers', locale))
  try {
    const session = await client.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: cents,
            product_data: { name: `${locale === 'en' ? 'Gift voucher' : 'Gutschein'} ${name}` },
          },
        },
      ],
      customer_email: email,
      locale,
      client_reference_id: String(voucher.id),
      metadata: { voucherId: String(voucher.id) },
      expires_at: Math.floor(now.getTime() / 1000) + SESSION_MINUTES * 60,
      // Stripe replaces {CHECKOUT_SESSION_ID}; it must not be URL-encoded.
      success_url: `${page}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: page,
    })
    if (!session.url) throw new Error(`Session ${session.id} has no URL`)
    await payload.update({
      collection: 'vouchers',
      id: voucher.id,
      data: { stripeSessionId: session.id },
    })
    return { ok: true, url: session.url }
  } catch (error) {
    payload.logger.error(
      `Voucher ${voucher.id}: checkout failed: ${error instanceof Error ? error.message : String(error)}`,
    )
    await payload.update({ collection: 'vouchers', id: voucher.id, data: { status: 'expired' } })
    return unavailable
  }
}
