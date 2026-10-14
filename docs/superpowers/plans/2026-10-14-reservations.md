# Table Reservations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guests request a table on the website; the restaurant confirms or declines in the Payload admin; e-mails inform both sides; personal data is removed after one month.

**Architecture:** A pure rules module (shared by browser and server) decides which dates and times are bookable. A `reservations` collection plus a `reservation-settings` global live in Payload; a Server Action validates and stores requests through a testable core function; collection hooks send e-mails through Payload's email adapter (Resend when configured, console otherwise); a cleanup function runs from a protected endpoint or a script.

**Tech Stack:** Next.js 16.3.8 App Router, Payload 3.90.2 (`@payloadcms/db-sqlite`, new `@payloadcms/email-resend` 3.90.2), TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-14-reservations-design.md`

## Global Constraints

- Request model only: status `requested` → `confirmed` | `declined`, set manually in the admin. No capacity or table logic.
- Required guest fields: name, e-mail. Optional: phone, note (max. 500 characters).
- Defaults (all editable in the admin): slots every 15 minutes; last booking 60 minutes before each opening slot ends; lead time 60 minutes; horizon 60 days; party size 1–8; retention 30 days.
- Time zone `Europe/Berlin` (from the opening-hours global); exceptions override weekly hours.
- No third-party scripts on public pages; no captcha; honeypot field only.
- The server is authoritative for every rule; the browser computation is a convenience.
- Mails: new request → restaurant + guest receipt; status → confirmed/declined → guest. Language = guest's site language. A failed send is logged and never undoes the save.
- Without `RESEND_API_KEY`, mails go to the server log (Payload's console fallback).
- Routes: `/reservieren` (de), `/en/reserve` (en), route key `reserve`.
- Settings `mode`: `form` (default) / `external` (links go to `externalUrl`, new tab) / `off` (links hidden, page 404).
- Every new upload/relationship column needs `ON DELETE set null` by hand (see `docs/architecture.md` → Known issues). This plan adds none.
- Copy follows the existing tone: German default, English translation, sentence case, no exclamation marks.
- Run `pnpm verify` before every commit that touches code; it must exit 0.

## Review Focus

1. **Manipulated form values** (a time not on the 15-minute grid, a date outside the horizon, party size 0 or 99, a date string like `2026-13-40`) — rejected with a field error, nothing stored. Test in Task 1 (`checkRequest`) and Task 3 (`submitReservation`).
2. **Reservations entered by staff in the admin** (e.g. a phone booking) — no "new request" mails to the restaurant or the guest. Test in Task 4.
3. **Saving a reservation without changing its status** (or changing only the note) — no second mail to the guest. Test in Task 4.
4. **Same guest, different spelling** (`Max@Example.com ` vs `max@example.com`) submitting twice within 10 minutes — stored once; e-mail stored trimmed and lower-cased. Test in Task 3.
5. **Fresh database without saved reservation settings** — defaults apply and the form works. Test in Task 3.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/opening-hours.ts` (modify) | Export `localParts` and `addDays` for reuse. |
| `src/lib/reservation-rules.ts` (create) | Pure rules: defaults, `availableTimes`, `bookableRange`, `checkRequest`, `localToUtc`, `normaliseEmail`. |
| `src/globals/ReservationSettings.ts` (create) | Admin settings global. |
| `src/collections/Reservations.ts` (create) | Collection, access, `startsAt` hook, mail hooks, cleanup endpoint. |
| `src/lib/reservation-settings.ts` (create) | `readReservationSettings(payload)` → settings merged with defaults. |
| `src/lib/reservation-submit.ts` (create) | `submitReservation(...)` core used by the Server Action. |
| `src/lib/reservation-mails.ts` (create) | Mail texts (DE/EN) and `sendReservationMail`. |
| `src/lib/reservation-cleanup.ts` (create) | `anonymiseExpiredReservations`, `isAuthorisedCron`. |
| `scripts/reservations-cleanup.ts` (create) | CLI wrapper for the cleanup. |
| `src/app/(frontend)/[locale]/reservieren/page.tsx`, `ReservationForm.tsx`, `actions.ts` (create) | Public page, client form, Server Action. |
| `src/components/site/*` (modify) | Navigation, hero button, mobile bar with four items. |
| `src/i18n/routes.ts`, `src/i18n/dictionary.ts` (modify) | Route `reserve`, texts. |
| `src/payload.config.ts` (modify) | Register collection/global, e-mail adapter. |
| Tests | `tests/unit/reservation-rules.test.ts`, `tests/int/reservations.int.spec.ts`. |

---

### Task 1: Reservation rules (pure)

**Files:**
- Modify: `src/lib/opening-hours.ts` (export `localParts`, `addDays`)
- Create: `src/lib/reservation-rules.ts`
- Test: `tests/unit/reservation-rules.test.ts`

**Interfaces:**
- Consumes: `Hours`, `Day`, `DAYS`, `slotsFor(hours, isoDate, day, timeZone)` from `src/lib/opening-hours.ts`.
- Produces:
  - `type ReservationRules = { slotMinutes: number; lastBookingBeforeCloseMinutes: number; leadTimeMinutes: number; horizonDays: number; maxPartySize: number }`
  - `const DEFAULT_RULES: ReservationRules`
  - `type ReservationInput = { date: string; time: string; partySize: number; name: string; email: string; phone?: string; note?: string; privacy: boolean }`
  - `type Problem = 'required' | 'invalid' | 'notBookable' | 'tooMany' | 'tooFew' | 'tooLong'`
  - `availableTimes(hours: Hours, rules: ReservationRules, date: string, now: Date): string[]`
  - `bookableRange(rules: ReservationRules, now: Date, timeZone?: string): { min: string; max: string }`
  - `checkRequest(input: ReservationInput, hours: Hours, rules: ReservationRules, now: Date): Partial<Record<keyof ReservationInput, Problem>>`
  - `localToUtc(date: string, time: string, timeZone: string): Date`
  - `normaliseEmail(value: string): string`

- [ ] **Step 1: Export the two helpers from opening-hours**

In `src/lib/opening-hours.ts` change `function localParts(` to `export function localParts(` and `function addDays(` to `export function addDays(`. No behaviour change.

- [ ] **Step 2: Write the failing tests**

