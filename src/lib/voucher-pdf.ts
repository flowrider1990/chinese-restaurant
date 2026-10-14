import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib'
import { formatPrice } from './price'

export type PdfVoucher = {
  code: string
  /** Cents. */
  amount: number
  recipientName?: string | null
  message?: string | null
  validUntil: string
  locale: 'de' | 'en'
}
export type PdfRestaurant = {
  name: string
  street: string
  postalCode: string
  city: string
  phone: string
}

const INK = rgb(0.118, 0.153, 0.251) // #1e2740
const COBALT = rgb(0.169, 0.341, 0.627) // #2b57a0
const SOFT = rgb(0.4, 0.43, 0.5)

/** The built-in Helvetica only covers WinAnsi (Latin, €, umlauts); other characters become "?". */
export function pdfSafe(text: string, supported: Set<number>): string {
  return [...text].map((c) => (c === '\n' || supported.has(c.codePointAt(0)!) ? c : '?')).join('')
}

/** Splits text into lines that fit `maxWidth` at `size`. */
function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    let line = ''
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(next, size) <= maxWidth) line = next
      else {
        if (line) lines.push(line)
        line = word
      }
    }
    lines.push(line)
  }
  return lines
}

/** A5 landscape gift voucher (595 × 420 pt). */
export async function voucherPdf(v: PdfVoucher, r: PdfRestaurant): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const en = v.locale === 'en'
  doc.setTitle(`${en ? 'Gift voucher' : 'Gutschein'} ${r.name} ${v.code}`)
  const page = doc.addPage([595, 420])
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const supported = new Set(regular.getCharacterSet())
  const safe = (s: string) => pdfSafe(s, supported)
  const margin = 40
  const width = 595 - margin * 2

  page.drawRectangle({ x: 16, y: 16, width: 563, height: 388, borderColor: COBALT, borderWidth: 2 })
  page.drawText(safe(r.name), { x: margin, y: 360, size: 22, font: bold, color: COBALT })
  page.drawText(en ? 'Gift voucher' : 'Gutschein', {
    x: margin,
    y: 320,
    size: 30,
    font: bold,
    color: INK,
  })
  page.drawText(formatPrice(v.amount, en ? 'en-GB' : 'de-DE'), {
    x: margin,
    y: 270,
    size: 40,
    font: bold,
    color: INK,
  })

  let y = 236
  if (v.recipientName?.trim()) {
    page.drawText(safe(`${en ? 'For' : 'Für'} ${v.recipientName.trim()}`), {
      x: margin,
      y,
      size: 14,
      font: regular,
      color: INK,
    })
    y -= 22
  }
  if (v.message?.trim()) {
    for (const line of wrap(safe(v.message.trim()), regular, 11, width).slice(0, 4)) {
      page.drawText(line, { x: margin, y, size: 11, font: regular, color: SOFT })
      y -= 15
    }
  }

  page.drawText('Code', { x: margin, y: 104, size: 10, font: regular, color: SOFT })
  page.drawText(v.code, { x: margin, y: 80, size: 24, font: bold, color: COBALT })
  const until = new Intl.DateTimeFormat(en ? 'en-GB' : 'de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Berlin',
  }).format(new Date(v.validUntil))
  page.drawText(safe(`${en ? 'Valid until' : 'Gültig bis'} ${until}`), {
    x: margin,
    y: 60,
    size: 10,
    font: regular,
    color: SOFT,
  })
  page.drawText(safe(`${r.street}, ${r.postalCode} ${r.city} · ${r.phone}`), {
    x: margin,
    y: 36,
    size: 9,
    font: regular,
    color: SOFT,
  })
  page.drawText(en ? 'DEMO – not a real voucher' : 'DEMO – kein echter Gutschein', {
    x: 400,
    y: 36,
    size: 9,
    font: bold,
    color: SOFT,
  })

  return doc.save()
}
