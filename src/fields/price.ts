import type { NumberField } from 'payload'

type Options = {
  name: string
  label: string
  required?: boolean
  allowNegative?: boolean
  width?: string
  readOnly?: boolean
  description?: string
}

/** Integer cents in the DB; edited as "12,90" via the PriceField admin component. */
export const priceField = ({
  name,
  label,
  required,
  allowNegative,
  width,
  readOnly,
  description,
}: Options): NumberField => ({
  name,
  type: 'number',
  label,
  required,
  admin: {
    width,
    readOnly,
    description,
    components: {
      Field: '/components/admin/PriceField#PriceField',
      Cell: '/components/admin/PriceCell#PriceCell',
    },
  },
  validate: (value: number | null | undefined) => {
    if (value === null || value === undefined) return required ? 'Bitte einen Preis angeben.' : true
    if (!Number.isInteger(value)) return 'Ungültiger Preis. Format: 12,90'
    if (!allowNegative && value < 0) return 'Der Preis darf nicht negativ sein.'
    return true
  },
})
