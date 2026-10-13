import type { TextField } from 'payload'
import { slugify } from '@/lib/slugify'

/**
 * Localized slug, filled from `sourceField` when left empty and always normalized.
 * Uniqueness per locale is enforced by the unique index.
 */
export const slugField = (sourceField: string): TextField => ({
  name: 'slug',
  type: 'text',
  label: 'Slug (URL)',
  localized: true,
  unique: true,
  index: true,
  admin: {
    position: 'sidebar',
    description: 'Wird automatisch aus dem Titel erzeugt, wenn leer.',
  },
  hooks: {
    beforeValidate: [
      ({ value, data }) => {
        const source = typeof value === 'string' && value.trim() ? value : data?.[sourceField]
        return typeof source === 'string' ? slugify(source) || undefined : value
      },
    ],
  },
})
