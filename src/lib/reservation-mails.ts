import type { Payload } from 'payload'
import type { Reservation } from '@/payload-types'
import { readReservationSettings } from './reservation-settings'
import { siteUrl } from './seo'

export type MailKind = 'newRequestRestaurant' | 'receiptGuest' | 'confirmedGuest' | 'declinedGuest'
export type MailRestaurant = {
  name: string
  phone: string
  email: string | null
  street: string
  postalCode: string
  city: string
}

/** Which mails a save triggers. Staff entries and saves without a status change send nothing. */
export function mailsFor(
  operation: 'create' | 'update',
  doc: Reservation,
  previous?: Reservation,
): MailKind[] {
  if (doc.anonymisedAt) return []
  if (operation === 'create')
    return doc.source === 'website' ? ['newRequestRestaurant', 'receiptGuest'] : []
  if (!previous || previous.status === doc.status) return []
  if (doc.status === 'confirmed') return ['confirmedGuest']
  if (doc.status === 'declined') return ['declinedGuest']
  return []
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function when(r: Reservation, lang: 'de' | 'en') {
  const day = new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${r.date}T12:00:00Z`))
  return `${day}, ${r.time}`
}

const people = (n: number, lang: 'de' | 'en') =>
  lang === 'de'
    ? `${n} ${n === 1 ? 'Person' : 'Personen'}`
    : `${n} ${n === 1 ? 'person' : 'people'}`

export function buildMail(kind: MailKind, r: Reservation, rest: MailRestaurant, adminUrl: string) {
  const lang: 'de' | 'en' = kind === 'newRequestRestaurant' ? 'de' : r.locale === 'en' ? 'en' : 'de'
  const details = `${when(r, lang)} · ${people(r.partySize, lang)}`
  const address = `${rest.street}, ${rest.postalCode} ${rest.city}`
  const message = r.messageToGuest?.trim()
  let subject: string
  let lines: string[]

  if (kind === 'newRequestRestaurant') {
    subject = `Neue Reservierungsanfrage: ${details}`
    lines = [
      `Neue Anfrage über die Website:`,
      ``,
      `${details}`,
      `Name: ${r.name}`,
      `E-Mail: ${r.email}`,
      ...(r.phone ? [`Telefon: ${r.phone}`] : []),
      ...(r.note ? [`Anmerkung: ${r.note}`] : []),
      ``,
      `Bestätigen oder ablehnen: ${adminUrl}`,
    ]
  } else if (lang === 'en') {
    subject =
      kind === 'confirmedGuest'
        ? `Your table at ${rest.name} is confirmed`
        : `Your table request at ${rest.name}`
    const intro = {
      receiptGuest: `Thank you, we have received your request. This is not yet a confirmation; we will reply by e-mail shortly.`,
      confirmedGuest: `We are happy to confirm your table.`,
      declinedGuest: `Unfortunately we cannot offer you a table at this time.`,
    }[kind]
    lines = [
      `Hello ${r.name},`,
      ``,
      intro,
      ``,
      details,
      ...(message ? [``, message] : []),
      ``,
      `${rest.name}`,
      address,
      `Phone: ${rest.phone}`,
    ]
  } else {
    subject =
      kind === 'confirmedGuest'
        ? `Ihr Tisch bei ${rest.name} ist bestätigt`
        : `Ihre Reservierungsanfrage bei ${rest.name}`
    const intro = {
      receiptGuest: `Vielen Dank, wir haben Ihre Anfrage erhalten. Das ist noch keine Bestätigung; wir antworten Ihnen in Kürze per E-Mail.`,
      confirmedGuest: `Wir bestätigen Ihnen gern Ihren Tisch.`,
      declinedGuest: `Leider können wir Ihnen zu diesem Zeitpunkt keinen Tisch anbieten.`,
    }[kind]
    lines = [
      `Hallo ${r.name},`,
      ``,
      intro,
      ``,
      details,
      ...(message ? [``, message] : []),
      ``,
      `${rest.name}`,
      address,
      `Telefon: ${rest.phone}`,
    ]
  }

  const text = lines.join('\n')
  const html = `<div style="font-family:system-ui,sans-serif;line-height:1.5;color:#1e2740">${lines
    .map((l) => (l === '' ? '<br>' : `<p style="margin:0">${esc(l)}</p>`))
    .join('')}</div>`
  return { subject, text, html }
}

/** Sends the given mails. Failures are logged with the reservation id and never thrown. */
export async function sendReservationMails(payload: Payload, r: Reservation, kinds: MailKind[]) {
  if (kinds.length === 0) return
  try {
    const [site, settings] = await Promise.all([
      payload.findGlobal({ slug: 'site-settings', depth: 0, locale: 'de' }),
      readReservationSettings(payload),
    ])
    const rest: MailRestaurant = {
      name: site.name,
      phone: site.phone,
      email: site.email ?? null,
      street: site.address.street,
      postalCode: site.address.postalCode,
      city: site.address.city,
    }
    const adminUrl = `${siteUrl}/admin/collections/reservations/${r.id}`
    for (const kind of kinds) {
      const to =
        kind === 'newRequestRestaurant' ? (settings.notificationEmail ?? rest.email) : r.email
      if (!to) {
        payload.logger.error(`Reservation ${r.id}: no recipient for ${kind} mail`)
        continue
      }
      const mail = buildMail(kind, r, rest, adminUrl)
      try {
        await payload.sendEmail({ to, subject: mail.subject, text: mail.text, html: mail.html })
      } catch (error) {
        payload.logger.error(
          `Reservation ${r.id}: ${kind} mail failed: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }
  } catch (error) {
    payload.logger.error(
      `Reservation ${r.id}: mails not sent: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}
