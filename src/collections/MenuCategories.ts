import type { CollectionConfig } from 'payload'
import { anyone, editorWrite } from '@/access'
import { slugField } from '@/fields/slug'

export const MenuCategories: CollectionConfig = {
  slug: 'menu-categories',
  labels: { singular: 'Kategorie', plural: 'Kategorien' },
  orderable: true,
  admin: {
    group: 'Speisekarte',
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug'],
    description: 'Reihenfolge per Drag & Drop in der Liste ändern.',
  },
  access: { read: anyone, ...editorWrite },
  fields: [
    { name: 'name', type: 'text', label: 'Name', required: true, localized: true },
    { name: 'description', type: 'textarea', label: 'Beschreibung', localized: true },
    slugField('name'),
    {
      name: 'items',
      type: 'join',
      label: 'Gerichte in dieser Kategorie',
      collection: 'menu-items',
      on: 'category',
      defaultSort: '_order',
    },
  ],
}
