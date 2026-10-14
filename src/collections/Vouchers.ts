import { ValidationError, type CollectionConfig } from 'payload'
import { authenticated } from '@/access'
import { priceField } from '@/fields/price'
import { getStripe } from '@/lib/stripe'
import { handleStripeEvent } from '@/lib/voucher-webhook'
import { balanceCents, checkRedemptions, type RedemptionRow } from '@/lib/voucher-rules'

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
      'Einlösen: unter „Einlösungen" eine Zeile mit dem Betrag hinzufügen und speichern. Frühere Einlösungen bleiben unverändert.',
  },
  defaultSort: '-createdAt',
  access: {
    read: authenticated,
    // Only the website's checkout creates vouchers (Local API with overrideAccess).
    create: () => false,
    update: authenticated,
    // Paid or cancelled vouchers are business records and stay.
    delete: ({ req }) => (req.user ? { status: { in: ['pending', 'expired'] } } : false),
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
      ({ data, originalDoc, operation, req }) => {
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
        const next: RedemptionRow[] = (data.redemptions ?? previous).map(
          (row: RedemptionRow, i: number) =>
            i < previous.length
              ? // Earlier rows keep who and when from the stored record, whatever was submitted.
                { ...row, redeemedAt: previous[i].redeemedAt, by: previous[i].by }
              : { ...row, redeemedAt: new Date().toISOString(), by: req.user?.id ?? null },
        )
        const problem = checkRedemptions({
          previous,
          next,
          amountCents: prev.amount,
          status: data.status ?? prev.status,
          validUntil: prev.validUntil,
          now: new Date(),
        })
        if (problem)
          throw new ValidationError({
            collection: 'vouchers',
            errors: [{ path: 'redemptions', message: problem }],
          })
        data.redemptions = next
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
              admin: { readOnly: true, width: '50%', date: { pickerAppearance: 'dayAndTime' } },
            },
            {
              name: 'by',
              type: 'relationship',
              relationTo: 'users',
              label: 'Von',
              admin: { readOnly: true, width: '50%' },
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
