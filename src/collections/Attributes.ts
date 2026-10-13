import type { CollectionConfig } from 'payload'
import { anyone, editorWrite } from '@/access'

export const Attributes: CollectionConfig = {
  slug: 'attributes',
  labels: { singular: 'Merkmal / Allergen', plural: 'Merkmale & Allergene' },
  orderable: true,
  admin: {
    group: 'Speisekarte',
    useAsTitle: 'name',
    defaultColumns: ['name', 'kind', 'code'],
  },
  access: { read: anyone, ...editorWrite },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'Name',
      required: true,
      localized: true,
      admin: {
        description:
          'Vollständige Bezeichnung, z. B. „Erdnüsse“. Bei Allergenen ist dies die maßgebliche Angabe.',
      },
    },
    {
      name: 'kind',
      type: 'select',
      label: 'Art',
      required: true,
      defaultValue: 'dietary',
      options: [
        { label: 'Allergen (kennzeichnungspflichtig)', value: 'allergen' },
        { label: 'Ernährung (z. B. vegan, vegetarisch)', value: 'dietary' },
        { label: 'Sonstiges (z. B. scharf, neu)', value: 'other' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'code',
      type: 'text',
      label: 'Kürzel (optional)',
      admin: {
        position: 'sidebar',
        description: 'Nur Darstellungshilfe (z. B. „E“). Ersetzt nie den vollständigen Namen.',
      },
    },
    { name: 'description', type: 'textarea', label: 'Erläuterung', localized: true },
  ],
}
