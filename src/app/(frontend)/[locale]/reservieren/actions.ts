'use server'

import { payloadClient } from '@/lib/queries'
import { submitReservation, type SubmitResult } from '@/lib/reservation-submit'

/** Form submit. Every rule is checked again on the server inside submitReservation. */
export async function requestReservationAction(
  _prev: SubmitResult | null,
  form: FormData,
): Promise<SubmitResult> {
  const str = (key: string) => {
    const v = form.get(key)
    return typeof v === 'string' ? v : ''
  }
  const locale = str('locale') === 'en' ? 'en' : 'de'
  return submitReservation({
    payload: await payloadClient(),
    locale,
    input: {
      date: str('date'),
      time: str('time'),
      partySize: Number.parseInt(str('partySize'), 10),
      name: str('name'),
      email: str('email'),
      phone: str('phone') || undefined,
      note: str('note') || undefined,
      privacy: form.get('privacy') === 'on',
      website: str('website') || undefined,
    },
  })
}
