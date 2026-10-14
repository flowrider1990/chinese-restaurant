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
    {
      day: 'tue',
      slots: [
        { open: '11:30', close: '15:00' },
        { open: '17:00', close: '22:30' },
      ],
    },
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
    expect(times).toEqual([
      '18:00',
      '18:15',
      '18:30',
      '18:45',
      '19:00',
      '19:15',
      '19:30',
      '19:45',
      '20:00',
    ])
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
    expect(localToUtc('2026-10-24', '12:30', 'Europe/Berlin').toISOString()).toBe(
      '2026-10-24T10:30:00.000Z',
    )
    expect(localToUtc('2026-10-31', '12:30', 'Europe/Berlin').toISOString()).toBe(
      '2026-10-31T11:30:00.000Z',
    )
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
    expect(checkRequest({ ...valid, partySize: 0 }, hours, DEFAULT_RULES, now).partySize).toBe(
      'tooFew',
    )
    expect(checkRequest({ ...valid, date: '2026-13-40' }, hours, DEFAULT_RULES, now).date).toBe(
      'invalid',
    )
    expect(checkRequest({ ...valid, date: '2026-10-12' }, hours, DEFAULT_RULES, now).date).toBe(
      'notBookable',
    )
    expect(checkRequest({ ...valid, note: 'x'.repeat(501) }, hours, DEFAULT_RULES, now).note).toBe(
      'tooLong',
    )
  })
})

describe('normaliseEmail', () => {
  it('trims and lower-cases', () => {
    expect(normaliseEmail('  Max@Example.COM ')).toBe('max@example.com')
  })
})
