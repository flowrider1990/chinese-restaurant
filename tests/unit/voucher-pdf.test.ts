import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { pdfSafe, voucherPdf } from '@/lib/voucher-pdf'

const rest = {
  name: 'Xiao Chu',
  street: 'Simon-Dach-Straße 99',
  postalCode: '10245',
  city: 'Berlin',
  phone: '030 1234567',
}

describe('pdfSafe', () => {
  it('keeps supported characters and replaces the rest', () => {
    const supported = new Set([...'Mei Grüße €'].map((c) => c.codePointAt(0)!))
    expect(pdfSafe('Mei 小厨 Grüße € 🎉', supported)).toBe('Mei ?? Grüße € ?')
  })
})

describe('voucherPdf', () => {
  it('renders one A5 landscape page', async () => {
    const bytes = await voucherPdf(
      { code: 'XC-7K4M-9QPA', amount: 5000, validUntil: '2029-12-31T22:59:59.000Z', locale: 'de' },
      rest,
    )
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(1)
    const { width, height } = doc.getPage(0).getSize()
    expect(Math.round(width)).toBe(595)
    expect(Math.round(height)).toBe(420)
  })

  it('does not fail on Chinese characters, emoji or a long message', async () => {
    const bytes = await voucherPdf(
      {
        code: 'XC-7K4M-9QPA',
        amount: 30000,
        recipientName: '王小明 (Xiaoming) 🎉',
        message: 'Alles Gute zum Geburtstag! 生日快乐 '.repeat(5).slice(0, 200),
        validUntil: '2029-12-31T22:59:59.000Z',
        locale: 'en',
      },
      rest,
    )
    expect(bytes.length).toBeGreaterThan(1000)
  })
})
