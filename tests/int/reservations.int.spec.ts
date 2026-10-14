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
