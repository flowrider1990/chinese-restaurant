import type { Payload } from 'payload'
import { DEFAULT_RULES, type ReservationRules } from './reservation-rules'

export type ReservationSettings = ReservationRules & {
  mode: 'form' | 'external' | 'off'
  externalUrl: string | null
  notificationEmail: string | null
  retentionDays: number
}

/** Settings with defaults for anything not saved yet (fresh database). */
export async function readReservationSettings(payload: Payload): Promise<ReservationSettings> {
  const s = await payload.findGlobal({ slug: 'reservation-settings', depth: 0 })
  return {
    mode: s.mode ?? 'form',
    externalUrl: s.externalUrl || null,
    notificationEmail: s.notificationEmail || null,
    slotMinutes: s.slotMinutes || DEFAULT_RULES.slotMinutes,
    lastBookingBeforeCloseMinutes:
      s.lastBookingBeforeCloseMinutes ?? DEFAULT_RULES.lastBookingBeforeCloseMinutes,
    leadTimeMinutes: s.leadTimeMinutes ?? DEFAULT_RULES.leadTimeMinutes,
    horizonDays: s.horizonDays || DEFAULT_RULES.horizonDays,
    maxPartySize: s.maxPartySize || DEFAULT_RULES.maxPartySize,
    retentionDays: s.retentionDays || 30,
  }
}