Create `tests/unit/reservation-rules.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { Hours } from '@/lib/opening-hours'
import {
  DEFAULT_RULES,
  availableTimes,
  bookableRange,
  checkRequest,
  localToUtc,
  normaliseEmail,
  type ReservationInput,
} from '@/lib/reservation-rules'

const hours: Hours = {
  timezone: 'Europe/Berlin',
  weekly: [
    { day: 'tue', slots: [{ open: '11:30', close: '15:00' }, { open: '17:00', close: '22:30' }] },
    { day: 'sat', slots: [{ open: '12:00', close: '22:30' }] },
  ],
  exceptions: [
    { from: '2026-10-20T12:00:00.000Z', closed: true, note: 'Betriebsausflug' }, // a Tuesday
    { from: '2026-10-24T12:00:00.000Z', closed: false, slots: [{ open: '18:00', close: '21:00' }] }, // a Saturday
  ],
}
// Monday 2026-10-12, 10:00 Berlin (CEST, UTC+2)
const now = new Date('2026-10-12T08:00:00Z')

describe('availableTimes', () => {
  it('lists 15-minute steps per opening slot, ending 60 minutes before close', () => {
    const times = availableTimes(hours, DEFAULT_RULES, '2026-10-13', now)
    expect(times[0]).toBe('11:30')
    expect(times).toContain('14:00')
    expect(times).not.toContain('14:15')
    expect(times).toContain('17:00')
    expect(times.at(-1)).toBe('21:30')
    expect(times).not.toContain('16:00')
  })

  it('respects the lead time on the current day', () => {
    // Tuesday 2026-10-13, 11:20 Berlin → earliest 12:20 → first slot 12:30
    const tuesdayMorning = new Date('2026-10-13T09:20:00Z')
    const times = availableTimes(hours, DEFAULT_RULES, '2026-10-13', tuesdayMorning)
    expect(times[0]).toBe('12:30')
  })

  it('returns nothing on closed days, closed exceptions and beyond the horizon', () => {
    expect(availableTimes(hours, DEFAULT_RULES, '2026-10-12', now)).toEqual([]) // Monday, closed
    expect(availableTimes(hours, DEFAULT_RULES, '2026-10-20', now)).toEqual([]) // closed exception
    expect(availableTimes(hours, DEFAULT_RULES, '2026-12-15', now)).toEqual([]) // > 60 days
    expect(availableTimes(hours, DEFAULT_RULES, '2026-10-11', now)).toEqual([]) // in the past
  })

  it('uses special hours from an exception', () => {
    const times = availableTimes(hours, DEFAULT_RULES, '2026-10-24', now)
    expect(times).toEqual(['18:00', '18:15', '18:30', '18:45', '19:00', '19:15', '19:30', '19:45', '20:00'])
  })

  it('returns nothing for malformed dates', () => {
    expect(availableTimes(hours, DEFAULT_RULES, '2026-13-40', now)).toEqual([])
    expect(availableTimes(hours, DEFAULT_RULES, 'tomorrow', now)).toEqual([])
  })
})

describe('bookableRange', () => {
  it('spans today to today + horizon in the restaurant time zone', () => {
    expect(bookableRange(DEFAULT_RULES, now)).toEqual({ min: '2026-10-12', max: '2026-12-11' })
  })
})

describe('localToUtc', () => {
  it('converts Berlin wall time to UTC across the DST change', () => {
    expect(localToUtc('2026-10-24', '12:30', 'Europe/Berlin').toISOString()).toBe('2026-10-24T10:30:00.000Z')
    expect(localToUtc('2026-10-31', '12:30', 'Europe/Berlin').toISOString()).toBe('2026-10-31T11:30:00.000Z')
  })
})

describe('checkRequest', () => {
  const valid: ReservationInput = {
    date: '2026-10-13',
    time: '12:30',
    partySize: 4,
    name: 'Mei Lin',
    email: 'mei@example.com',
    privacy: true,
  }

  it('accepts a valid request', () => {
    expect(checkRequest(valid, hours, DEFAULT_RULES, now)).toEqual({})
  })

  it('rejects manipulated values', () => {
    const problems = checkRequest(
      { ...valid, time: '12:31', partySize: 99, email: 'not-an-email', name: ' ', privacy: false },
      hours,
      DEFAULT_RULES,
      now,
    )
    expect(problems).toEqual({
      time: 'notBookable',
      partySize: 'tooMany',
      email: 'invalid',
      name: 'required',
      privacy: 'required',
    })
    expect(checkRequest({ ...valid, partySize: 0 }, hours, DEFAULT_RULES, now).partySize).toBe('tooFew')
    expect(checkRequest({ ...valid, date: '2026-13-40' }, hours, DEFAULT_RULES, now).date).toBe('invalid')
    expect(checkRequest({ ...valid, date: '2026-10-12' }, hours, DEFAULT_RULES, now).date).toBe('notBookable')
    expect(checkRequest({ ...valid, note: 'x'.repeat(501) }, hours, DEFAULT_RULES, now).note).toBe('tooLong')
  })
})

describe('normaliseEmail', () => {
  it('trims and lower-cases', () => {
    expect(normaliseEmail('  Max@Example.COM ')).toBe('max@example.com')
  })
})
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `npx vitest run --project unit tests/unit/reservation-rules.test.ts`
Expected: FAIL, `Cannot find module '@/lib/reservation-rules'`.

- [ ] **Step 4: Implement the rules**

Create `src/lib/reservation-rules.ts`:

```ts
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
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute))
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
export function availableTimes(hours: Hours, rules: ReservationRules, date: string, now: Date): string[] {
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
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx vitest run --project unit tests/unit/reservation-rules.test.ts`
Expected: PASS (all tests). Also run `npx vitest run --project unit tests/unit/opening-hours.test.ts` → PASS (the exports did not change behaviour).

- [ ] **Step 6: Commit**

```bash
pnpm verify
git add src/lib/opening-hours.ts src/lib/reservation-rules.ts tests/unit/reservation-rules.test.ts
git commit -m "feat(reservations): pure booking rules shared by form and server"
```

---

### Task 2: Settings global and reservations collection

**Files:**
- Create: `src/globals/ReservationSettings.ts`
- Create: `src/collections/Reservations.ts`
- Create: `src/lib/reservation-settings.ts`
- Modify: `src/payload.config.ts` (register both)
- Create (generated): migration `src/migrations/<timestamp>_reservations.ts`
- Test: `tests/int/reservations.int.spec.ts`

**Interfaces:**
- Consumes: `DEFAULT_RULES`, `ReservationRules`, `localToUtc` (Task 1); `authenticated` from `src/access`.
- Produces:
  - Collection slug `reservations` with fields `date`, `time`, `startsAt`, `partySize`, `name`, `email`, `phone`, `note`, `status` (`requested|confirmed|declined`), `messageToGuest`, `locale` (`de|en`), `source` (`website|admin`), `privacyAcceptedAt`, `anonymisedAt`.
  - Global slug `reservation-settings` with fields `mode` (`form|external|off`), `externalUrl`, `slotMinutes`, `lastBookingBeforeCloseMinutes`, `leadTimeMinutes`, `horizonDays`, `maxPartySize`, `notificationEmail`, `retentionDays`.
  - `type ReservationSettings = ReservationRules & { mode: 'form' | 'external' | 'off'; externalUrl: string | null; notificationEmail: string | null; retentionDays: number }`
  - `readReservationSettings(payload: Payload): Promise<ReservationSettings>`

- [ ] **Step 1: Write the failing integration test**

Create `tests/int/reservations.int.spec.ts`:

```ts
import { getPayload, type Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'
import config from '@/payload.config'
import { migrations } from '@/migrations'
import { readReservationSettings } from '@/lib/reservation-settings'

let payload: Payload

beforeAll(async () => {
  payload = await getPayload({ config })
  await payload.db.migrate({ migrations: migrations as never })
})

const base = {
  date: '2026-11-03',
  time: '12:30',
  partySize: 4,
  name: 'Mei Lin',
  email: 'mei@example.com',
  locale: 'de' as const,
  source: 'admin' as const,
}

describe('reservations collection', () => {
  it('derives startsAt from the Berlin wall time', async () => {
    const r = await payload.create({ collection: 'reservations', data: base })
    expect(r.startsAt).toBe('2026-11-03T11:30:00.000Z')
    expect(r.status).toBe('requested')
  })

  it('is not readable or writable for anonymous visitors', async () => {
    await expect(
      payload.create({ collection: 'reservations', overrideAccess: false, data: base }),
    ).rejects.toThrow(/keine Berechtigung/)
    const pub = await payload.find({ collection: 'reservations', overrideAccess: false })
    expect(pub.docs).toHaveLength(0)
  })

  it('requires name and e-mail unless the reservation is anonymised', async () => {
    await expect(payload.create({ collection: 'reservations', data: { ...base, name: '' } })).rejects.toThrow()
    const anon = await payload.create({
      collection: 'reservations',
      data: { ...base, name: '', email: '', anonymisedAt: new Date().toISOString() },
    })
    expect(anon.id).toBeTruthy()
  })
})

describe('reservation settings', () => {
  it('falls back to the defaults on a fresh database', async () => {
    const s = await readReservationSettings(payload)
    expect(s).toMatchObject({ mode: 'form', slotMinutes: 15, leadTimeMinutes: 60, maxPartySize: 8, retentionDays: 30 })
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run --project int tests/int/reservations.int.spec.ts`
Expected: FAIL, `Cannot find module '@/lib/reservation-settings'`.

- [ ] **Step 3: Create the settings global**

Create `src/globals/ReservationSettings.ts`:

```ts
import type { GlobalConfig } from 'payload'
import { authenticated } from '@/access'
import { revalidateGlobal } from '@/lib/revalidate'
import { DEFAULT_RULES } from '@/lib/reservation-rules'

const minutesField = (name: string, label: string, defaultValue: number, description: string) => ({
  name,
  type: 'number' as const,
  label,
  required: true,
  defaultValue,
  min: 0,
  admin: { description, width: '50%' },
})

export const ReservationSettings: GlobalConfig = {
  slug: 'reservation-settings',
  label: 'Reservierungen',
  admin: { group: 'Einstellungen' },
  // Read by the server only (Local API); the public REST API does not expose it.
  access: { read: authenticated, update: authenticated },
  hooks: { afterChange: [revalidateGlobal] },
  fields: [
    {
      name: 'mode',
      type: 'select',
      label: 'Reservierung über',
      required: true,
      defaultValue: 'form',
      options: [
        { label: 'Eigenes Formular auf der Website', value: 'form' },
        { label: 'Externen Anbieter (Link)', value: 'external' },
        { label: 'Aus (keine Online-Reservierung)', value: 'off' },
      ],
    },
    {
      name: 'externalUrl',
      type: 'text',
      label: 'Link zum externen Anbieter',
      admin: { condition: (_, s) => s?.mode === 'external' },
      validate: (value: string | null | undefined, { siblingData }: { siblingData: { mode?: string } }) => {
        if (siblingData.mode !== 'external') return true
        try {
          return new URL(value ?? '').protocol === 'https:' || 'Bitte eine https://-Adresse angeben.'
        } catch {
          return 'Bitte eine vollständige Adresse angeben, z. B. https://…'
        }
      },
    },
    {
      type: 'row',
      fields: [
        minutesField('slotMinutes', 'Zeitraster (Minuten)', DEFAULT_RULES.slotMinutes, 'Abstand der wählbaren Uhrzeiten.'),
        minutesField('leadTimeMinutes', 'Vorlauf (Minuten)', DEFAULT_RULES.leadTimeMinutes, 'Frühestens so viele Minuten ab jetzt.'),
      ],
    },
    {
      type: 'row',
      fields: [
        minutesField('lastBookingBeforeCloseMinutes', 'Letzte Reservierung vor Schluss (Minuten)', DEFAULT_RULES.lastBookingBeforeCloseMinutes, 'Gilt für jedes Zeitfenster (mittags, abends).'),
        minutesField('horizonDays', 'Wie weit im Voraus (Tage)', DEFAULT_RULES.horizonDays, ''),
      ],
    },
    {
      type: 'row',
      fields: [
        minutesField('maxPartySize', 'Maximale Personenzahl online', DEFAULT_RULES.maxPartySize, 'Größere Gruppen werden gebeten anzurufen.'),
        minutesField('retentionDays', 'Personendaten löschen nach (Tagen)', 30, 'Name, E-Mail, Telefon und Anmerkung werden danach entfernt.'),
      ],
    },
    {
      name: 'notificationEmail',
      type: 'email',
      label: 'Neue Anfragen senden an',
      admin: { description: 'Leer lassen, um die E-Mail-Adresse des Restaurants zu verwenden.' },
    },
  ],
}
```

- [ ] **Step 4: Create the settings reader**

Create `src/lib/reservation-settings.ts`:

```ts
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
    lastBookingBeforeCloseMinutes: s.lastBookingBeforeCloseMinutes ?? DEFAULT_RULES.lastBookingBeforeCloseMinutes,
    leadTimeMinutes: s.leadTimeMinutes ?? DEFAULT_RULES.leadTimeMinutes,
    horizonDays: s.horizonDays || DEFAULT_RULES.horizonDays,
    maxPartySize: s.maxPartySize || DEFAULT_RULES.maxPartySize,
    retentionDays: s.retentionDays || 30,
  }
}
```

- [ ] **Step 5: Create the collection (without mail hooks and endpoint; Tasks 4 and 5 add them)**

Create `src/collections/Reservations.ts`:

```ts
import type { CollectionConfig } from 'payload'
import { authenticated } from '@/access'
import { localToUtc } from '@/lib/reservation-rules'

/** Name and e-mail are required, except after the cleanup removed them. */
const requiredUnlessAnonymised = (value: unknown, { siblingData }: { siblingData: { anonymisedAt?: string | null } }) =>
  Boolean(siblingData.anonymisedAt) || (typeof value === 'string' && value.trim() !== '') || 'Pflichtfeld.'

export const Reservations: CollectionConfig = {
  slug: 'reservations',
  labels: { singular: 'Reservierung', plural: 'Reservierungen' },
  admin: {
    group: 'Reservierungen',
    useAsTitle: 'name',
    defaultColumns: ['date', 'time', 'partySize', 'name', 'status', 'createdAt'],
    listSearchableFields: ['name', 'email'],
    description: 'Neue Anfragen stehen oben. Status ändern und speichern: Der Gast bekommt automatisch eine E-Mail.',
  },
  defaultSort: '-createdAt',
  access: { read: authenticated, create: authenticated, update: authenticated, delete: authenticated },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (data?.date && data?.time) data.startsAt = localToUtc(data.date, data.time, 'Europe/Berlin').toISOString()
        if (typeof data?.email === 'string') data.email = data.email.trim().toLowerCase()
        return data
      },
    ],
  },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'date', type: 'text', label: 'Datum (JJJJ-MM-TT)', required: true, admin: { width: '33%' } },
        { name: 'time', type: 'text', label: 'Uhrzeit', required: true, admin: { width: '33%' } },
        { name: 'partySize', type: 'number', label: 'Personen', required: true, min: 1, admin: { width: '33%' } },
      ],
    },
    {
      name: 'status',
      type: 'select',
      label: 'Status',
      required: true,
      defaultValue: 'requested',
      options: [
        { label: 'Angefragt', value: 'requested' },
        { label: 'Bestätigt', value: 'confirmed' },
        { label: 'Abgelehnt', value: 'declined' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'messageToGuest',
      type: 'textarea',
      label: 'Nachricht an den Gast (optional)',
      maxLength: 500,
      admin: { position: 'sidebar', description: 'Steht in der Bestätigungs- oder Absage-E-Mail.' },
    },
    { name: 'name', type: 'text', label: 'Name', maxLength: 100, validate: requiredUnlessAnonymised },
    {
      type: 'row',
      fields: [
        { name: 'email', type: 'text', label: 'E-Mail', maxLength: 200, validate: requiredUnlessAnonymised, admin: { width: '50%' } },
        { name: 'phone', type: 'text', label: 'Telefon', maxLength: 40, admin: { width: '50%' } },
      ],
    },
    { name: 'note', type: 'textarea', label: 'Anmerkung des Gastes', maxLength: 500 },
    {
      name: 'locale',
      type: 'select',
      label: 'Sprache des Gastes',
      required: true,
      defaultValue: 'de',
      options: [
        { label: 'Deutsch', value: 'de' },
        { label: 'English', value: 'en' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'source',
      type: 'select',
      label: 'Eingegangen über',
      required: true,
      defaultValue: 'admin',
      options: [
        { label: 'Website', value: 'website' },
        { label: 'Im Admin eingetragen', value: 'admin' },
      ],
      admin: { position: 'sidebar', readOnly: true },
    },
    { name: 'startsAt', type: 'date', label: 'Beginn (berechnet)', admin: { position: 'sidebar', readOnly: true } },
    { name: 'privacyAcceptedAt', type: 'date', label: 'Datenschutz akzeptiert', admin: { position: 'sidebar', readOnly: true } },
    { name: 'anonymisedAt', type: 'date', label: 'Personendaten gelöscht am', admin: { position: 'sidebar', readOnly: true } },
  ],
}
```

- [ ] **Step 6: Register both in the Payload config**

In `src/payload.config.ts`: import `Reservations` and `ReservationSettings`; set `collections: [MenuItems, MenuCategories, Attributes, Posts, Media, Reservations, Users]` and `globals: [SiteSettings, OpeningHours, ReservationSettings, Home, About, Legal]`.

- [ ] **Step 7: Generate types, import map and the migration, then migrate**

Run:
```bash
pnpm generate:types
pnpm generate:importmap
pnpm migrate:create reservations
pnpm migrate
```
Open the generated migration and check: it creates `reservations` and `reservation_settings` tables and contains no foreign key to `media` (none expected). If the `up` contains `INSERT INTO … SELECT` from a column that does not exist yet, fix it as done in `20261014_085535_menu_details.ts`.

- [ ] **Step 8: Run the integration test**

Run: `npx vitest run --project int tests/int/reservations.int.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 9: Commit**

```bash
pnpm verify
git add src/globals/ReservationSettings.ts src/collections/Reservations.ts src/lib/reservation-settings.ts src/payload.config.ts src/payload-types.ts "src/app/(payload)/admin/importMap.js" src/migrations tests/int/reservations.int.spec.ts
git commit -m "feat(reservations): collection and settings in the CMS"
```

---

### Task 3: Submitting a request (core function)

**Files:**
- Create: `src/lib/reservation-submit.ts`
- Test: `tests/int/reservations.int.spec.ts` (extend)

**Interfaces:**
- Consumes: `checkRequest`, `normaliseEmail`, `ReservationInput`, `Problem` (Task 1); `readReservationSettings` (Task 2); `Hours` from opening-hours.
- Produces:
  - `type SubmitResult = { ok: true; date: string; time: string; partySize: number } | { ok: false; problems: Partial<Record<keyof ReservationInput, Problem>>; closed?: true }`
  - `submitReservation(args: { payload: Payload; input: ReservationInput & { website?: string }; locale: 'de' | 'en'; now?: Date }): Promise<SubmitResult>`

- [ ] **Step 1: Write the failing tests**

Append to `tests/int/reservations.int.spec.ts` (and add `import { submitReservation } from '@/lib/reservation-submit'` at the top):

```ts
describe('submitReservation', () => {
  // Opening hours for these tests: every Tuesday 11:30–15:00 and 17:00–22:30.
  beforeAll(async () => {
    await payload.updateGlobal({
      slug: 'opening-hours',
      data: {
        timezone: 'Europe/Berlin',
        weekly: [{ day: 'tue', slots: [{ open: '11:30', close: '15:00' }, { open: '17:00', close: '22:30' }] }],
        exceptions: [],
      },
    })
  })
  const now = new Date('2026-10-12T08:00:00Z') // Monday 10:00 Berlin
  const input = {
    date: '2026-10-13',
    time: '12:30',
    partySize: 4,
    name: 'Mei Lin',
    email: '  Mei@Example.com ',
    privacy: true,
  }

  it('stores a valid request with normalised e-mail, source website and consent time', async () => {
    const result = await submitReservation({ payload, input, locale: 'en', now })
    expect(result).toEqual({ ok: true, date: '2026-10-13', time: '12:30', partySize: 4 })
    const stored = await payload.find({ collection: 'reservations', where: { email: { equals: 'mei@example.com' } } })
    expect(stored.docs).toHaveLength(1)
    expect(stored.docs[0]).toMatchObject({ source: 'website', locale: 'en', status: 'requested' })
    expect(stored.docs[0].privacyAcceptedAt).toBeTruthy()
  })

  it('stores a repeated request (same e-mail, any spelling) within 10 minutes only once', async () => {
    await submitReservation({ payload, input: { ...input, email: 'MEI@example.com' }, locale: 'de', now })
    const stored = await payload.find({ collection: 'reservations', where: { email: { equals: 'mei@example.com' } } })
    expect(stored.docs).toHaveLength(1)
  })

  it('rejects manipulated values and stores nothing', async () => {
    const before = (await payload.count({ collection: 'reservations' })).totalDocs
    const result = await submitReservation({ payload, input: { ...input, time: '12:31', partySize: 99 }, locale: 'de', now })
    expect(result).toEqual({ ok: false, problems: { time: 'notBookable', partySize: 'tooMany' } })
    expect((await payload.count({ collection: 'reservations' })).totalDocs).toBe(before)
  })

  it('pretends success for bots that fill the honeypot, but stores nothing', async () => {
    const before = (await payload.count({ collection: 'reservations' })).totalDocs
    const result = await submitReservation({
      payload,
      input: { ...input, email: 'bot@example.com', website: 'http://spam.example' },
      locale: 'de',
      now,
    })
    expect(result.ok).toBe(true)
    expect((await payload.count({ collection: 'reservations' })).totalDocs).toBe(before)
  })

  it('refuses requests when online reservation is switched off', async () => {
    await payload.updateGlobal({ slug: 'reservation-settings', data: { mode: 'off' } })
    const result = await submitReservation({ payload, input: { ...input, email: 'off@example.com' }, locale: 'de', now })
    expect(result).toEqual({ ok: false, problems: {}, closed: true })
    await payload.updateGlobal({ slug: 'reservation-settings', data: { mode: 'form' } })
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run --project int tests/int/reservations.int.spec.ts`
Expected: FAIL, `Cannot find module '@/lib/reservation-submit'`.

- [ ] **Step 3: Implement the core**

Create `src/lib/reservation-submit.ts`:

```ts
import type { Payload } from 'payload'
import type { Hours } from './opening-hours'
import { checkRequest, normaliseEmail, type Problem, type ReservationInput } from './reservation-rules'
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
        { createdAt: { greater_than: new Date(now.getTime() - DUPLICATE_WINDOW_MS).toISOString() } },
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
```

Note on `createdAt` in the duplicate check: in tests `now` is in the past relative to the real clock, so the stored `createdAt` (real time) is always greater than `now − 10 min`; the check therefore matches, which is what the test expects.

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run --project int tests/int/reservations.int.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
pnpm verify
git add src/lib/reservation-submit.ts tests/int/reservations.int.spec.ts
git commit -m "feat(reservations): validate and store guest requests on the server"
```

---

### Task 4: E-mails

**Files:**
- Modify: `package.json` (add `@payloadcms/email-resend` 3.90.2)
- Modify: `src/payload.config.ts` (email adapter)
- Create: `src/lib/reservation-mails.ts`
- Modify: `src/collections/Reservations.ts` (afterChange hook)
- Modify: `.env.example`
- Test: `tests/int/reservations.int.spec.ts` (extend), `tests/unit/reservation-mails.test.ts`

**Interfaces:**
- Consumes: `Reservation` type from `@/payload-types`; `readReservationSettings` (Task 2); `siteUrl` from `src/lib/seo.ts`.
- Produces:
  - `type MailKind = 'newRequestRestaurant' | 'receiptGuest' | 'confirmedGuest' | 'declinedGuest'`
  - `buildMail(kind: MailKind, r: Reservation, restaurant: MailRestaurant, adminUrl: string): { subject: string; text: string; html: string }`
  - `type MailRestaurant = { name: string; phone: string; email: string | null; street: string; postalCode: string; city: string }`
  - `sendReservationMails(payload: Payload, r: Reservation, kinds: MailKind[]): Promise<void>` (never throws)
  - `mailsFor(operation: 'create' | 'update', doc: Reservation, previous?: Reservation): MailKind[]`

- [ ] **Step 1: Install the adapter**

Run: `pnpm add @payloadcms/email-resend@3.90.2`
Then check the adapter's option names in `node_modules/@payloadcms/email-resend/dist/index.d.ts` (expected: `apiKey`, `defaultFromAddress`, `defaultFromName`). Use the names found there.

- [ ] **Step 2: Write the failing unit tests**

Create `tests/unit/reservation-mails.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildMail, mailsFor } from '@/lib/reservation-mails'
import type { Reservation } from '@/payload-types'

const r = {
  id: 7,
  date: '2026-10-24',
  time: '12:30',
  partySize: 4,
  name: 'Mei Lin',
  email: 'mei@example.com',
  phone: null,
  note: 'Kinderstuhl',
  status: 'requested',
  locale: 'en',
  source: 'website',
  messageToGuest: null,
  updatedAt: '',
  createdAt: '',
} as unknown as Reservation

const restaurant = { name: 'Xiao Chu', phone: '030 23125 456', email: 'hallo@xiaochu.example', street: 'Simon-Dach-Straße 99', postalCode: '10245', city: 'Berlin' }

describe('mailsFor', () => {
  it('sends restaurant + receipt only for website requests', () => {
    expect(mailsFor('create', r)).toEqual(['newRequestRestaurant', 'receiptGuest'])
    expect(mailsFor('create', { ...r, source: 'admin' })).toEqual([])
  })
  it('sends the guest a mail only when the status changes', () => {
    expect(mailsFor('update', { ...r, status: 'confirmed' }, r)).toEqual(['confirmedGuest'])
    expect(mailsFor('update', { ...r, status: 'declined' }, { ...r, status: 'confirmed' })).toEqual(['declinedGuest'])
    expect(mailsFor('update', { ...r, status: 'confirmed', note: 'x' }, { ...r, status: 'confirmed' })).toEqual([])
    expect(mailsFor('update', { ...r, status: 'requested' }, { ...r, status: 'confirmed' })).toEqual([])
  })
  it('never mails an anonymised reservation', () => {
    expect(mailsFor('update', { ...r, status: 'confirmed', anonymisedAt: '2026-11-30' }, r)).toEqual([])
  })
})

describe('buildMail', () => {
  it('writes guest mails in the guest language with the details', () => {
    const m = buildMail('receiptGuest', r, restaurant, 'https://x/admin')
    expect(m.subject).toBe('Your table request at Xiao Chu')
    expect(m.text).toContain('Saturday, 24 October 2026, 12:30')
    expect(m.text).toContain('4 people')
    expect(m.text).toContain('not yet a confirmation')
  })
  it('includes the restaurant message in a decline', () => {
    const m = buildMail('declinedGuest', { ...r, locale: 'de', messageToGuest: '13:00 wäre frei.' }, restaurant, '')
    expect(m.subject).toBe('Ihre Reservierungsanfrage bei Xiao Chu')
    expect(m.text).toContain('13:00 wäre frei.')
  })
  it('gives the restaurant a link to the request and escapes HTML', () => {
    const m = buildMail('newRequestRestaurant', { ...r, name: '<b>Mei</b>' }, restaurant, 'https://site/admin/collections/reservations/7')
    expect(m.text).toContain('https://site/admin/collections/reservations/7')
    expect(m.html).toContain('&lt;b&gt;Mei&lt;/b&gt;')
    expect(m.html).not.toContain('<b>Mei</b>')
  })
})
```

- [ ] **Step 3: Run them to see them fail**

Run: `npx vitest run --project unit tests/unit/reservation-mails.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 4: Implement the mails**

Create `src/lib/reservation-mails.ts`:

```ts
import type { Payload } from 'payload'
import type { Reservation } from '@/payload-types'
import { readReservationSettings } from './reservation-settings'
import { siteUrl } from './seo'

export type MailKind = 'newRequestRestaurant' | 'receiptGuest' | 'confirmedGuest' | 'declinedGuest'
export type MailRestaurant = { name: string; phone: string; email: string | null; street: string; postalCode: string; city: string }

/** Which mails a save triggers. Staff entries and saves without a status change send nothing. */
export function mailsFor(operation: 'create' | 'update', doc: Reservation, previous?: Reservation): MailKind[] {
  if (doc.anonymisedAt) return []
  if (operation === 'create') return doc.source === 'website' ? ['newRequestRestaurant', 'receiptGuest'] : []
  if (!previous || previous.status === doc.status) return []
  if (doc.status === 'confirmed') return ['confirmedGuest']
  if (doc.status === 'declined') return ['declinedGuest']
  return []
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function when(r: Reservation, lang: 'de' | 'en') {
  const day = new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${r.date}T12:00:00Z`))
  return `${day}, ${r.time}`
}

