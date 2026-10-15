import type { Payload } from 'payload'
import type { Voucher } from '@/payload-types'
import { formatPrice } from './price'
import { readReservationSettings } from './reservation-settings'
import { siteUrl } from './seo'
import { voucherPdf, type PdfRestaurant } from './voucher-pdf'

export type VoucherMailKind = 'buyer' | 'restaurant'

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const longDate = (iso: string, lang: 'de' | 'en') =>
  new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Berlin',
  }).format(new Date(iso))

export function buildVoucherMail(
  kind: VoucherMailKind,
  v: Voucher,
  rest: PdfRestaurant,
  extra: { adminUrl: string; buyerMailFailed?: boolean },
) {
  const lang: 'de' | 'en' = kind === 'restaurant' ? 'de' : v.locale === 'en' ? 'en' : 'de'
  const amount = formatPrice(v.amount, lang === 'de' ? 'de-DE' : 'en-GB')
  const until = v.validUntil ? longDate(v.validUntil, lang) : ''
  const address = `${rest.street}, ${rest.postalCode} ${rest.city}`
  let subject: string
  let lines: string[]

  if (kind === 'restaurant') {
    subject = `Gutschein verkauft: ${amount} (${v.code})`
    lines = [
      `Über die Website wurde ein Gutschein bezahlt:`,
      ``,
      `Code: ${v.code}`,
      `Betrag: ${amount}`,
      `Käufer: ${v.buyerName} (${v.buyerEmail})`,
      ...(v.recipientName ? [`Für: ${v.recipientName}`] : []),
      `Gültig bis: ${until}`,
      ...(extra.buyerMailFailed
        ? [
            ``,
            `Achtung: Die E-Mail an den Käufer konnte nicht gesendet werden. Bitte den Code manuell weitergeben.`,
          ]
        : []),
      ``,
      `Im Admin: ${extra.adminUrl}`,
    ]
  } else if (lang === 'en') {
    subject = `Your gift voucher for ${rest.name}`
    lines = [
      `Hello ${v.buyerName},`,
      ``,
      `Thank you for your order. Your gift voucher is attached as a PDF.`,
      ``,
      `Code: ${v.code}`,
      `Value: ${amount}`,
      `Valid until: ${until}`,
      ``,
      `To redeem it, show the code or the PDF at the restaurant.`,
      `This is a demo shop: no real payment was made and the voucher cannot be redeemed.`,
      ``,
      rest.name,
      address,
      `Phone: ${rest.phone}`,
    ]
  } else {
    subject = `Ihr Gutschein für ${rest.name}`
    lines = [
      `Hallo ${v.buyerName},`,
      ``,
      `vielen Dank für Ihre Bestellung. Ihren Gutschein finden Sie als PDF im Anhang.`,
      ``,
      `Code: ${v.code}`,
      `Wert: ${amount}`,
      `Gültig bis: ${until}`,
      ``,
      `Zum Einlösen zeigen Sie im Restaurant einfach den Code oder das PDF.`,
      `Dies ist ein Demo-Shop: Es wurde nichts bezahlt, und der Gutschein ist nicht einlösbar.`,
      ``,
      rest.name,
      address,
      `Telefon: ${rest.phone}`,
    ]
  }

  const text = lines.join('\n')
  const html = `<div style="font-family:system-ui,sans-serif;line-height:1.5;color:#1d2621">${lines
    .map((l) => (l === '' ? '<br>' : `<p style="margin:0">${esc(l)}</p>`))
    .join('')}</div>`
  return { subject, text, html }
}

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error))

/** Buyer mail with PDF, then the restaurant notice. Failures are logged and never thrown. */
export async function sendVoucherMails(payload: Payload, v: Voucher) {
  try {
    const [site, settings] = await Promise.all([
      payload.findGlobal({ slug: 'site-settings', depth: 0, locale: 'de' }),
      readReservationSettings(payload),
    ])
    const rest: PdfRestaurant = {
      name: site.name,
      street: site.address.street,
      postalCode: site.address.postalCode,
      city: site.address.city,
      phone: site.phone,
    }
    const adminUrl = `${siteUrl}/admin/collections/vouchers/${v.id}`

    let buyerMailFailed = false
    try {
      const pdf = await voucherPdf(
        {
          code: v.code!,
          amount: v.amount,
          recipientName: v.recipientName,
          message: v.message,
          validUntil: v.validUntil!,
          locale: v.locale === 'en' ? 'en' : 'de',
        },
        rest,
      )
      const mail = buildVoucherMail('buyer', v, rest, { adminUrl })
      await payload.sendEmail({
        to: v.buyerEmail,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        attachments: [{ filename: `gutschein-${v.code}.pdf`, content: Buffer.from(pdf) }],
      })
    } catch (error) {
      buyerMailFailed = true
      payload.logger.error(`Voucher ${v.id}: buyer mail failed: ${errorText(error)}`)
    }

    const to = settings.notificationEmail ?? site.email
    if (!to) {
      payload.logger.error(`Voucher ${v.id}: no recipient for the restaurant notice`)
      return
    }
    const notice = buildVoucherMail('restaurant', v, rest, { adminUrl, buyerMailFailed })
    try {
      await payload.sendEmail({ to, subject: notice.subject, text: notice.text, html: notice.html })
    } catch (error) {
      payload.logger.error(`Voucher ${v.id}: restaurant notice failed: ${errorText(error)}`)
    }
  } catch (error) {
    payload.logger.error(`Voucher ${v.id}: mails not sent: ${errorText(error)}`)
  }
}
