import type { CollectionConfig } from 'payload'
import { authenticated } from '@/access'
import { anonymiseExpiredReservations, isAuthorisedCron } from '@/lib/reservation-cleanup'
import { mailsFor, sendReservationMails } from '@/lib/reservation-mails'
import { isValidDate, isValidTime, localToUtc } from '@/lib/reservation-rules'

/** Name and e-mail are required, except after the cleanup removed them. */
const requiredUnlessAnonymised = (
  value: unknown,
  { siblingData }: { siblingData: { anonymisedAt?: string | null } },
) =>
  Boolean(siblingData.anonymisedAt) ||
  (typeof value === 'string' && value.trim() !== '') ||
  'Pflichtfeld.'

export const Reservations: CollectionConfig = {
  slug: 'reservations',
  labels: { singular: 'Reservierung', plural: 'Reservierungen' },
  admin: {
    group: 'Reservierungen',
    useAsTitle: 'name',
    defaultColumns: ['date', 'time', 'partySize', 'name', 'status', 'createdAt'],
    listSearchableFields: ['name', 'email'],
    description:
      'Neue Anfragen stehen oben. Status ändern und speichern: Der Gast bekommt automatisch eine E-Mail.',
  },
  defaultSort: '-createdAt',
  access: {
    read: authenticated,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  endpoints: [
    {
      // Daily job (e.g. Vercel Cron): GET /api/reservations/cleanup with "Authorization: Bearer <CRON_SECRET>".
      path: '/cleanup',
      method: 'get',
      handler: async (req) => {
        if (!isAuthorisedCron(req.headers.get('authorization'), process.env.CRON_SECRET)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const anonymised = await anonymiseExpiredReservations(req.payload)
        return Response.json({ anonymised })
      },
    },
  ],
  hooks: {
    beforeValidate: [
      ({ data, operation, req }) => {
        if (!data) return data
        // Anything created by a logged-in user (admin form, "Duplicate", REST) is a staff entry:
        // only the public form, which runs without a user, creates website requests.
        if (operation === 'create' && req.user) data.source = 'admin'
        // Malformed values are left to the field validation, which shows a field error.
        if (isValidDate(data.date ?? '') && isValidTime(data.time ?? ''))
          data.startsAt = localToUtc(data.date, data.time, 'Europe/Berlin').toISOString()
        if (typeof data.email === 'string') data.email = data.email.trim().toLowerCase()
        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        // Sent after the save; a failed mail is logged and never undoes the reservation.
        await sendReservationMails(req.payload, doc, mailsFor(operation, doc, previousDoc))
        return doc
      },
    ],
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'date',
          type: 'text',
          label: 'Datum (JJJJ-MM-TT)',
          required: true,
          validate: (value: unknown) =>
            (typeof value === 'string' && isValidDate(value)) ||
            'Datum im Format JJJJ-MM-TT, z. B. 2026-10-24.',
          admin: { width: '33%' },
        },
        {
          name: 'time',
          type: 'text',
          label: 'Uhrzeit',
          required: true,
          admin: { width: '33%' },
          validate: (value: unknown) =>
            (typeof value === 'string' && isValidTime(value)) ||
            'Uhrzeit im Format HH:MM, z. B. 19:30.',
        },
        {
          name: 'partySize',
          type: 'number',
          label: 'Personen',
          required: true,
          min: 1,
          admin: { width: '33%' },
        },
      ],
    },
    {
      name: 'status',
      type: 'select',
      label: 'Status',
      required: true,
      defaultValue: 'requested',
      options: [
        { label: 'Angefragt', value: 'requested' },
        { label: 'Bestätigt', value: 'confirmed' },
        { label: 'Abgelehnt', value: 'declined' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'messageToGuest',
      type: 'textarea',
      label: 'Nachricht an den Gast (optional)',
      maxLength: 500,
      admin: { position: 'sidebar', description: 'Steht in der Bestätigungs- oder Absage-E-Mail.' },
    },
    {
      name: 'name',
      type: 'text',
      label: 'Name',
      maxLength: 100,
      validate: requiredUnlessAnonymised,
    },
    {
      type: 'row',
      fields: [
        {
          name: 'email',
          type: 'text',
          label: 'E-Mail',
          maxLength: 200,
          validate: requiredUnlessAnonymised,
          admin: { width: '50%' },
        },
        { name: 'phone', type: 'text', label: 'Telefon', maxLength: 40, admin: { width: '50%' } },
      ],
    },
    { name: 'note', type: 'textarea', label: 'Anmerkung des Gastes', maxLength: 500 },
    {
      name: 'locale',
      type: 'select',
      label: 'Sprache des Gastes',
      required: true,
      defaultValue: 'de',
      options: [
        { label: 'Deutsch', value: 'de' },
        { label: 'English', value: 'en' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'source',
      type: 'select',
      label: 'Eingegangen über',
      required: true,
      defaultValue: 'admin',
      options: [
        { label: 'Website', value: 'website' },
        { label: 'Im Admin eingetragen', value: 'admin' },
      ],
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'startsAt',
      type: 'date',
      label: 'Beginn (berechnet)',
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'privacyAcceptedAt',
      type: 'date',
      label: 'Datenschutz akzeptiert',
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'anonymisedAt',
      type: 'date',
      label: 'Personendaten gelöscht am',
      admin: { position: 'sidebar', readOnly: true },
    },
  ],
}
