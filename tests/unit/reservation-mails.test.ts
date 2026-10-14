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

const restaurant = {
  name: 'Xiao Chu',
  phone: '030 23125 456',
  email: 'hallo@xiaochu.example',
  street: 'Simon-Dach-Straße 99',
  postalCode: '10245',
  city: 'Berlin',
}

describe('mailsFor', () => {
  it('sends restaurant + receipt only for website requests', () => {
    expect(mailsFor('create', r)).toEqual(['newRequestRestaurant', 'receiptGuest'])
    expect(mailsFor('create', { ...r, source: 'admin' })).toEqual([])
  })
  it('sends the guest a mail only when the status changes', () => {
    expect(mailsFor('update', { ...r, status: 'confirmed' }, r)).toEqual(['confirmedGuest'])
    expect(mailsFor('update', { ...r, status: 'declined' }, { ...r, status: 'confirmed' })).toEqual(
      ['declinedGuest'],
    )
    expect(
      mailsFor('update', { ...r, status: 'confirmed', note: 'x' }, { ...r, status: 'confirmed' }),
    ).toEqual([])
    expect(
      mailsFor('update', { ...r, status: 'requested' }, { ...r, status: 'confirmed' }),
    ).toEqual([])
  })
  it('never mails an anonymised reservation', () => {
    expect(
      mailsFor('update', { ...r, status: 'confirmed', anonymisedAt: '2026-11-30' }, r),
    ).toEqual([])
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
    const m = buildMail(
      'declinedGuest',
      { ...r, locale: 'de', messageToGuest: '13:00 wäre frei.' },
      restaurant,
      '',
    )
    expect(m.subject).toBe('Ihre Reservierungsanfrage bei Xiao Chu')
    expect(m.text).toContain('13:00 wäre frei.')
  })
  it('gives the restaurant a link to the request and escapes HTML', () => {
    const m = buildMail(
      'newRequestRestaurant',
      { ...r, name: '<b>Mei</b>' },
      restaurant,
      'https://site/admin/collections/reservations/7',
    )
    expect(m.text).toContain('https://site/admin/collections/reservations/7')
    expect(m.html).toContain('&lt;b&gt;Mei&lt;/b&gt;')
    expect(m.html).not.toContain('<b>Mei</b>')
  })
})
