import { describe, expect, it } from 'vitest'
import type { Voucher } from '@/payload-types'
import { buildVoucherMail } from '@/lib/voucher-mails'

const rest = {
  name: 'Xiao Chu',
  street: 'Simon-Dach-Straße 99',
  postalCode: '10245',
  city: 'Berlin',
  phone: '030 1234567',
}
const v = {
  id: 7,
  code: 'XC-7K4M-9QPA',
  status: 'paid',
  amount: 5000,
  balance: 5000,
  buyerName: 'Mei <Lin>',
  buyerEmail: 'mei@example.com',
  recipientName: 'Jonas',
  locale: 'de',
  validUntil: '2029-12-31T22:59:59.000Z',
  updatedAt: '',
  createdAt: '',
} as Voucher
const extra = { adminUrl: 'http://localhost:3000/admin/collections/vouchers/7' }

describe('buildVoucherMail', () => {
  it('writes the buyer mail in German with code, amount and validity', () => {
    const m = buildVoucherMail('buyer', v, rest, extra)
    expect(m.subject).toBe('Ihr Gutschein für Xiao Chu')
    expect(m.text).toContain('XC-7K4M-9QPA')
    expect(m.text).toContain('50,00 €')
    expect(m.text).toContain('31. Dezember 2029')
    expect(m.text).toMatch(/^Hallo Mei <Lin>,/)
    expect(m.html).toContain('Mei &lt;Lin&gt;')
  })
  it('writes the buyer mail in English', () => {
    const m = buildVoucherMail('buyer', { ...v, locale: 'en' }, rest, extra)
    expect(m.subject).toBe('Your gift voucher for Xiao Chu')
    expect(m.text).toContain('€50.00')
  })
  it('tells the restaurant, and warns when the buyer mail failed', () => {
    const ok = buildVoucherMail('restaurant', v, rest, extra)
    expect(ok.subject).toBe('Gutschein verkauft: 50,00 € (XC-7K4M-9QPA)')
    expect(ok.text).toContain(extra.adminUrl)
    expect(ok.text).not.toMatch(/Achtung/)
    const failed = buildVoucherMail('restaurant', v, rest, { ...extra, buyerMailFailed: true })
    expect(failed.text).toMatch(/Achtung/)
  })
})
