import { getPayload, type Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'
import config from '@/payload.config'
import { migrations } from '@/migrations'
import { readReservationSettings } from '@/lib/reservation-settings'
import { submitReservation } from '@/lib/reservation-submit'

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
  status: 'requested' as const,
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
    await expect(
      payload.find({ collection: 'reservations', overrideAccess: false }),
    ).rejects.toThrow(/keine Berechtigung/)
  })

  it('requires name and e-mail unless the reservation is anonymised', async () => {
    await expect(
      payload.create({ collection: 'reservations', data: { ...base, name: '' } }),
    ).rejects.toThrow()
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
    expect(s).toMatchObject({
      mode: 'form',
      slotMinutes: 15,
      leadTimeMinutes: 60,
      maxPartySize: 8,
      retentionDays: 30,
    })
  })
})

describe('submitReservation', () => {
  // Opening hours for these tests: every Tuesday 11:30–15:00 and 17:00–22:30.
  beforeAll(async () => {
    await payload.updateGlobal({
      slug: 'opening-hours',
      data: {
        timezone: 'Europe/Berlin',
        weekly: [
          {
            day: 'tue',
            slots: [
              { open: '11:30', close: '15:00' },
              { open: '17:00', close: '22:30' },
            ],
          },
        ],
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
    email: '  Guest@Example.com ',
    privacy: true,
  }

  it('stores a valid request with normalised e-mail, source website and consent time', async () => {
    const result = await submitReservation({ payload, input, locale: 'en', now })
    expect(result).toEqual({ ok: true, date: '2026-10-13', time: '12:30', partySize: 4 })
    const stored = await payload.find({
      collection: 'reservations',
      where: { email: { equals: 'guest@example.com' } },
    })
    expect(stored.docs).toHaveLength(1)
    expect(stored.docs[0]).toMatchObject({ source: 'website', locale: 'en', status: 'requested' })
    expect(stored.docs[0].privacyAcceptedAt).toBeTruthy()
  })

  it('stores a repeated request (same e-mail, any spelling) within 10 minutes only once', async () => {
    await submitReservation({
      payload,
      input: { ...input, email: 'GUEST@example.com' },
      locale: 'de',
      now,
    })
    const stored = await payload.find({
      collection: 'reservations',
      where: { email: { equals: 'guest@example.com' } },
    })
    expect(stored.docs).toHaveLength(1)
  })

  it('rejects manipulated values and stores nothing', async () => {
    const before = (await payload.count({ collection: 'reservations' })).totalDocs
    const result = await submitReservation({
      payload,
      input: { ...input, time: '12:31', partySize: 99 },
      locale: 'de',
      now,
    })
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
    const result = await submitReservation({
      payload,
      input: { ...input, email: 'off@example.com' },
      locale: 'de',
      now,
    })
    expect(result).toEqual({ ok: false, problems: {}, closed: true })
    await payload.updateGlobal({ slug: 'reservation-settings', data: { mode: 'form' } })
  })
})
