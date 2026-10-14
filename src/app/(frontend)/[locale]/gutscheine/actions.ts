'use server'

import { redirect } from 'next/navigation'
import { payloadClient } from '@/lib/queries'
import { getStripe } from '@/lib/stripe'
import { startVoucherCheckout, type CheckoutResult } from '@/lib/voucher-checkout'

/** Form submit. Every rule is checked again on the server inside startVoucherCheckout. */
export async function buyVoucherAction(
  _prev: CheckoutResult | null,
  form: FormData,
): Promise<CheckoutResult> {
  const str = (key: string) => {
    const v = form.get(key)
    return typeof v === 'string' ? v : ''
  }
  const choice = str('amount')
  const result = await startVoucherCheckout({
    payload: await payloadClient(),
    stripe: getStripe,
    locale: str('locale') === 'en' ? 'en' : 'de',
    input: {
      amount: choice === 'other' ? str('customAmount') : choice,
      buyerName: str('buyerName'),
      buyerEmail: str('buyerEmail'),
      recipientName: str('recipientName') || undefined,
      message: str('message') || undefined,
      privacy: form.get('privacy') === 'on',
      website: str('website') || undefined,
    },
  })
  // redirect() throws; it must stay outside any try/catch (Next.js docs: functions/redirect.md).
  if (result.ok) redirect(result.url)
  return result
}
