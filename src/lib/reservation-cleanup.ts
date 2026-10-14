import { timingSafeEqual } from 'crypto'
import type { Payload } from 'payload'
import { readReservationSettings } from './reservation-settings'

/**
 * Removes name, e-mail, phone and note from reservations whose date is older than the retention
 * period. Date, time, party size and status stay for anonymous statistics.
 */
export async function anonymiseExpiredReservations(
  payload: Payload,
  now = new Date(),
): Promise<number> {
  const { retentionDays } = await readReservationSettings(payload)
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000).toISOString()
  const expired = await payload.find({
    collection: 'reservations',
    where: { and: [{ startsAt: { less_than: cutoff } }, { anonymisedAt: { exists: false } }] },
    pagination: false,
    depth: 0,
  })
  for (const r of expired.docs) {
    await payload.update({
      collection: 'reservations',
      id: r.id,
      data: {
        name: '',
        email: '',
        phone: null,
        note: null,
        messageToGuest: null,
        anonymisedAt: now.toISOString(),
      },
    })
  }
  return expired.docs.length
}

/** Constant-time check of "Authorization: Bearer <secret>". An empty or missing secret never matches. */
export function isAuthorisedCron(
  authorization: string | null,
  secret: string | undefined,
): boolean {
  if (!secret || !authorization) return false
  const expected = Buffer.from(`Bearer ${secret}`)
  const given = Buffer.from(authorization)
  return given.length === expected.length && timingSafeEqual(given, expected)
}
