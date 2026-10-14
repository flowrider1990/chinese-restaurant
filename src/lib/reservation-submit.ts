import type { Payload } from 'payload'
import type { Hours } from './opening-hours'
import {
  checkRequest,
  normaliseEmail,
  type Problem,
  type ReservationInput,
} from './reservation-rules'
import { readReservationSettings } from './reservation-settings'

export type SubmitResult =
  | { ok: true; date: string; time: string; partySize: number }
  | { ok: false; problems: Partial<Record<keyof ReservationInput, Problem>>; closed?: true }

const DUPLICATE_WINDOW_MS = 10 * 60 * 1000

/**
 * Validates a guest's request against the current rules and stores it. Used by the Server Action;
 * kept separate so it can be tested without Next.js.
 */
export async function submitReservation({
  payload,
  input,
  locale,
  now = new Date(),
}: {
  payload: Payload
  input: ReservationInput & { website?: string }
  locale: 'de' | 'en'
  now?: Date
}): Promise<SubmitResult> {
  const done = { ok: true as const, date: input.date, time: input.time, partySize: input.partySize }
  // Honeypot: humans never see the field. Answer like a success so bots learn nothing.
  if (input.website) return done

  const settings = await readReservationSettings(payload)
  if (settings.mode !== 'form') return { ok: false, problems: {}, closed: true }

  const hours = (await payload.findGlobal({ slug: 'opening-hours', depth: 0 })) as Hours
  const problems = checkRequest(input, hours, settings, now)
  if (Object.keys(problems).length > 0) return { ok: false, problems }

  const email = normaliseEmail(input.email)
  const duplicate = await payload.count({
    collection: 'reservations',
    where: {
      and: [
        { email: { equals: email } },
        { date: { equals: input.date } },
        { time: { equals: input.time } },
        {
          createdAt: { greater_than: new Date(now.getTime() - DUPLICATE_WINDOW_MS).toISOString() },
        },
      ],
    },
  })
  if (duplicate.totalDocs > 0) return done

  await payload.create({
    collection: 'reservations',
    data: {
      date: input.date,
      time: input.time,
      partySize: input.partySize,
      name: input.name.trim(),
      email,
      phone: input.phone?.trim() || undefined,
      note: input.note?.trim() || undefined,
      locale,
      source: 'website',
      status: 'requested',
      privacyAcceptedAt: now.toISOString(),
    },
  })
  return done
}