const people = (n: number, lang: 'de' | 'en') =>
  lang === 'de' ? `${n} ${n === 1 ? 'Person' : 'Personen'}` : `${n} ${n === 1 ? 'person' : 'people'}`

export function buildMail(kind: MailKind, r: Reservation, rest: MailRestaurant, adminUrl: string) {
  const lang: 'de' | 'en' = kind === 'newRequestRestaurant' ? 'de' : r.locale === 'en' ? 'en' : 'de'
  const details = `${when(r, lang)} · ${people(r.partySize, lang)}`
  const address = `${rest.street}, ${rest.postalCode} ${rest.city}`
  const message = r.messageToGuest?.trim()
  let subject: string
  let lines: string[]

  if (kind === 'newRequestRestaurant') {
    subject = `Neue Reservierungsanfrage: ${details}`
    lines = [
      `Neue Anfrage über die Website:`,
      ``,
      `${details}`,
      `Name: ${r.name}`,
      `E-Mail: ${r.email}`,
      ...(r.phone ? [`Telefon: ${r.phone}`] : []),
      ...(r.note ? [`Anmerkung: ${r.note}`] : []),
      ``,
      `Bestätigen oder ablehnen: ${adminUrl}`,
    ]
  } else if (lang === 'en') {
    subject = kind === 'confirmedGuest' ? `Your table at ${rest.name} is confirmed` : `Your table request at ${rest.name}`
    const intro = {
      receiptGuest: `Thank you, we have received your request. This is not yet a confirmation; we will reply by e-mail shortly.`,
      confirmedGuest: `We are happy to confirm your table.`,
      declinedGuest: `Unfortunately we cannot offer you a table at this time.`,
    }[kind]
    lines = [`Hello ${r.name},`, ``, intro, ``, details, ...(message ? [``, message] : []), ``, `${rest.name}`, address, `Phone: ${rest.phone}`]
  } else {
    subject = kind === 'confirmedGuest' ? `Ihr Tisch bei ${rest.name} ist bestätigt` : `Ihre Reservierungsanfrage bei ${rest.name}`
    const intro = {
      receiptGuest: `Vielen Dank, wir haben Ihre Anfrage erhalten. Das ist noch keine Bestätigung; wir antworten Ihnen in Kürze per E-Mail.`,
      confirmedGuest: `Wir bestätigen Ihnen gern Ihren Tisch.`,
      declinedGuest: `Leider können wir Ihnen zu diesem Zeitpunkt keinen Tisch anbieten.`,
    }[kind]
    lines = [`Hallo ${r.name},`, ``, intro, ``, details, ...(message ? [``, message] : []), ``, `${rest.name}`, address, `Telefon: ${rest.phone}`]
  }

  const text = lines.join('\n')
  const html = `<div style="font-family:system-ui,sans-serif;line-height:1.5;color:#1e2740">${lines
    .map((l) => (l === '' ? '<br>' : `<p style="margin:0">${esc(l)}</p>`))
    .join('')}</div>`
  return { subject, text, html }
}

