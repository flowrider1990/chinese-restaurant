import { ValidationError, type CollectionConfig, type Where } from 'payload'
import { authenticated } from '@/access'
import { priceField } from '@/fields/price'
import { getStripe } from '@/lib/stripe'
import { handleStripeEvent } from '@/lib/voucher-webhook'
import { balanceCents, checkRedemptions, relationId, type RedemptionRow } from '@/lib/voucher-rules'

const readOnlyForStaff = { update: () => false }

export const Vouchers: CollectionConfig = {
  slug: 'vouchers',
  labels: { singular: 'Gutschein', plural: 'Gutscheine' },
  admin: {
    group: 'Gutscheine',
    useAsTitle: 'code',
    defaultColumns: ['code', 'amount', 'balance', 'status', 'buyerName', 'paidAt'],
    listSearchableFields: ['code', 'buyerName', 'buyerEmail'],
    description:
      'Einlösen: unter „Einlösungen" eine Zeile mit dem Betrag hinzufügen, Datum und Mitarbeiter bei Bedarf anpassen und speichern. Gespeicherte Einlösungen können nicht mehr geändert werden.',
  },
  defaultSort: '-createdAt',
  access: {
    read: authenticated,
    // Only the website's checkout creates vouchers (Local API with overrideAccess).
    create: () => false,
    update: authenticated,
    // Paid or cancelled vouchers are business records and stay.
    // A pending voucher's Stripe page stays payable for 31 minutes, so it may only be deleted after
    // an hour; deleting it earlier could lose a payment that arrives afterwards.
    delete: ({ req }): Where | false =>
      req.user
        ? {
            or: [
              { status: { equals: 'expired' } },
              {
                and: [
                  { status: { equals: 'pending' } },
                  { createdAt: { less_than: new Date(Date.now() - 60 * 60 * 1000).toISOString() } },
                ],
              },
            ],
          }
        : false,
  },
  endpoints: [
    {
      // Stripe → POST /api/vouchers/stripe-webhook. Locally: stripe listen --forward-to localhost:3000/api/vouchers/stripe-webhook
      path: '/stripe-webhook',
      method: 'post',
      handler: async (req) => {
        // The signature covers the exact bytes Stripe sent, so read the unparsed body.
        const rawBody = req.text ? await req.text() : ''
        let stripe
        try {
          stripe = getStripe()
        } catch (error) {
          req.payload.logger.error(error instanceof Error ? error.message : String(error))
          return Response.json({ error: 'Stripe not configured' }, { status: 500 })
        }
        const result = await handleStripeEvent({
          payload: req.payload,
          stripe,
          rawBody,
          signature: req.headers.get('stripe-signature'),
          secret: process.env.STRIPE_WEBHOOK_SECRET,
        })
        return Response.json(result.body, { status: result.status })
      },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, originalDoc, operation, req }) => {
        if (operation === 'create') {
          data.balance = data.amount
          return data
        }
        const prev = originalDoc ?? {}
        // Staff may only cancel a paid voucher; the server code (no user) drives all other changes.
        if (req.user && data.status && data.status !== prev.status) {
          if (!(prev.status === 'paid' && data.status === 'cancelled'))
            throw new ValidationError({
              collection: 'vouchers',
              errors: [
                {
                  path: 'status',
                  message: 'Status: Nur bezahlte Gutscheine können storniert werden.',
                },
              ],
            })
        }
        const previous: RedemptionRow[] = prev.redemptions ?? []
        const now = new Date()
        const userId = req.user?.id ?? null
        // Date and staff member of a new row are chosen in the admin (defaults: now, the
        // logged-in user); when and by whom it was entered is always stamped here.
        const next: RedemptionRow[] = (data.redemptions ?? previous).map(
          (row: RedemptionRow, i: number) =>
            i < previous.length
              ? row
              : {
                  ...row,
                  redeemedAt: row.redeemedAt || now.toISOString(),
                  by: relationId(row.by) ?? userId,
                  recordedAt: now.toISOString(),
                  recordedBy: userId,
                },
        )
        const reject = (message: string) =>
          new ValidationError({
            collection: 'vouchers',
            errors: [{ path: 'redemptions', message }],
          })
        const problem = checkRedemptions({
          previous,
          next,
          amountCents: prev.amount,
          status: data.status ?? prev.status,
          validUntil: prev.validUntil,
          paidAt: prev.paidAt,
          now,
        })
        if (problem) throw reject(problem)
        for (const row of next.slice(previous.length)) {
          const { totalDocs } = await req.payload.count({
            collection: 'users',
            where: { id: { equals: relationId(row.by) } },
            req,
          })
          if (totalDocs === 0) throw reject('Der ausgewählte Mitarbeiter existiert nicht.')
          row.redeemedAt = new Date(row.redeemedAt!).toISOString()
        }
        // Earlier rows are stored exactly as before (checked equal above), with plain ids.
        data.redemptions = next.map((row, i) =>
          i < previous.length
            ? {
                ...previous[i],
                by: relationId(previous[i].by),
                recordedBy: relationId(previous[i].recordedBy),
              }
            : row,
        )
        data.balance = balanceCents(prev.amount, next)
        return data
      },
    ],
  },
  fields: [
    {
      name: 'code',
      type: 'text',
      label: 'Code',
      unique: true,
      index: true,
      access: readOnlyForStaff,
      admin: { readOnly: true },
    },
    {
      type: 'row',
      fields: [
        {
          ...priceField({
            name: 'amount',
            label: 'Betrag (€)',
            required: true,
            readOnly: true,
            width: '50%',
          }),
          access: readOnlyForStaff,
        },
        // No field access here: the hook recomputes the balance on every save.
        priceField({ name: 'balance', label: 'Restbetrag (€)', readOnly: true, width: '50%' }),
      ],
    },
    {
      name: 'redemptions',
      type: 'array',
      label: 'Einlösungen',
      labels: { singular: 'Einlösung', plural: 'Einlösungen' },
      fields: [
        {
          type: 'row',
          fields: [
            priceField({ name: 'amount', label: 'Betrag (€)', required: true, width: '30%' }),
            {
              name: 'note',
              type: 'text',
              label: 'Notiz (z. B. Tisch, Rechnungsnr.)',
              maxLength: 200,
              admin: { width: '70%' },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'redeemedAt',
              type: 'date',
              label: 'Eingelöst am',
              // Evaluated when a row is added in the admin, so it is the moment of entry. Not
              // `required` (that would rebuild the table in the migration); the hook requires it.
              defaultValue: () => new Date().toISOString(),
              admin: {
                width: '50%',
                date: { pickerAppearance: 'dayAndTime', displayFormat: 'dd.MM.yyyy HH:mm' },
              },
            },
            {
              // Not `required`: a deleted user leaves earlier rows without a staff member, and
              // those rows must still save. The hook requires it for new rows.
              name: 'by',
              type: 'relationship',
              relationTo: 'users',
              label: 'Eingelöst von',
              defaultValue: ({ user }) => user?.id,
              admin: { width: '50%' },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'recordedAt',
              type: 'date',
              label: 'Erfasst am',
              admin: {
                readOnly: true,
                width: '50%',
                description: 'Wird beim Speichern automatisch gesetzt.',
                date: { pickerAppearance: 'dayAndTime', displayFormat: 'dd.MM.yyyy HH:mm' },
              },
            },
            {
              name: 'recordedBy',
              type: 'relationship',
              relationTo: 'users',
              label: 'Erfasst von',
              admin: {
                readOnly: true,
                width: '50%',
                description: 'Wird beim Speichern automatisch gesetzt.',
              },
            },
          ],
        },
      ],
    },
    {
      name: 'status',
      type: 'select',
      label: 'Status',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Zahlung ausstehend', value: 'pending' },
        { label: 'Bezahlt', value: 'paid' },
        { label: 'Abgelaufen (nicht bezahlt)', value: 'expired' },
        { label: 'Storniert', value: 'cancelled' },
      ],
      admin: {
        position: 'sidebar',
        description:
          'Stornieren nur bei bezahlten Gutscheinen; die Erstattung erfolgt im Stripe-Dashboard.',
      },
    },
    {
      name: 'validUntil',
      type: 'date',
      label: 'Gültig bis',
      access: readOnlyForStaff,
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'paidAt',
      type: 'date',
      label: 'Bezahlt am',
      access: readOnlyForStaff,
      admin: { position: 'sidebar', readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'buyerName',
          type: 'text',
          label: 'Käufer',
          required: true,
          maxLength: 100,
          access: readOnlyForStaff,
          admin: { readOnly: true, width: '50%' },
        },
        {
          name: 'buyerEmail',
          type: 'text',
          label: 'E-Mail des Käufers',
          required: true,
          maxLength: 200,
          access: readOnlyForStaff,
          admin: { readOnly: true, width: '50%' },
        },
      ],
    },
    {
      name: 'recipientName',
      type: 'text',
      label: 'Für (Beschenkter)',
      maxLength: 80,
      access: readOnlyForStaff,
      admin: { readOnly: true },
    },
    {
      name: 'message',
      type: 'textarea',
      label: 'Grußtext',
      maxLength: 200,
      access: readOnlyForStaff,
      admin: { readOnly: true },
    },
    {
      name: 'locale',
      type: 'select',
      label: 'Sprache',
      required: true,
      defaultValue: 'de',
      options: [
        { label: 'Deutsch', value: 'de' },
        { label: 'English', value: 'en' },
      ],
      access: readOnlyForStaff,
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'stripeSessionId',
      type: 'text',
      label: 'Stripe Checkout Session',
      unique: true,
      index: true,
      access: readOnlyForStaff,
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'stripePaymentIntent',
      type: 'text',
      label: 'Stripe Payment Intent',
      access: readOnlyForStaff,
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'privacyAcceptedAt',
      type: 'date',
      label: 'Datenschutz akzeptiert',
      access: readOnlyForStaff,
      admin: { position: 'sidebar', readOnly: true },
    },
  ],
}
