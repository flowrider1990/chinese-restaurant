/**
 * Opening-hours logic. Pure functions, no Payload or React imports, so the client "open now"
 * badge and the server can share it.
 */

export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
export type Day = (typeof DAYS)[number]

export type Slot = { open: string; close: string }
export type Hours = {
  timezone?: string | null
  weekly?: { day: Day; slots: Slot[] }[] | null
  exceptions?:
    | { from: string; to?: string | null; closed?: boolean | null; slots?: Slot[] | null; note?: string | null }[]
    | null
}

export type Status =
  | { open: true; closesAt: string }
  | { open: false; opensAt: { day: Day; time: string; today: boolean } | null }

const DEFAULT_TZ = 'Europe/Berlin'
const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))

/** Calendar date ("2026-10-14") and weekday of an instant in the restaurant's time zone. */
export function localParts(date: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  )
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    day: parts.weekday.slice(0, 3).toLowerCase() as Day,
    minute: Number(parts.hour) * 60 + Number(parts.minute),
  }
}

/** Adds whole days to a "YYYY-MM-DD" date. */
export function addDays(isoDate: string, n: number) {
  const d = new Date(`${isoDate}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Slots that apply on a given local date: an exception wins over the weekly plan. */
export function slotsFor(hours: Hours, isoDate: string, day: Day, timeZone = hours.timezone ?? DEFAULT_TZ): Slot[] {
  const exception = hours.exceptions?.find((e) => {
    const from = localParts(new Date(e.from), timeZone).date
    const to = e.to ? localParts(new Date(e.to), timeZone).date : from
    return isoDate >= from && isoDate <= to
  })
  if (exception) return exception.closed ? [] : (exception.slots ?? [])
  return hours.weekly?.find((w) => w.day === day)?.slots ?? []
}

/**
 * Open/closed at `now`. A slot whose closing time is not after its opening time (e.g. 18:00–01:00)
 * runs past midnight into the next day.
 */
export function getStatus(hours: Hours, now: Date = new Date()): Status {
  const timeZone = hours.timezone ?? DEFAULT_TZ
  const today = localParts(now, timeZone)
  const yesterdayDate = addDays(today.date, -1)
  const yesterdayDay = DAYS[(DAYS.indexOf(today.day) + 6) % 7]

  // Still inside yesterday's slot that runs past midnight?
  for (const s of slotsFor(hours, yesterdayDate, yesterdayDay, timeZone)) {
    const close = minutes(s.close)
    if (close <= minutes(s.open) && today.minute < close) return { open: true, closesAt: s.close }
  }
  for (const s of slotsFor(hours, today.date, today.day, timeZone)) {
    const open = minutes(s.open)
    const close = minutes(s.close)
    const overnight = close <= open
    if (today.minute >= open && (overnight || today.minute < close)) return { open: true, closesAt: s.close }
  }

  // Closed: find the next opening within a week.
  for (let i = 0; i < 8; i++) {
    const date = addDays(today.date, i)
    const day = DAYS[(DAYS.indexOf(today.day) + i) % 7]
    const next = slotsFor(hours, date, day, timeZone)
      .filter((s) => i > 0 || minutes(s.open) > today.minute)
      .sort((a, b) => minutes(a.open) - minutes(b.open))[0]
    if (next) return { open: false, opensAt: { day, time: next.open, today: i === 0 } }
  }
  return { open: false, opensAt: null }
}

/** Weekly plan grouped into runs of consecutive days with identical slots (for footers and lists). */
export function weeklySummary(hours: Hours): { days: Day[]; slots: Slot[] }[] {
  const key = (slots: Slot[]) => slots.map((s) => `${s.open}-${s.close}`).join(',')
  const groups: { days: Day[]; slots: Slot[] }[] = []
  for (const day of DAYS) {
    const slots = hours.weekly?.find((w) => w.day === day)?.slots ?? []
    const last = groups.at(-1)
    if (last && key(last.slots) === key(slots)) last.days.push(day)
    else groups.push({ days: [day], slots })
  }
  return groups
}