/** Sends the given mails. Failures are logged with the reservation id and never thrown. */
export async function sendReservationMails(payload: Payload, r: Reservation, kinds: MailKind[]) {
  if (kinds.length === 0) return
  try {
    const [site, settings] = await Promise.all([
      payload.findGlobal({ slug: 'site-settings', depth: 0, locale: 'de' }),
      readReservationSettings(payload),
    ])
    const rest: MailRestaurant = {
      name: site.name,
      phone: site.phone,
      email: site.email ?? null,
      street: site.address.street,
      postalCode: site.address.postalCode,
      city: site.address.city,
    }
    const adminUrl = `${siteUrl}/admin/collections/reservations/${r.id}`
    for (const kind of kinds) {
      const to = kind === 'newRequestRestaurant' ? (settings.notificationEmail ?? rest.email) : r.email
      if (!to) {
        payload.logger.warn(`Reservation ${r.id}: no recipient for ${kind} mail`)
        continue
      }
      const mail = buildMail(kind, r, rest, adminUrl)
      try {
        await payload.sendEmail({ to, subject: mail.subject, text: mail.text, html: mail.html })
      } catch (error) {
        payload.logger.error(`Reservation ${r.id}: ${kind} mail failed: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  } catch (error) {
    payload.logger.error(`Reservation ${r.id}: mails not sent: ${error instanceof Error ? error.message : String(error)}`)
  }
}
```

- [ ] **Step 5: Hook the mails into the collection**

In `src/collections/Reservations.ts` add `import { mailsFor, sendReservationMails } from '@/lib/reservation-mails'` and, inside `hooks`, after `beforeValidate`:

```ts
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        // Sent after the save; a failed mail is logged and never undoes the reservation.
        await sendReservationMails(req.payload, doc, mailsFor(operation, doc, previousDoc))
        return doc
      },
    ],
```

- [ ] **Step 6: Configure the adapter**

In `src/payload.config.ts` add `import { resendAdapter } from '@payloadcms/email-resend'` and in `buildConfig({ … })`:

```ts
  // Real mails only with a Resend key; otherwise Payload writes them to the server log.
  ...(process.env.RESEND_API_KEY && {
    email: resendAdapter({
      apiKey: process.env.RESEND_API_KEY,
      defaultFromAddress: process.env.EMAIL_FROM_ADDRESS || 'reservierung@example.com',
      defaultFromName: process.env.EMAIL_FROM_NAME || 'Restaurant',
    }),
  }),
```

Append to `.env.example`:

```
# E-mail (reservations). Without RESEND_API_KEY, mails are only written to the server log.
RESEND_API_KEY=
EMAIL_FROM_ADDRESS=reservierung@example.com
EMAIL_FROM_NAME=Xiao Chu
```

- [ ] **Step 7: Add the integration test for the hook**

Append to `tests/int/reservations.int.spec.ts` (add `vi` to the vitest import):

```ts
describe('reservation mails', () => {
  it('mails restaurant and guest for a website request, then the guest on confirmation only once', async () => {
    const sent = vi.spyOn(payload, 'sendEmail').mockResolvedValue(undefined as never)
    const r = await payload.create({
      collection: 'reservations',
      data: { ...base, date: '2026-11-10', email: 'mail-test@example.com', source: 'website' },
    })
    expect(sent.mock.calls.map((c) => (c[0] as { to: string }).to)).toContain('mail-test@example.com')
    expect(sent).toHaveBeenCalledTimes(2)

    sent.mockClear()
    await payload.update({ collection: 'reservations', id: r.id, data: { status: 'confirmed' } })
    expect(sent).toHaveBeenCalledTimes(1)
    await payload.update({ collection: 'reservations', id: r.id, data: { note: 'Fensterplatz' } })
    expect(sent).toHaveBeenCalledTimes(1)
    sent.mockRestore()
  })

  it('sends nothing for a reservation entered in the admin', async () => {
    const sent = vi.spyOn(payload, 'sendEmail').mockResolvedValue(undefined as never)
    await payload.create({ collection: 'reservations', data: { ...base, date: '2026-11-17', source: 'admin' } })
    expect(sent).not.toHaveBeenCalled()
    sent.mockRestore()
  })

  it('keeps the reservation when sending fails', async () => {
    const sent = vi.spyOn(payload, 'sendEmail').mockRejectedValue(new Error('SMTP down'))
    const r = await payload.create({
      collection: 'reservations',
      data: { ...base, date: '2026-11-24', email: 'fail@example.com', source: 'website' },
    })
    expect(r.id).toBeTruthy()
    sent.mockRestore()
  })
})
```

The site-settings global must exist for the mail text; at the top of this `describe`, add a `beforeAll` that saves it:

```ts
  beforeAll(async () => {
    await payload.updateGlobal({
      slug: 'site-settings',
      data: {
        name: 'Testrestaurant',
        phone: '030 1',
        phoneE164: '+49301',
        email: 'restaurant@example.com',
        address: { street: 'Teststraße 1', postalCode: '10115', city: 'Berlin', country: 'DE' },
      },
    })
  })
```

- [ ] **Step 8: Run all tests**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
pnpm verify
git add package.json pnpm-lock.yaml src/payload.config.ts src/lib/reservation-mails.ts src/collections/Reservations.ts .env.example tests/unit/reservation-mails.test.ts tests/int/reservations.int.spec.ts
git commit -m "feat(reservations): e-mails to restaurant and guest via Resend"
```

---

### Task 5: Cleanup after the retention period

**Files:**
- Create: `src/lib/reservation-cleanup.ts`
- Modify: `src/collections/Reservations.ts` (endpoint)
- Create: `scripts/reservations-cleanup.ts`
- Modify: `package.json` (script `reservations:cleanup`), `.env.example` (`CRON_SECRET`)
- Test: `tests/int/reservations.int.spec.ts` (extend)

**Interfaces:**
- Consumes: `readReservationSettings` (Task 2).
- Produces:
  - `anonymiseExpiredReservations(payload: Payload, now?: Date): Promise<number>` (number of anonymised reservations)
  - `isAuthorisedCron(authorization: string | null, secret: string | undefined): boolean`
  - Endpoint `GET /api/reservations/cleanup` with `Authorization: Bearer <CRON_SECRET>` → `{ anonymised: number }`; 401 otherwise.

- [ ] **Step 1: Write the failing tests**

Append to `tests/int/reservations.int.spec.ts` (import `anonymiseExpiredReservations`, `isAuthorisedCron` from `@/lib/reservation-cleanup`):

```ts
describe('cleanup', () => {
  it('removes personal data only from reservations older than the retention period', async () => {
    const old = await payload.create({
      collection: 'reservations',
      data: { ...base, date: '2026-08-01', phone: '0170 1', note: 'Allergie: Erdnüsse' },
    })
    const recent = await payload.create({ collection: 'reservations', data: { ...base, date: '2026-10-01' } })

    const count = await anonymiseExpiredReservations(payload, new Date('2026-10-14T10:00:00Z'))
    expect(count).toBeGreaterThanOrEqual(1)

    const o = await payload.findByID({ collection: 'reservations', id: old.id })
    expect(o).toMatchObject({ name: '', email: '', date: '2026-08-01', partySize: 4 })
    expect(o.phone ?? null).toBeNull()
    expect(o.note ?? null).toBeNull()
    expect(o.anonymisedAt).toBeTruthy()

    const r = await payload.findByID({ collection: 'reservations', id: recent.id })
    expect(r.name).toBe('Mei Lin')
  })

  it('is idempotent', async () => {
    expect(await anonymiseExpiredReservations(payload, new Date('2026-10-14T10:00:00Z'))).toBe(0)
  })

  it('accepts only the configured secret', () => {
    expect(isAuthorisedCron('Bearer s3cret', 's3cret')).toBe(true)
    expect(isAuthorisedCron('Bearer wrong', 's3cret')).toBe(false)
    expect(isAuthorisedCron(null, 's3cret')).toBe(false)
    expect(isAuthorisedCron('Bearer ', '')).toBe(false)
    expect(isAuthorisedCron('Bearer undefined', undefined)).toBe(false)
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run --project int tests/int/reservations.int.spec.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the cleanup**

Create `src/lib/reservation-cleanup.ts`:

```ts
import { timingSafeEqual } from 'crypto'
import type { Payload } from 'payload'
import { readReservationSettings } from './reservation-settings'

/**
 * Removes name, e-mail, phone and note from reservations whose date is older than the retention
 * period. Date, time, party size and status stay for anonymous statistics.
 */
export async function anonymiseExpiredReservations(payload: Payload, now = new Date()): Promise<number> {
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
      data: { name: '', email: '', phone: null, note: null, messageToGuest: null, anonymisedAt: now.toISOString() },
    })
  }
  return expired.docs.length
}

/** Constant-time check of "Authorization: Bearer <secret>". An empty or missing secret never matches. */
export function isAuthorisedCron(authorization: string | null, secret: string | undefined): boolean {
  if (!secret || !authorization) return false
  const expected = Buffer.from(`Bearer ${secret}`)
  const given = Buffer.from(authorization)
  return given.length === expected.length && timingSafeEqual(given, expected)
}
```

- [ ] **Step 4: Add the endpoint**

In `src/collections/Reservations.ts` add `import { anonymiseExpiredReservations, isAuthorisedCron } from '@/lib/reservation-cleanup'` and on the collection config:

```ts
  endpoints: [
    {
      // Daily job (e.g. Vercel Cron): GET /api/reservations/cleanup with "Authorization: Bearer <CRON_SECRET>".
      path: '/cleanup',
      method: 'get',
      handler: async (req) => {
        if (!isAuthorisedCron(req.headers.get('authorization'), process.env.CRON_SECRET)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const anonymised = await anonymiseExpiredReservations(req.payload)
        return Response.json({ anonymised })
      },
    },
  ],
```

- [ ] **Step 5: Add the script**

Create `scripts/reservations-cleanup.ts`:

```ts
/** Removes personal data from expired reservations. Usage: pnpm reservations:cleanup */
import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { anonymiseExpiredReservations } from '../src/lib/reservation-cleanup'

const payload = await getPayload({ config })
const count = await anonymiseExpiredReservations(payload)
console.log(`Anonymised ${count} reservation(s).`)
process.exit(0)
```

In `package.json` scripts add: `"reservations:cleanup": "cross-env NODE_OPTIONS=--no-deprecation tsx scripts/reservations-cleanup.ts"`.
Append to `.env.example`:

```
# Protects GET /api/reservations/cleanup (daily job). Long random string.
CRON_SECRET=replace-with-a-long-random-string
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 7: Check the endpoint by hand against the dev server**

With `CRON_SECRET=dev-secret` added to `.env` and the dev server restarted:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/reservations/cleanup
curl -s -H "Authorization: Bearer dev-secret" http://localhost:3000/api/reservations/cleanup
```
Expected: `401`, then `{"anonymised":0}`.

- [ ] **Step 8: Commit**

```bash
pnpm verify
git add src/lib/reservation-cleanup.ts src/collections/Reservations.ts scripts/reservations-cleanup.ts package.json .env.example tests/int/reservations.int.spec.ts
git commit -m "feat(reservations): remove personal data after the retention period"
```

---

### Task 6: Reservation page and form

**Files:**
- Modify: `src/i18n/routes.ts` (route `reserve`), `src/i18n/dictionary.ts` (texts), `src/app/sitemap.ts` (add `reserve`)
- Modify: `src/lib/queries.ts` (`getReservationPage`)
- Create: `src/app/(frontend)/[locale]/reservieren/page.tsx`
- Create: `src/app/(frontend)/[locale]/reservieren/actions.ts`
- Create: `src/app/(frontend)/[locale]/reservieren/ReservationForm.tsx`
- Modify: `src/app/(frontend)/[locale]/pages.css`
- Test: `tests/unit/routes.test.ts` (extend)

**Interfaces:**
- Consumes: `availableTimes`, `bookableRange`, `ReservationRules`, `Problem` (Task 1); `readReservationSettings` (Task 2); `submitReservation`, `SubmitResult` (Task 3); `getRestaurantInfo`, `payloadClient` (existing).
- Produces:
  - Route key `reserve`: `{ de: 'reservieren', en: 'reserve' }`.
  - `getReservationPage(locale)` → `{ settings: ReservationSettings; info: RestaurantInfo }`.
  - Server Action `requestReservationAction(prev: SubmitResult | null, formData: FormData): Promise<SubmitResult>`.

- [ ] **Step 1: Extend the routes test (failing)**

In `tests/unit/routes.test.ts`, inside `describe('href', …)`, add:

```ts
  it('knows the reservation page', () => {
    expect(href('reserve', 'de')).toBe('/reservieren')
    expect(href('reserve', 'en')).toBe('/en/reserve')
  })
```
and inside `describe('proxy', …)`:
```ts
  it('rewrites /en/reserve onto the German folder', () => {
    expect(run('/en/reserve').headers.get('x-middleware-rewrite')).toBe('http://localhost:3000/en/reservieren')
  })
```
Run: `npx vitest run --project unit tests/unit/routes.test.ts` → FAIL (`reserve` unknown).

- [ ] **Step 2: Add the route**

In `src/i18n/routes.ts`, add to `routes`: `reserve: { de: 'reservieren', en: 'reserve' },`. In `src/app/sitemap.ts`, add `'reserve'` to `pages`. Run the routes test → PASS.

- [ ] **Step 3: Add the texts**

In `src/i18n/dictionary.ts` add to `de`:

```ts
  reserve: {
    nav: 'Reservieren',
    cta: 'Tisch reservieren',
    title: 'Tisch reservieren',
    intro: 'Schicken Sie uns eine Anfrage. Wir bestätigen per E-Mail, meist innerhalb weniger Stunden.',
    date: 'Datum',
    time: 'Uhrzeit',
    chooseTime: 'Uhrzeit wählen',
    noTimes: 'An diesem Tag ist keine Online-Reservierung möglich. Bitte wählen Sie einen anderen Tag oder rufen Sie uns an.',
    partySize: 'Personen',
    largeGroup: (max: number, phone: string) => `Mehr als ${max} Personen? Bitte rufen Sie uns an: ${phone}`,
    name: 'Name',
    email: 'E-Mail',
    phone: 'Telefon (optional, für Rückfragen)',
    note: 'Anmerkung (optional)',
    noteHint: 'Zum Beispiel Kinderstuhl. Allergien nur angeben, wenn wir sie vorab wissen sollen.',
    privacy: 'Ich habe die Datenschutzerklärung gelesen.',
    privacyLink: 'Datenschutzerklärung',
    submit: 'Anfrage senden',
    sending: 'Wird gesendet …',
    errorSummary: 'Bitte prüfen Sie die markierten Felder.',
    closed: 'Online-Reservierungen sind zurzeit nicht möglich. Bitte rufen Sie uns an.',
    successTitle: 'Anfrage gesendet',
    success: (details: string) => `Ihre Anfrage für ${details} ist eingegangen. Wir antworten Ihnen per E-Mail. Das ist noch keine Bestätigung.`,
    people: (n: number) => `${n} ${n === 1 ? 'Person' : 'Personen'}`,
    problems: {
      required: 'Bitte ausfüllen.',
      invalid: 'Bitte prüfen Sie die Eingabe.',
      notBookable: 'Zu dieser Zeit ist keine Reservierung möglich.',
      tooMany: 'Für größere Gruppen rufen Sie uns bitte an.',
      tooFew: 'Bitte mindestens 1 Person angeben.',
      tooLong: 'Der Text ist zu lang.',
    },
  },
```

and the English equivalent in `en`:

```ts
  reserve: {
    nav: 'Reserve',
    cta: 'Book a table',
    title: 'Book a table',
    intro: 'Send us a request. We confirm by e-mail, usually within a few hours.',
    date: 'Date',
    time: 'Time',
    chooseTime: 'Choose a time',
    noTimes: 'Online booking is not possible on this day. Please choose another day or call us.',
    partySize: 'People',
    largeGroup: (max, phone) => `More than ${max} people? Please call us: ${phone}`,
    name: 'Name',
    email: 'E-mail',
    phone: 'Phone (optional, in case we need to reach you)',
    note: 'Note (optional)',
    noteHint: 'For example a high chair. Mention allergies only if we should know in advance.',
    privacy: 'I have read the privacy policy.',
    privacyLink: 'Privacy policy',
    submit: 'Send request',
    sending: 'Sending …',
    errorSummary: 'Please check the marked fields.',
    closed: 'Online booking is currently not available. Please call us.',
    successTitle: 'Request sent',
    success: (details) => `Your request for ${details} has been received. We will reply by e-mail. This is not yet a confirmation.`,
    people: (n) => `${n} ${n === 1 ? 'person' : 'people'}`,
    problems: {
      required: 'Please fill in.',
      invalid: 'Please check your entry.',
      notBookable: 'Booking is not possible at this time.',
      tooMany: 'For larger groups, please call us.',
      tooFew: 'Please enter at least 1 person.',
      tooLong: 'The text is too long.',
    },
  },
```

- [ ] **Step 4: Add the page query**

Append to `src/lib/queries.ts`:

```ts
export const getReservationPage = cache(async (locale: Locale) => {
  const payload = await payloadClient()
  const [settings, info] = await Promise.all([readReservationSettings(payload), getRestaurantInfo(locale)])
  return { settings, info }
})
```
with `import { readReservationSettings } from './reservation-settings'` at the top.

- [ ] **Step 5: Add the Server Action**

Create `src/app/(frontend)/[locale]/reservieren/actions.ts`:

```ts
'use server'

import { payloadClient } from '@/lib/queries'
import { submitReservation, type SubmitResult } from '@/lib/reservation-submit'

/** Form submit. Every rule is checked again on the server inside submitReservation. */
export async function requestReservationAction(_prev: SubmitResult | null, form: FormData): Promise<SubmitResult> {
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
```

- [ ] **Step 6: Add the form (client)**

Create `src/app/(frontend)/[locale]/reservieren/ReservationForm.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { useActionState, useMemo, useState, useSyncExternalStore } from 'react'
import { dictionaries } from '@/i18n/dictionary'
import type { Locale } from '@/i18n/locales'
import type { Hours } from '@/lib/opening-hours'
import { availableTimes, bookableRange, type ReservationRules } from '@/lib/reservation-rules'
import type { SubmitResult } from '@/lib/reservation-submit'
import { requestReservationAction } from './actions'

const noop = () => () => {}

type Props = { locale: Locale; hours: Hours; rules: ReservationRules; phone: string; privacyHref: string }

export function ReservationForm({ locale, hours, rules, phone, privacyHref }: Props) {
  const t = dictionaries[locale].reserve
  const [state, action, pending] = useActionState<SubmitResult | null, FormData>(requestReservationAction, null)
  // "Now" only exists in the browser; render the date/time inputs after hydration.
  const mounted = useSyncExternalStore(noop, () => true, () => false)
  const [date, setDate] = useState('')
  const range = useMemo(() => (mounted ? bookableRange(rules, new Date(), hours.timezone ?? undefined) : null), [mounted, rules, hours])
  const times = useMemo(() => (mounted && date ? availableTimes(hours, rules, date, new Date()) : []), [mounted, date, hours, rules])

  if (state?.ok) {
    const details = `${new Intl.DateTimeFormat(locale === 'de' ? 'de-DE' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${state.date}T12:00:00Z`))}, ${state.time} · ${t.people(state.partySize)}`
    return (
      <section className="reserve-success" role="status">
        <h2>{t.successTitle}</h2>
        <p>{t.success(details)}</p>
      </section>
    )
  }

  const problems = state && !state.ok ? state.problems : {}
  const err = (field: keyof typeof problems) =>
    problems[field] ? (
      <p className="field__error" id={`${field}-error`}>
        {t.problems[problems[field]!]}
      </p>
    ) : null
  const described = (field: keyof typeof problems) => (problems[field] ? `${field}-error` : undefined)

  return (
    <form action={action} className="reserve-form" noValidate>
      {state && !state.ok && (
        <p className="reserve-form__summary" role="alert">
          {state.closed ? t.closed : t.errorSummary}
        </p>
      )}
      <input type="hidden" name="locale" value={locale} />
      {/* Honeypot: hidden from people and screen readers; bots fill it in. */}
      <div className="reserve-form__hp" aria-hidden="true">
        <label>
          Website <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="reserve-form__row">
        <div className="field">
          <label htmlFor="date">{t.date}</label>
          <input
            id="date"
            name="date"
            type="date"
            required
            min={range?.min}
            max={range?.max}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-invalid={Boolean(problems.date)}
            aria-describedby={described('date')}
          />
          {err('date')}
        </div>
        <div className="field">
          <label htmlFor="time">{t.time}</label>
          <select id="time" name="time" required disabled={!date || times.length === 0} aria-invalid={Boolean(problems.time)} aria-describedby={described('time')} defaultValue="">
            <option value="" disabled>
              {t.chooseTime}
            </option>
            {times.map((time) => (
              <option key={time} value={time}>
                {time}
              </option>
            ))}
          </select>
          {date && times.length === 0 && <p className="field__hint">{t.noTimes}</p>}
          {err('time')}
        </div>
        <div className="field">
          <label htmlFor="partySize">{t.partySize}</label>
          <select id="partySize" name="partySize" defaultValue="2" aria-invalid={Boolean(problems.partySize)} aria-describedby={described('partySize')}>
            {Array.from({ length: rules.maxPartySize }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          {err('partySize')}
        </div>
      </div>
      <p className="field__hint">{t.largeGroup(rules.maxPartySize, phone)}</p>

      <div className="reserve-form__row">
        <div className="field">
          <label htmlFor="name">{t.name}</label>
          <input id="name" name="name" type="text" required maxLength={100} autoComplete="name" aria-invalid={Boolean(problems.name)} aria-describedby={described('name')} />
          {err('name')}
        </div>
        <div className="field">
          <label htmlFor="email">{t.email}</label>
          <input id="email" name="email" type="email" required maxLength={200} autoComplete="email" aria-invalid={Boolean(problems.email)} aria-describedby={described('email')} />
          {err('email')}
        </div>
        <div className="field">
          <label htmlFor="phone">{t.phone}</label>
          <input id="phone" name="phone" type="tel" maxLength={40} autoComplete="tel" aria-invalid={Boolean(problems.phone)} aria-describedby={described('phone')} />
          {err('phone')}
        </div>
      </div>

      <div className="field">
        <label htmlFor="note">{t.note}</label>
        <textarea id="note" name="note" maxLength={500} rows={3} aria-describedby="note-hint" aria-invalid={Boolean(problems.note)} />
        <p className="field__hint" id="note-hint">
          {t.noteHint}
        </p>
        {err('note')}
      </div>

      <div className="field field--check">
        <input id="privacy" name="privacy" type="checkbox" required aria-invalid={Boolean(problems.privacy)} aria-describedby={described('privacy')} />
        <label htmlFor="privacy">
          {t.privacy}{' '}
          <Link href={privacyHref} target="_blank">
            {t.privacyLink}
          </Link>
        </label>
        {err('privacy')}
      </div>

      <button type="submit" className="btn btn--primary" disabled={pending}>
        {pending ? t.sending : t.submit}
      </button>
    </form>
  )
}
```

Note: the form keeps entered values after an error because React keeps uncontrolled inputs as they are when the action returns problems (no reset is triggered for `useActionState` results that are not a navigation). Verify this in Step 9; if values are cleared, switch the text inputs to controlled state the same way as `date`.

- [ ] **Step 7: Add the page**

Create `src/app/(frontend)/[locale]/reservieren/page.tsx`:

```tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { dictionaries } from '@/i18n/dictionary'
import { href } from '@/i18n/routes'
import { getLocale, isLocale } from '@/i18n/server'
import { getReservationPage } from '@/lib/queries'
import { pageMetadata } from '@/lib/seo'
import { ReservationForm } from './ReservationForm'

export async function generateMetadata({ params }: PageProps<'/[locale]/reservieren'>): Promise<Metadata> {
  const { locale } = await params
  return isLocale(locale) ? pageMetadata({ key: 'reserve', locale, title: dictionaries[locale].reserve.title }) : {}
}

export default async function ReservePage() {
  const { locale, t } = await getLocale()
  const { settings, info } = await getReservationPage(locale)
  if (settings.mode !== 'form') notFound()

  return (
    <div className="reserve-page">
      <header className="page-head">
        <h1>{t.reserve.title}</h1>
        <p>{t.reserve.intro}</p>
      </header>
      <ReservationForm
        locale={locale}
        hours={info.hours}
        rules={settings}
        phone={info.phone}
        privacyHref={href('privacy', locale)}
      />
    </div>
  )
}
```

`settings` is passed as `rules`; it contains only the rule numbers plus `mode`, `externalUrl`, `notificationEmail` and `retentionDays`. To keep the notification address out of the browser, pass only the rule fields:

```tsx
        rules={{
          slotMinutes: settings.slotMinutes,
          lastBookingBeforeCloseMinutes: settings.lastBookingBeforeCloseMinutes,
          leadTimeMinutes: settings.leadTimeMinutes,
          horizonDays: settings.horizonDays,
          maxPartySize: settings.maxPartySize,
        }}
```

- [ ] **Step 8: Styles**

Append to `src/app/(frontend)/[locale]/pages.css`:

```css
/* Reservation form */
.reserve-form {
  display: grid;
  gap: 1.25rem;
  max-width: 48rem;
  padding-bottom: 3rem;
}
.reserve-form__row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: 1rem;
}
.field {
  display: grid;
  gap: 0.35rem;
  align-content: start;
  min-width: 0;
}
.field label {
  font-weight: 600;
}
.field input,
.field select,
.field textarea {
  font: inherit;
  color: var(--ink);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 0.75rem;
  padding: 0.65rem 0.8rem;
  min-height: 2.75rem;
  width: 100%;
}
.field [aria-invalid='true'] {
  border-color: var(--chili);
}
.field__hint {
  color: var(--ink-soft);
  font-size: 0.9rem;
}
.field__error {
  color: var(--chili);
  font-size: 0.9rem;
  font-weight: 600;
}
.field--check {
  grid-template-columns: auto 1fr;
  align-items: start;
  column-gap: 0.6rem;
}
.field--check input {
  width: 1.25rem;
  min-height: 1.25rem;
  margin-top: 0.2rem;
}
.field--check label {
  font-weight: 400;
}
.field--check .field__error {
  grid-column: 2;
}
.reserve-form__summary {
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  background: color-mix(in srgb, var(--chili) 12%, var(--surface));
  font-weight: 600;
}
.reserve-form__hp {
  position: absolute;
  left: -10000px;
  width: 1px;
  height: 1px;
  overflow: hidden;
}
.reserve-form .btn {
  justify-self: start;
}
.reserve-success {
  display: grid;
  gap: 0.75rem;
  max-width: 40rem;
  padding: 1.5rem;
  border-radius: var(--radius);
  background: var(--jade);
  margin-bottom: 3rem;
}
```

- [ ] **Step 9: Check in the browser**

Start the dev server if needed (`pnpm dev`). In the browser at 1280 px and 375 px, on `/reservieren` and `/en/reserve`:
1. Choose a Monday → time select disabled, "no times" hint shown.
2. Choose a Tuesday → times 11:30 … 14:00 and 17:00 … 21:30.
3. Submit empty → summary plus field errors; entered values stay.
4. Submit a valid request → success panel; dev server log shows two mails (restaurant, guest) and the admin list shows the request with source "Website".
5. Keyboard only: all fields reachable, focus visible, errors announced (`role="alert"`).

- [ ] **Step 10: Commit**

```bash
pnpm verify
git add src/i18n src/app/sitemap.ts src/lib/queries.ts "src/app/(frontend)/[locale]/reservieren" "src/app/(frontend)/[locale]/pages.css" tests/unit/routes.test.ts
git commit -m "feat(reservations): reservation page with form and server action"
```

---

### Task 7: Links to the reservation page (navigation, home, mobile bar)

**Files:**
- Modify: `src/lib/queries.ts` (`getReservationLink`)
- Modify: `src/components/site/NavLinks.tsx`, `src/components/site/MobileNav.tsx` (external items)
- Modify: `src/components/site/Header.tsx`, `src/app/(frontend)/[locale]/layout.tsx`, `src/app/(frontend)/[locale]/page.tsx`
- Modify: `src/components/site/MobileActionBar.tsx`, `src/components/site/Icon.tsx` (calendar icon)
- Modify: `src/app/(frontend)/[locale]/site.css` (four-item bar)

**Interfaces:**
- Consumes: `readReservationSettings` (Task 2), route `reserve` (Task 6).
- Produces: `getReservationLink(locale: Locale): Promise<{ href: string; external: boolean } | null>` (null when mode is `off`).

- [ ] **Step 1: Add the link query**

Append to `src/lib/queries.ts`:

```ts
/** Where "Book a table" points: our page, the external provider, or nowhere (mode off). */
export const getReservationLink = cache(async (locale: Locale) => {
  const payload = await payloadClient()
  const s = await readReservationSettings(payload)
  if (s.mode === 'off') return null
  if (s.mode === 'external' && s.externalUrl) return { href: s.externalUrl, external: true }
  if (s.mode === 'external') return null
  return { href: href('reserve', locale), external: false }
})
```
(import `href` from `@/i18n/routes`).

- [ ] **Step 2: Allow external items in the navigation**

In `src/components/site/NavLinks.tsx` and `src/components/site/MobileNav.tsx`, extend the item type to `{ href: string; label: string; external?: boolean }` and render external items as:

```tsx
<a href={item.href} target="_blank" rel="noopener noreferrer">
  {item.label}
  <span className="visually-hidden"> {externalLabel}</span>
</a>
```
instead of `<Link>`. Add a prop `externalLabel: string` to both components and pass `t.externalLink` from `Header.tsx`.

- [ ] **Step 3: Header, layout and home**

In `src/components/site/Header.tsx` accept a new prop `reserve: { href: string; external: boolean } | null` and append `{ href: reserve.href, label: t.reserve.nav, external: reserve.external }` to `items` when `reserve` is not null.
In `src/app/(frontend)/[locale]/layout.tsx` load `const reserve = await getReservationLink(locale)` and pass it to `<Header>` and `<MobileActionBar>` (`reserveHref={reserve?.href ?? null}`, `reserveExternal={reserve?.external ?? false}`).
In `src/app/(frontend)/[locale]/page.tsx` load `getReservationLink(locale)` and, in `.hero__actions`, insert between "Speisekarte" and "Anrufen":

```tsx
{reserve &&
  (reserve.external ? (
    <a className="btn btn--outline" href={reserve.href} target="_blank" rel="noopener noreferrer">
      {t.reserve.cta}
    </a>
  ) : (
    <Link className="btn btn--outline" href={reserve.href}>
      {t.reserve.cta}
    </Link>
  ))}
```

- [ ] **Step 4: Mobile bar with four items**

In `src/components/site/Icon.tsx` add to `paths`:
`calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',`
In `src/components/site/MobileActionBar.tsx` add props `reserveHref: string | null; reserveExternal: boolean` and label `reserve`; render after the menu link:

```tsx
{reserveHref &&
  (reserveExternal ? (
    <a href={reserveHref} target="_blank" rel="noopener noreferrer">
      <Icon name="calendar" />
      {labels.reserve}
    </a>
  ) : (
    <Link href={reserveHref}>
      <Icon name="calendar" />
      {labels.reserve}
    </Link>
  ))}
```
Set `data-count` to the number of rendered buttons (2–4). Pass `reserve: t.reserve.nav` in the layout's `labels`.

In `src/app/(frontend)/[locale]/site.css`, inside `@media (max-width: 48rem)`, add:

```css
  .action-bar__buttons[data-count='4'] {
    grid-template-columns: repeat(4, 1fr);
  }
  .action-bar__buttons[data-count='4'] a,
  .action-bar__buttons[data-count='4'] button {
    flex-direction: column;
    gap: 0.15rem;
    min-height: 3.2rem;
    font-size: 0.75rem;
    border-radius: 1.25rem;
  }
```
and change `.action-bar__buttons { border-radius: 999px }` to `border-radius: 1.6rem` so the taller four-item bar keeps rounded ends.

- [ ] **Step 5: Check in the browser**

At 1280 px and 375 px, light and dark: navigation shows "Reservieren"; the home hero shows "Tisch reservieren"; the mobile bar shows four items without overflow at 375 px. In the admin set mode "Externen Anbieter" with `https://example.com` → links open externally in a new tab; mode "Aus" → no reservation links and `/reservieren` returns 404. Set the mode back to "Eigenes Formular".

- [ ] **Step 6: Commit**

```bash
pnpm verify
git add src/lib/queries.ts src/components/site "src/app/(frontend)/[locale]"
git commit -m "feat(reservations): booking links in navigation, home and mobile bar"
```

---

### Task 8: Privacy text, documentation and final check

**Files:**
- Modify: `scripts/seed.ts` (privacy placeholder: reservations section)
- Modify: `docs/legal-checklist.md`, `docs/architecture.md`, `docs/plan.md`
- Modify: dev database: privacy text (via the admin or a one-off update)

- [ ] **Step 1: Privacy placeholder section**

In `scripts/seed.ts`, in the German `privacy` rich text, insert after the "## 5. Externe Bestell- und Social-Media-Links" block:

```ts
      '## 6. Reservierungsanfragen',
      '[ZWECK: BEARBEITUNG DER RESERVIERUNG UND – INNERHALB DER AUFBEWAHRUNGSFRIST – ERKENNEN VON STAMMGÄSTEN; DATEN: NAME, E-MAIL, OPTIONAL TELEFON UND ANMERKUNG; RECHTSGRUNDLAGE PRÜFEN (VORVERTRAGLICHE MASSNAHMEN, BERECHTIGTES INTERESSE); LÖSCHUNG 30 TAGE NACH DEM RESERVIERUNGSDATUM; E-MAIL-VERSAND ÜBER RESEND (AUFTRAGSVERARBEITUNG, DRITTLANDÜBERMITTLUNG PRÜFEN)]',
```
and renumber the following "Ihre Rechte" heading to 7. Apply the same section to the dev database through the admin (Seiten → Impressum & Datenschutz) so the running site matches.

- [ ] **Step 2: Legal checklist**

Add to `docs/legal-checklist.md` under "Privacy and consent":

```markdown
- [ ] Reservations: privacy policy section (purpose incl. recognising frequent guests within the retention period, legal basis, 30-day deletion), checked against current sources.
- [ ] Resend: data processing agreement signed; EU/US transfer basis checked; sender domain verified (SPF/DKIM).
- [ ] Daily cleanup (`/api/reservations/cleanup`) scheduled on the hosting with a secret `CRON_SECRET`; verified once in production.
- [ ] Spam: if fake requests appear, add rate limiting at the hosting level.
```

- [ ] **Step 3: Architecture and plan status**

Add a "Reservations" section to `docs/architecture.md` (request model, units from the File Structure table, mail rules, cleanup endpoint and script, env values `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME`, `CRON_SECRET`). In `docs/plan.md`, replace the line "Out of scope unless requested: reservations (link or phone only) …" with a note that reservation requests were added on 2026-10-14 (spec link), and add the decision to the status section.

- [ ] **Step 4: Full verification**

Run: `pnpm verify` → exit 0.
Browser: repeat Task 6 Step 9 points 2–4 and Task 7 Step 5 once more.
Run: `pnpm reservations:cleanup` → `Anonymised 0 reservation(s).`

- [ ] **Step 5: Commit**

```bash
git add scripts/seed.ts docs
git commit -m "docs(reservations): privacy placeholder, legal checklist and architecture"
```
