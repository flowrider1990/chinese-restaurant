import type { CollectionConfig } from 'payload'
import { editorWrite, publishedOrAuthenticated } from '@/access'
import { priceField } from '@/fields/price'

export const MenuItems: CollectionConfig = {
  slug: 'menu-items',
  labels: { singular: 'Gericht', plural: 'Gerichte' },
  orderable: true,
  admin: {
    group: 'Speisekarte',
    useAsTitle: 'name',
    defaultColumns: ['name', 'menuNumber', 'category', 'price', 'availability', 'published'],
    listSearchableFields: ['name', 'menuNumber'],
  },
  access: { read: publishedOrAuthenticated, ...editorWrite },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'menuNumber',
          type: 'text',
          label: 'Nr.',
          admin: { width: '20%', description: 'Optional, z. B. „23“ oder „S4“.' },
        },
        {
          name: 'name',
          type: 'text',
          label: 'Name',
          required: true,
          localized: true,
          admin: { width: '80%' },
        },
      ],
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Kurzbeschreibung',
      localized: true,
      maxLength: 300,
    },
    {
      type: 'row',
      fields: [
        priceField({ name: 'price', label: 'Preis (€)', required: true, width: '50%' }),
        {
          name: 'category',
          type: 'relationship',
          relationTo: 'menu-categories',
          label: 'Kategorie',
          required: true,
          admin: { width: '50%' },
        },
      ],
    },
    { name: 'image', type: 'upload', relationTo: 'media', label: 'Bild' },
    {
      name: 'attributes',
      type: 'relationship',
      relationTo: 'attributes',
      hasMany: true,
      label: 'Allergene & Merkmale',
    },
    {
      // Provisional shape; aligned with the real menu data set before go-live.
      name: 'options',
      type: 'array',
      label: 'Auswahl / Varianten',
      labels: { singular: 'Option', plural: 'Optionen' },
      admin: {
        description:
          'Z. B. Hähnchen / Rind / Tofu. Aufpreis leer lassen, wenn die Option nichts extra kostet.',
        initCollapsed: true,
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'label',
              type: 'text',
              label: 'Bezeichnung',
              required: true,
              localized: true,
              admin: { width: '60%' },
            },
            priceField({ name: 'priceDelta', label: 'Aufpreis (€)', allowNegative: true, width: '40%' }),
          ],
        },
      ],
    },
    {
      name: 'published',
      type: 'checkbox',
      label: 'Auf der Website anzeigen',
      defaultValue: false,
      admin: { position: 'sidebar' },
    },
    {
      name: 'availability',
      type: 'select',
      label: 'Verfügbarkeit',
      required: true,
      defaultValue: 'available',
      options: [
        { label: 'Verfügbar', value: 'available' },
        { label: 'Heute ausverkauft', value: 'sold_out' },
        { label: 'Vorübergehend nicht verfügbar', value: 'unavailable' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'featured',
      type: 'checkbox',
      label: 'Highlight auf der Startseite',
      defaultValue: false,
      admin: { position: 'sidebar' },
    },
  ],
}
