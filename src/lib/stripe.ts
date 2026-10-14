import Stripe from 'stripe'

/** This is a demo: only Stripe test-mode keys are accepted, so no real money can ever be charged. */
export function assertTestKey(key: string | undefined): string {
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set.')
  if (!key.startsWith('sk_test_'))
    throw new Error('Only Stripe test keys (sk_test_…) are allowed in this demo.')
  return key
}

let client: Stripe | null = null

/** Server-side Stripe client. Uses the API version pinned by the installed SDK. */
export function getStripe(): Stripe {
  return (client ??= new Stripe(assertTestKey(process.env.STRIPE_SECRET_KEY)))
}
