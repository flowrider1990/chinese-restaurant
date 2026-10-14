import { describe, expect, it } from 'vitest'
import { getStatus, weeklySummary, type Hours } from '@/lib/opening-hours'

const split = [
  { open: '11:30', close: '15:00' },
  { open: '17:00', close: '22:30' },
]
const hours: Hours = {
  timezone: 'Europe/Berlin',
  weekly: [
    { day: 'tue', slots: split },
    { day: 'wed', slots: split },
    { day: 'sat', slots: [{ open: '18:00', close: '01:00' }] },
  ],
  exceptions: [{ from: '2026-12-24T12:00:00.000Z', closed: true, note: 'Heiligabend' }],
}

// Berlin is UTC+2 in summer (CEST) and UTC+1 in winter (CET).
const at = (iso: string) => new Date(iso)

describe('getStatus', () => {
  it('handles split lunch and dinner service', () => {
    expect(getStatus(hours, at('2026-10-13T10:00:00Z'))).toEqual({ open: true, closesAt: '15:00' }) // Tue 12:00
    expect(getStatus(hours, at('2026-10-13T14:00:00Z'))).toEqual({
      open: false,
      opensAt: { day: 'tue', time: '17:00', today: true },
    }) // Tue 16:00
    expect(getStatus(hours, at('2026-10-13T16:00:00Z'))).toEqual({ open: true, closesAt: '22:30' }) // Tue 18:00
  })

  it('treats the closing minute as closed and finds the next day', () => {
    expect(getStatus(hours, at('2026-10-14T20:30:00Z'))).toEqual({
      open: false,
      opensAt: { day: 'sat', time: '18:00', today: false },
    }) // Wed 22:30
  })

  it('keeps an after-midnight slot open into the next day', () => {
    expect(getStatus(hours, at('2026-10-17T22:30:00Z'))).toEqual({ open: true, closesAt: '01:00' }) // Sun 00:30
    expect(getStatus(hours, at('2026-10-17T23:30:00Z')).open).toBe(false) // Sun 01:30
  })

  it('lets an exception close a regular day', () => {
    // 2026-12-24 is a Thursday; add a Thursday slot to prove the exception wins.
    const withThu: Hours = { ...hours, weekly: [...hours.weekly!, { day: 'thu', slots: split }] }
    expect(getStatus(withThu, at('2026-12-24T11:00:00Z')).open).toBe(false) // Thu 12:00 CET
    expect(getStatus(withThu, at('2026-12-31T11:00:00Z')).open).toBe(true)
  })

  it('uses local time across the DST change', () => {
    // 2026-10-25: clocks go back. 10:30Z is 11:30 CET (open); a day earlier 09:30Z was 11:30 CEST.
    const sun: Hours = { weekly: [{ day: 'sun', slots: [{ open: '11:30', close: '15:00' }] }] }
    expect(getStatus(sun, at('2026-10-25T10:30:00Z')).open).toBe(true)
    expect(getStatus(sun, at('2026-10-25T09:30:00Z')).open).toBe(false)
  })

  it('reports no opening when nothing is scheduled', () => {
    expect(getStatus({ weekly: [] }, at('2026-10-13T10:00:00Z'))).toEqual({ open: false, opensAt: null })
  })
})

describe('weeklySummary', () => {
  it('groups consecutive days with identical hours', () => {
    const groups = weeklySummary(hours)
    expect(groups.map((g) => g.days)).toEqual([['mon'], ['tue', 'wed'], ['thu', 'fri'], ['sat'], ['sun']])
    expect(groups[0].slots).toEqual([])
  })
})
