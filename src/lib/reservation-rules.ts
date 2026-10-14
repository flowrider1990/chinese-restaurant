/**
 * Reservation rules. Pure functions, shared by the form (to offer only valid times) and the
 * server (which re-checks every request). All times are wall-clock times in the restaurant's
 * time zone.
 */
import { DAYS, addDays, localParts, slotsFor, type Day, type Hours } from './opening-hours'

export type ReservationRules = {
  slotMinutes: number
  lastBookingBeforeCloseMinutes: number
  leadTimeMinutes: number
  horizonDays: number
  maxPartySize: number
}

export const DEFAULT_RULES: ReservationRules = {
  slotMinutes: 15,
  lastBookingBeforeCloseMinutes: 60,
  leadTimeMinutes: 60,
  horizonDays: 60,
  maxPartySize: 8,
}

export type ReservationInput = {
  date: string
  time: string
  partySize: number
  name: string
  email: string
  phone?: string
  note?: string
  privacy: boolean
}

export type Problem = 'required' | 'invalid' | 'notBookable' | 'tooMany' | 'tooFew' | 'tooLong'

const DEFAULT_TZ = 'Europe/Berlin'
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
const pad = (n: number) => String(n).padStart(2, '0')
const toTime = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`

/** A real calendar date in YYYY-MM-DD form (rejects 2026-13-40 and 2026-02-30). */
function isValidDate(date: string): boolean {
  const m = DATE.exec(date)
  if (!m) return false
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return d.toISOString().slice(0, 10) === date
}

function weekday(date: string): Day {
  // getUTCDay: 0 = Sunday … 6 = Saturday; DAYS starts with Monday.
  return DAYS[(new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7]
}

/** Minutes the zone is ahead of UTC at that instant (Berlin: 60 or 120). */
function offsetMinutes(at: Date, timeZone: string): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(at)
      .map((x) => [x.type, x.value]),
  )
  const asUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
  )
  return Math.round((asUtc - Math.floor(at.getTime() / 60000) * 60000) / 60000)
}

/** Wall-clock date and time in `timeZone` → the UTC instant. */
export function localToUtc(date: string, time: string, timeZone: string): Date {
  const [y, mo, d] = date.split('-').map(Number)
  const guess = Date.UTC(y, mo - 1, d, Number(time.slice(0, 2)), Number(time.slice(3, 5)))
  const first = guess - offsetMinutes(new Date(guess), timeZone) * 60000
  // Re-check with the offset at the result: differs only around a DST change.
  return new Date(guess - offsetMinutes(new Date(first), timeZone) * 60000)
}

export function normaliseEmail(value: string): string {
  return value.trim().toLowerCase()
}

/** First and last bookable date (YYYY-MM-DD) for the date picker. */
export function bookableRange(rules: ReservationRules, now: Date, timeZone = DEFAULT_TZ) {
  const today = localParts(now, timeZone).date
  return { min: today, max: addDays(today, rules.horizonDays) }
}

/** Bookable times (HH:MM) on `date`, or [] if the day cannot be booked. */
export function availableTimes(
  hours: Hours,
  rules: ReservationRules,
  date: string,
  now: Date,
): string[] {
  if (!isValidDate(date)) return []
  const timeZone = hours.timezone ?? DEFAULT_TZ
  const range = bookableRange(rules, now, timeZone)
  if (date < range.min || date > range.max) return []

  const earliest = now.getTime() + rules.leadTimeMinutes * 60000
  const result = new Set<string>()
  for (const slot of slotsFor(hours, date, weekday(date), timeZone)) {
    const open = minutes(slot.open)
    let close = minutes(slot.close)
    // A slot that runs past midnight: offer times only up to midnight (see spec).
    if (close <= open) close = 24 * 60
    const last = close - rules.lastBookingBeforeCloseMinutes
    const first = Math.ceil(open / rules.slotMinutes) * rules.slotMinutes
    for (let m = first; m <= last && m < 24 * 60; m += rules.slotMinutes) {
      const time = toTime(m)
      if (localToUtc(date, time, timeZone).getTime() >= earliest) result.add(time)
    }
  }
  return [...result].sort()
}

/** Field problems of a request; an empty object means the request is valid. */
export function checkRequest(
  input: ReservationInput,
  hours: Hours,
  rules: ReservationRules,
  now: Date,
): Partial<Record<keyof ReservationInput, Problem>> {
  const problems: Partial<Record<keyof ReservationInput, Problem>> = {}

  if (!input.date) problems.date = 'required'
  else if (!isValidDate(input.date)) problems.date = 'invalid'

  if (!input.time) problems.time = 'required'
  else if (!TIME.test(input.time)) problems.time = 'invalid'

  if (!problems.date && !problems.time) {
    const times = availableTimes(hours, rules, input.date, now)
    if (times.length === 0) problems.date = 'notBookable'
    else if (!times.includes(input.time)) problems.time = 'notBookable'
  }

  if (!Number.isInteger(input.partySize) || input.partySize < 1) problems.partySize = 'tooFew'
  else if (input.partySize > rules.maxPartySize) problems.partySize = 'tooMany'

  if (!input.name.trim()) problems.name = 'required'
  else if (input.name.trim().length > 100) problems.name = 'tooLong'

  const email = normaliseEmail(input.email)
  if (!email) problems.email = 'required'
  else if (!EMAIL.test(email) || email.length > 200) problems.email = 'invalid'

  if (input.phone && input.phone.trim().length > 40) problems.phone = 'tooLong'
  if (input.note && input.note.length > 500) problems.note = 'tooLong'
  if (!input.privacy) problems.privacy = 'required'

  return problems
}
