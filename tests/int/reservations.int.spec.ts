import { getPayload, type Payload } from 'payload'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import config from '@/payload.config'
import { migrations } from '@/migrations'
import { readReservationSettings } from '@/lib/reservation-settings'
import { submitReservation } from '@/lib/reservation-submit'
import { anonymiseExpiredReservations, isAuthorisedCron } from '@/lib/reservation-cleanup'

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

describe('reservation mails', () => {
  beforeAll(async () => {
    await payload.updateGlobal({
      slug: 'site-settings',
      data: {
        name: 'Testrestaurant',
        phone: '030 1',
        phoneE164: '+49301234567',
        email: 'restaurant@example.com',
        address: { street: 'Teststraße 1', postalCode: '10115', city: 'Berlin', country: 'DE' },
      },
    })
  })
  it('mails restaurant and guest for a website request, then the guest on confirmation only once', async () => {
    const sent = vi.spyOn(payload, 'sendEmail').mockResolvedValue(undefined as never)
    const r = await payload.create({
      collection: 'reservations',
      data: { ...base, date: '2026-11-10', email: 'mail-test@example.com', source: 'website' },
    })
    expect(sent.mock.calls.map((c) => (c[0] as { to: string }).to)).toContain(
      'mail-test@example.com',
    )
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
    await payload.create({
      collection: 'reservations',
      data: { ...base, date: '2026-11-17', source: 'admin' },
    })
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

describe('cleanup', () => {
  it('removes personal data only from reservations older than the retention period', async () => {
    const old = await payload.create({
      collection: 'reservations',
      data: { ...base, date: '2026-08-01', phone: '0170 1', note: 'Allergie: Erdnüsse' },
    })
    const recent = await payload.create({
      collection: 'reservations',
      data: { ...base, date: '2026-10-01' },
    })

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

describe('review fixes', () => {
  it('rejects malformed dates and times entered by staff with a field error', async () => {
    await expect(
      payload.create({ collection: 'reservations', data: { ...base, date: '14.10.2026' } }),
    ).rejects.toThrow(/Datum/)
    await expect(
      payload.create({ collection: 'reservations', data: { ...base, date: '2026-13-40' } }),
    ).rejects.toThrow(/Datum/)
    await expect(
      payload.create({ collection: 'reservations', data: { ...base, time: '7:30' } }),
    ).rejects.toThrow(/Uhrzeit/)
  })

  it('treats every reservation created by a logged-in user as a staff entry (no mails)', async () => {
    const user = await payload.create({
      collection: 'users',
      data: { email: 'staff@example.com', password: 'Staff-test-123!' } as never,
    })
    const sent = vi.spyOn(payload, 'sendEmail').mockResolvedValue(undefined as never)
    const copy = await payload.create({
      collection: 'reservations',
      user,
      overrideAccess: false,
      data: { ...base, date: '2026-12-01', source: 'website' },
    })
    expect(copy.source).toBe('admin')
    expect(sent).not.toHaveBeenCalled()
    sent.mockRestore()
  })

  it('logs a missing recipient as an error, not a warning', async () => {
    await payload.updateGlobal({ slug: 'site-settings', data: { email: null } as never })
    const error = vi.spyOn(payload.logger, 'error')
    vi.spyOn(payload, 'sendEmail').mockResolvedValue(undefined as never)
    await payload.create({
      collection: 'reservations',
      data: { ...base, date: '2026-12-08', email: 'norecipient@example.com', source: 'website' },
    })
    expect(error.mock.calls.some((c) => String(c[0]).includes('no recipient'))).toBe(true)
    vi.restoreAllMocks()
  })
})
