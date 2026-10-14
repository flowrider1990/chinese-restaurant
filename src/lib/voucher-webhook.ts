import type { Payload } from 'payload'
import type Stripe from 'stripe'
import { expireSession, markPaid, type SessionLike } from './voucher-fulfilment'

/**
 * Verifies a Stripe webhook and applies it. 400 for a bad signature (nothing changed), 500 when
 * our side failed (Stripe retries), 200 otherwise, including events we do not handle.
 */
export async function handleStripeEvent({
  payload,
  stripe,
  rawBody,
  signature,
  secret,
}: {
  payload: Payload
  stripe: Stripe
  rawBody: string
  signature: string | null
  secret: string | undefined
}): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!secret) {
    payload.logger.error('STRIPE_WEBHOOK_SECRET is not set; Stripe webhooks are rejected.')
    return { status: 500, body: { error: 'Webhook not configured' } }
  }
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature ?? '', secret)
  } catch {
    return { status: 400, body: { error: 'Invalid signature' } }
  }

  try {
    const session = event.data.object as SessionLike
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        if (session.payment_status === 'paid') await markPaid(payload, session)
        break
      case 'checkout.session.expired':
      case 'checkout.session.async_payment_failed':
        await expireSession(payload, session.id)
        break
    }
    return { status: 200, body: { received: true } }
  } catch (error) {
    payload.logger.error(
      `Stripe event ${event.id}: ${error instanceof Error ? error.message : String(error)}`,
    )
    return { status: 500, body: { error: 'Processing failed' } }
  }
}
